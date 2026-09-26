import { manifestResponse } from "@/lib/manifest";

// PWA用マニフェスト（管理画面専用。scope/start_urlを/adminに限定し、
// 客用ページ(/order/[table])ではインストール対象にならないようにする）。
// 店舗名・テーマ色はDBから取得し、店舗ごとに自動で反映される（コード変更不要）。
export async function GET() {
  return manifestResponse({
    label: "管理画面",
    path: "/admin",
    description: "厨房・会計・メニュー管理をまとめた店舗用管理ツール",
  });
}
