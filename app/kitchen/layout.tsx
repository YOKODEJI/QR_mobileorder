import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

// /kitchen 配下だけに専用のmanifestを紐付ける（ホーム画面のアイコンから必ず厨房画面が開く）
export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  return {
    title: store?.storeName ? `${store.storeName} 厨房` : "厨房",
    manifest: "/kitchen/manifest.webmanifest",
    icons: { apple: "/admin/pwa-icon/192" },
    appleWebApp: { capable: true, title: "厨房", statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  return { themeColor: store?.theme ?? "#cf4b2c" };
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
