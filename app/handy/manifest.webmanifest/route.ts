import { manifestResponse } from "@/lib/manifest";

export async function GET() {
  return manifestResponse({ label: "ハンディ", path: "/handy", description: "スタッフのスマホから注文を入れるハンディ" });
}
