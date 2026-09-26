import { fetchStoreSettings } from "@/lib/data";

/** ホーム画面に追加する画面ごとのPWAマニフェスト（/admin・/handy・/kitchen）。
 *  scope/start_url をその画面に限定し、追加したアイコンから必ずその画面が開くようにする。
 *  アイコンは /admin/pwa-icon（店舗の設定画像、無ければ店名イニシャルの仮アイコン）を共用する。 */
export async function manifestResponse(opts: { label: string; path: string; description: string }) {
  const store = await fetchStoreSettings();
  const storeName = store?.storeName ?? "QRオーダー";
  const manifest = {
    name: `${storeName} ${opts.label}`,
    short_name: opts.label === "管理画面" ? storeName : opts.label,
    description: opts.description,
    start_url: opts.path,
    scope: `${opts.path}/`,
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: store?.theme ?? "#cf4b2c",
    lang: "ja",
    icons: [
      { src: "/admin/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/admin/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/admin/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
