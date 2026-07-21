import { fetchStoreSettings } from "@/lib/data";

// PWA用マニフェスト（管理画面専用。scope/start_urlを/adminに限定し、
// 客用ページ(/order/[table])ではインストール対象にならないようにする）。
// 店舗名・テーマ色はDBから取得し、店舗ごとに自動で反映される（コード変更不要）。
export async function GET() {
  const store = await fetchStoreSettings();
  const name = store?.storeName ? `${store.storeName} 管理画面` : "QRオーダー 管理画面";
  const themeColor = store?.theme ?? "#cf4b2c";

  const manifest = {
    name,
    short_name: store?.storeName ?? "QRオーダー",
    description: "厨房・会計・メニュー管理をまとめた店舗用管理ツール",
    start_url: "/admin",
    scope: "/admin/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: themeColor,
    lang: "ja",
    // public/logo.png があればそれを、無ければ店舗イニシャルの仮アイコンを都度生成する
    // （app/admin/pwa-icon/[size]/route.tsx 参照）。
    icons: [
      { src: "/admin/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/admin/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/admin/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
