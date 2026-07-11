import CustomerShell from "@/components/CustomerShell";

// 客用の独立ページ（QRの遷移先）。[table] は卓の識別子（当面は番号/名前/id）。
export default async function OrderPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  return <CustomerShell table={table} />;
}
