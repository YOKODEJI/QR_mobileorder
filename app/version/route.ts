// いま公開している版の印（ビルドした時刻）。スタッフの画面（components/UpdateNotice.tsx）が、
// 自分の版と違えば「新しい版があります」と出すために見る。必ずその場で返す（どこにも貯めさせない）
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
