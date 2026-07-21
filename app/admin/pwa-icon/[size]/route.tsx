import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { fetchStoreSettings } from "@/lib/data";

// manifest.webmanifest が参照するインストールアイコン。優先順位は
//   1) 設定画面からアップロードされた店舗アイコン(stores.pwa_icon_url)
//   2) public/logo.png（手動配置。当面のフォールバック用に残している）
//   3) 店舗テーマ色を背景に店名の頭文字を配した仮アイコンをその場で生成
// のいずれも無ければ最終的に3にたどり着くため、未設定でもインストール自体は試せる。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;
  const store = await fetchStoreSettings();

  if (store?.pwaIconUrl) {
    const res = await fetch(store.pwaIconUrl).catch(() => null);
    if (res?.ok) {
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (existsSync(logoPath)) {
    const buf = await readFile(logoPath);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  }

  const initial = (store?.storeName ?? "Q").trim().charAt(0) || "Q";
  const theme = store?.theme ?? "#cf4b2c";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: theme,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(px * 0.52),
          fontWeight: 800,
          color: "#fff",
        }}
      >
        {initial}
      </div>
    ),
    { width: px, height: px }
  );
}
