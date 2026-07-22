-- ============================================================
-- ステップ18 Square会計連携の土台（キー未登録でも安全に無効状態で動作）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。
--
-- 設計方針:
--   - 店舗ごとにON/OFFする主体は「よこでじ（開発側）」であり、店舗スタッフの
--     設定画面には一切露出しない。よって square_enabled 等はSQL Editorから
--     直接更新する運用とし、アプリのUI/RPCからは意図的に一切触れないようにする。
--   - square_access_token は決済連携の資格情報そのもの。stores テーブルは
--     anon/authenticated(=客・スタッフ双方)に対して行レベルでは公開されているため、
--     列レベルGRANTで square_* 列だけを両ロールから完全に読めなくする
--     （tables.qr_token/session_tokenと同じ手法）。実際の読み取りは
--     Edge Function が service_role で行う（service_roleは列GRANTの対象外）。
--   - UPDATEも同様に、既存の設定画面が触る列だけをauthenticatedに許可し、
--     square_* 列はどのロールからも更新できないようにする（Yokodeji以外は
--     フロントからもAPI直叩きからも一切変更できない）。
-- ============================================================

alter table stores add column if not exists square_enabled     boolean not null default false;
alter table stores add column if not exists square_environment text not null default 'sandbox'; -- 'sandbox' | 'production'
alter table stores add column if not exists square_location_id text;
alter table stores add column if not exists square_access_token text;

-- SELECT: square_*列を除いた既存の公開列だけを明示的に許可し直す
revoke select on stores from anon;
grant select (
  id, name, theme, show_header_photo, show_footer_photo,
  header_photo_url, footer_photo_url, pwa_icon_url,
  tax_mode, tax_rate, charge_rate, created_at
) on stores to anon;

revoke select on stores from authenticated;
grant select (
  id, name, theme, show_header_photo, show_footer_photo,
  header_photo_url, footer_photo_url, pwa_icon_url,
  tax_mode, tax_rate, charge_rate, created_at
) on stores to authenticated;

-- UPDATE: 設定画面が実際に更新する列だけをauthenticated(スタッフ)に許可
revoke update on stores from authenticated;
grant update (
  name, theme, show_header_photo, show_footer_photo,
  header_photo_url, footer_photo_url, pwa_icon_url,
  tax_mode, tax_rate, charge_rate
) on stores to authenticated;

-- ============================================================
-- 確認用（実行後）:
--   select square_enabled from stores limit 1;  -- SQL Editor(postgres/service_role)からは見える
--   -- anon/authenticatedキーでの直接select/updateはPostgRESTが列不許可エラーを返すこと
-- ============================================================
