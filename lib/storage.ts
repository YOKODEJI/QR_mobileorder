// Supabase Storage: 店舗写真・メニュー写真のアップロード。
// バケット "photos" は公開読み取り／書込はスタッフ(authenticated)のみ（supabase/step6-storage.sql）。
import { getSupabase, STORE_ID } from "./supabase";

const BUCKET = "photos";

/** 画像を最大辺1000pxに縮小しJPEG(quality .82)へ変換する（読み込み速度対策）。
 *  SVG・既に十分小さい画像・失敗時は元ファイルのまま返す（安全側）。 */
export async function resizeImage(file: File, maxDim = 1000, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (e) {
    console.error("resizeImage:", e);
    return file;
  }
}

/** 画像ファイルをStorageへアップロードし、公開URLを返す。失敗/未設定ならnull */
export async function uploadPhoto(file: File, folder: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !STORE_ID) return null;
  const resized = await resizeImage(file);
  const ext = resized.type === "image/jpeg"
    ? "jpg"
    : (resized.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${STORE_ID}/${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, resized, {
    contentType: resized.type || undefined,
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
