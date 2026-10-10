import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

// /handy 配下だけに専用のmanifestを紐付ける（ホーム画面のアイコンから必ずハンディが開く）
export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  return {
    title: store?.storeName ? `${store.storeName} ハンディ` : "ハンディ",
    manifest: "/handy/manifest.webmanifest",
    icons: { apple: "/admin/pwa-icon/192?app=handy" },
    appleWebApp: { capable: true, title: "ハンディ", statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  // スマホで使う前提。ノッチの下まで使い（viewportFit）、入力欄を押したときや二本指で勝手に拡大しないようにする
  return {
    themeColor: store?.theme ?? "#cf4b2c",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  };
}

export default function HandyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
