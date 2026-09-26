import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

// /handy 配下だけに専用のmanifestを紐付ける（ホーム画面のアイコンから必ずハンディが開く）
export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  return {
    title: store?.storeName ? `${store.storeName} ハンディ` : "ハンディ",
    manifest: "/handy/manifest.webmanifest",
    icons: { apple: "/admin/pwa-icon/192" },
    appleWebApp: { capable: true, title: "ハンディ", statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  return { themeColor: store?.theme ?? "#cf4b2c" };
}

export default function HandyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
