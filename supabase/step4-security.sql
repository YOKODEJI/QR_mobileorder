-- ============================================================
-- ステップ4 セキュリティ移行スクリプト（既存DB向け・1回だけ実行）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。
-- 内容: tables に qr_token / session_token を追加＋既存行にランダム付与。
--   実行後、必ず supabase/functions.sql も再実行してください
--   （place_order にトークン検証＋レート制限、close_table にセッション更新、
--    open_session / regenerate_table_token を追加済み）。
-- 冪等（再実行しても安全）。
-- ============================================================

-- pgcrypto（gen_random_bytes 用）。既定で有効だが念のため。
create extension if not exists pgcrypto;

-- 1) 列を追加（まずは NULL 許可）
alter table tables add column if not exists qr_token      text;
alter table tables add column if not exists session_token text;

-- 2) 既存行にランダムトークンを付与（未設定のものだけ）
update tables set qr_token      = encode(gen_random_bytes(12), 'hex') where qr_token      is null;
update tables set session_token = encode(gen_random_bytes(12), 'hex') where session_token is null;

-- 3) NOT NULL＋デフォルト（今後の追加行は自動採番）
alter table tables alter column qr_token      set not null;
alter table tables alter column session_token set not null;
alter table tables alter column qr_token      set default encode(gen_random_bytes(12), 'hex');
alter table tables alter column session_token set default encode(gen_random_bytes(12), 'hex');

-- 確認用: select id, name, qr_token, session_token from tables order by sort;
