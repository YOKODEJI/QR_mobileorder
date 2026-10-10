import { manifestResponse } from "@/lib/manifest";

export async function GET() {
  return manifestResponse({ label: "厨房", path: "/kitchen", app: "kitchen", description: "厨房タブレット用の注文表示" });
}
