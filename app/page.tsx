import { redirect } from "next/navigation";

// ルート("/")は客用にも管理用にも使わない。
// 客はQRから /order/[table] へ、スタッフはブックマークした /admin へ（ログイン必須）。
// 誤ってドメイン直下に来た場合はログイン画面へ誘導する。
export default function Home() {
  redirect("/admin");
}
