-- ============================================================
-- step24: 写真バケット(photos)の書き込みを「自店舗のオーナー」だけにする
-- 何度実行しても安全。
--
-- 背景: step6 の photos_write_authenticated は「ログイン済み(authenticated)なら誰でも」だった。
--       authenticated には、QR注文ページで匿名ログイン(signInAnonymously)した客と、
--       同じSupabaseを共有する他店舗のスタッフも含まれるため、誰でもメニュー写真・店舗写真を
--       アップロード・上書き・削除できてしまっていた。
-- 変更: 書き込み（追加・上書き・移動・削除）は次の両方を満たすときだけ。
--   ・呼び出した人が自店舗のオーナー（staff_role() = 'owner'。step22 のメニュー編集と同じ条件）
--   ・パスの先頭フォルダが自分の店舗id（lib/storage.ts は "<店舗id>/<用途>-<時刻>-<乱数>.<拡張子>" で保存する）
--   写真を使うのはメニュー管理と店舗設定だけで、どちらの保存もオーナー限定（step22）。
--   staff・kitchen は写真を上げても保存先に書けないので、ここもオーナー限定にそろえる。
-- 変えないもの: photos_public_read（閲覧は誰でも。客ページに表示するため）。
-- 前提: step10（staff_store_id）・step22（staff_role）適用済み。
-- ============================================================

drop policy if exists photos_write_authenticated on storage.objects;
create policy photos_write_authenticated on storage.objects
  for all to authenticated
  using (
    bucket_id = 'photos'
    and public.staff_role() = 'owner'
    and (storage.foldername(name))[1] = public.staff_store_id()::text
  )
  with check (
    bucket_id = 'photos'
    and public.staff_role() = 'owner'
    and (storage.foldername(name))[1] = public.staff_store_id()::text
  );
