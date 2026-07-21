import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { fetchStoreSettings } from "@/lib/data";

// manifest.webmanifest が参照するインストールアイコン。
// public/logo.png が置かれていればそれをそのまま返し、無ければ
// 店舗テーマ色を背景に店名の頭文字を配した仮アイコンを都度生成する
// （ロゴ未用意の間もインストール自体は試せるようにするためのフォールバック。
//  logo.png を置くだけで次回アクセスから自動的に切り替わる＝コード変更不要）。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (existsSync(logoPath)) {
    const buf = await readFile(logoPath);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  }

  const store = await fetchStoreSettings();
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
