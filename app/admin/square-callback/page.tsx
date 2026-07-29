import AdminAuthGate from "@/components/auth/AdminAuthGate";
import SquareCallback from "@/components/staff/SquareCallback";

// Square POSアプリが決済結果を返してくる戻り先ページ(step19)。
// ここで初めて当店側の会計を確定する（決済が成功して戻ってきた場合のみ）。
export default function SquareCallbackPage() {
  return (
    <AdminAuthGate>
      <SquareCallback />
    </AdminAuthGate>
  );
}
