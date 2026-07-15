-- ============================================================
-- ステップ6 画像Storage化: 公開バケット作成 + アクセス権限
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。
-- ============================================================

-- 公開読み取りバケット（店舗写真・メニュー写真）。客ページにも表示するため public=true。
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- 閲覧は誰でも（客ページ表示のため）、アップロード/削除/上書きはスタッフ(authenticated)のみ。
-- ※ ステップ5と同じ方針: 書込はログイン済みスタッフのみに限定。
drop policy if exists photos_public_read        on storage.objects;
drop policy if exists photos_write_authenticated on storage.objects;
create policy photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos');
create policy photos_write_authenticated on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');
