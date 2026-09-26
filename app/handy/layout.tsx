import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  return { title: store?.storeName ? `${store.storeName} ハンディ` : "ハンディ" };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  return { themeColor: store?.theme ?? "#cf4b2c" };
}

export default function HandyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
