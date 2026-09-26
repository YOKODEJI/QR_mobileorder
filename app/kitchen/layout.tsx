import type { Metadata, Viewport } from "next";
import { fetchStoreSettings } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const store = await fetchStoreSettings();
  return { title: store?.storeName ? `${store.storeName} 厨房` : "厨房" };
}

export async function generateViewport(): Promise<Viewport> {
  const store = await fetchStoreSettings();
  return { themeColor: store?.theme ?? "#cf4b2c" };
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
