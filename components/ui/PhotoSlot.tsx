"use client";

import { useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadPhoto, deletePhoto, resizeImage } from "@/lib/storage";

/* クリック / ドラッグ&ドロップで画像を設定できる汎用スロット。
   Supabase設定時はStorageへアップロードして公開URLを保持、未設定時はローカルbase64のまま動く。 */
export default function PhotoSlot({
  height,
  radius = 0,
  label = "写真をドラッグ＆ドロップ／タップで追加",
  value,
  onChange,
  folder = "photo",
}: {
  height: number;
  radius?: number;
  label?: string;
  value?: string | null;
  onChange?: (url: string | null) => void;
  /** Storageの保存先プレフィックス（例: "header" / "footer" / "menu-<id>"） */
  folder?: string;
}) {
  const [local, setLocal] = useState<string | null>(value ?? null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const img = value !== undefined ? value : local;

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    if (isSupabaseConfigured()) {
      setUploading(true);
      const url = await uploadPhoto(f, folder);
      setUploading(false);
      if (!url) return; // 失敗時は何もしない（既存の写真はそのまま）
      const prev = img;
      if (onChange) onChange(url);
      else setLocal(url);
      if (prev && prev !== url) deletePhoto(prev); // 差し替え前の画像は掃除（失敗しても無視）
      return;
    }
    // 未設定（ローカル開発）はこれまで通りbase64で保持（縮小してから保持しDBの肥大化を防ぐ）
    const resized = await resizeImage(f);
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      if (onChange) onChange(url);
      else setLocal(url);
    };
    r.readAsDataURL(resized);
  };

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!uploading) handleFile(e.dataTransfer.files?.[0]);
      }}
      style={{
        height: `${height}px`,
        borderRadius: `${radius}px`,
        cursor: uploading ? "default" : "pointer",
        overflow: "hidden",
        background: img ? "transparent" : "var(--chip-tint)",
        border: img ? "none" : "2px dashed var(--soldout-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{ fontSize: "12px", color: "var(--text-2)", fontWeight: 600, padding: "0 12px", textAlign: "center" }}
        >
          {label}
        </span>
      )}
      {uploading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--text-2)",
          }}
        >
          アップロード中…
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
