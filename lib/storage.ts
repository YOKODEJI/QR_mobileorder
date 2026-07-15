// Supabase Storage: 店舗写真・メニュー写真のアップロード。
// バケット "photos" は公開読み取り／書込はスタッフ(authenticated)のみ（supabase/step6-storage.sql）。
import { getSupabase, STORE_ID } from "./supabase";

const BUCKET = "photos";

/** 画像ファイルをStorageへアップロードし、公開URLを返す。失敗/未設定ならnull */
export async function uploadPhoto(file: File, folder: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${STORE_ID}/${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    console.error("uploadPhoto:", error.message);
    return null;
  }
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 差し替え/削除で不要になった旧画像をStorageから消す（ベストエフォート。失敗しても無視） */
export async function deletePhoto(url: string | null | undefined) {
  const sb = getSupabase();
  if (!sb || !url) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // data:URL(旧base64)や他バケットは対象外
  const path = url.slice(idx + marker.length);
  if (!path) return;
  await sb.storage.from(BUCKET).remove([path]).catch(() => {});
}
