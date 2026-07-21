import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

// /admin配下だけにmanifestを紐付ける（metadataはセグメント単位で継承されるため、
// ここで設定すれば客用の/order/[table]には一切影響しない＝インストール対象は管理画面のみ）。
export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  const name = store?.storeName ? `${store.storeName} 管理画面` : "QRオーダー 管理画面";
  return {
    title: name,
    manifest: "/admin/manifest.webmanifest",
    icons: {
      apple: "/admin/pwa-icon/192",
    },
    appleWebApp: {
      capable: true,
      title: store?.storeName ?? "QRオーダー",
      statusBarStyle: "default",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  return {
    themeColor: store?.theme ?? "#cf4b2c",
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
