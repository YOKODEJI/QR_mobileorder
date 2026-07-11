"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { dateLabel, dateTimeLabel } from "@/lib/time";
import type { CheckoutRecord } from "@/store/useAppStore";

export default function CheckoutHistory() {
  const s = useAppStore(
    useShallow((st) => ({
      checkouts: st.checkouts,
      settings: st.settings,
      yen: st.yen,
    }))
  );
  const accent = s.settings.theme;

  // 新しい順（checkouts は先頭が最新）→ 日付でグループ化
  const groups: { date: string; records: CheckoutRecord[]; total: number }[] = [];
  s.checkouts.forEach((r) => {
    const d = dateLabel(r.closedAt);
    let g = groups.find((x) => x.date === d);
    if (!g) {
      g = { date: d, records: [], total: 0 };
      groups.push(g);
    }
    g.records.push(r);
    g.total += r.total;
  });

  const grandTotal = s.checkouts.reduce((sum, r) => sum + r.total, 0);

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* サマリー */}
      <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 800 }}>会計履歴</div>
          <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
            会計済みのセッションを時刻つきで記録しています。
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#8e8e93" }}>累計 {s.checkouts.length}件</div>
          <div style={{ fontSize: "23px", fontWeight: 800, color: accent }}>{s.yen(grandTotal)}</div>
        </div>
      </div>

      {s.checkouts.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "22px", padding: "40px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", textAlign: "center", color: "#8e8e93", fontSize: "15px" }}>
          まだ会計履歴はありません。
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.date} style={{ background: "#fff", borderRadius: "22px", padding: "16px 18px 8px", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
            {/* 日付ヘッダー */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px 10px", borderBottom: "1px solid #f4f4f6", marginBottom: "10px" }}>
              <span style={{ fontSize: "15px", fontWeight: 800 }}>{g.date}</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#8e8e93" }}>
                {g.records.length}件 · <span style={{ color: accent }}>{s.yen(g.total)}</span>
              </span>
            </div>

            {g.records.map((r) => (
              <div key={r.id} style={{ padding: "10px 4px", borderBottom: "1px solid #f7f7f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <span style={{ fontSize: "15px", fontWeight: 700 }}>{r.tableName}</span>
                    <span style={{ fontSize: "12px", color: "#8e8e93", marginLeft: "8px" }}>
                      {dateTimeLabel(r.closedAt)} · {r.count}点
                    </span>
                  </div>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: accent }}>
                    {s.yen(r.total)}
                  </span>
                </div>
                <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                  {r.items.map((it, i) => (
                    <span key={i} style={{ fontSize: "12px", color: "#6b6b70" }}>
                      {it.name} <span style={{ color: "#a0a0a5" }}>×{it.qty}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
