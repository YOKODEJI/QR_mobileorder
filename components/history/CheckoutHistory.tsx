"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { dateLabel, dateTimeLabel } from "@/lib/time";
import type { CheckoutRecord } from "@/store/useAppStore";

const DISCOUNT_LABEL = { percent: "%割引", amount: "円引き" } as const;

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        transition: "transform .18s ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        color: "var(--text-3)",
        fontSize: "13px",
        fontWeight: 800,
      }}
    >
      ▸
    </span>
  );
}

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

  // トップのサマリーは「その日（今日）」の合算。今日の記録が無ければ0件・¥0。
  const todayLabel = dateLabel(new Date().toISOString());
  const todayGroup = groups.find((g) => g.date === todayLabel);
  const todayTotal = todayGroup?.total ?? 0;
  const todayCount = todayGroup?.records.length ?? 0;

  // 日付の開閉（既定: 最新日付のみ開く）／ テーブル行の開閉（既定: 全て閉じる＝明細は折りたたみ）
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [openRecords, setOpenRecords] = useState<Set<string>>(new Set());
  const seededDate = useRef<string | null>(null);
  useEffect(() => {
    const latest = groups[0]?.date;
    if (latest && seededDate.current !== latest) {
      seededDate.current = latest;
      setOpenDates((prev) => new Set(prev).add(latest));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups[0]?.date]);

  const toggleDate = (d: string) =>
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  const toggleRecord = (id: string) =>
    setOpenRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* サマリー */}
      <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 800 }}>会計履歴</div>
          <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" }}>
            会計済みのセッションを時刻つきで記録しています。日付・テーブルをタップで開閉できます。
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "var(--text-2)" }}>本日 {todayCount}件</div>
          <div style={{ fontSize: "23px", fontWeight: 800, color: accent }}>{s.yen(todayTotal)}</div>
        </div>
      </div>

      {s.checkouts.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "22px", padding: "40px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", textAlign: "center", color: "var(--text-2)", fontSize: "15px" }}>
          まだ会計履歴はありません。
        </div>
      ) : (
        groups.map((g) => {
          const dateOpen = openDates.has(g.date);
          return (
            <div key={g.date} style={{ background: "#fff", borderRadius: "22px", overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
              {/* 日付ヘッダー（タップで開閉） */}
              <button
                onClick={() => toggleDate(g.date)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 18px",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Chevron open={dateOpen} />
                  <span style={{ fontSize: "15px", fontWeight: 800 }}>{g.date}</span>
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                  {g.records.length}件 · <span style={{ color: accent }}>{s.yen(g.total)}</span>
                </span>
              </button>

              {dateOpen && (
                <div style={{ borderTop: "1px solid #f4f4f6", padding: "4px 10px 10px" }}>
                  {g.records.map((r) => {
                    const recOpen = openRecords.has(r.id);
                    return (
                      <div key={r.id} style={{ borderBottom: "1px solid #f7f7f9" }}>
                        <button
                          onClick={() => toggleRecord(r.id)}
                          style={{
                            width: "100%",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 8px",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <Chevron open={recOpen} />
                            <span>
                              <span style={{ fontSize: "15px", fontWeight: 700 }}>{r.tableName}</span>
                              <span style={{ fontSize: "12px", color: "var(--text-2)", marginLeft: "8px" }}>
                                {dateTimeLabel(r.closedAt)} · {r.count}点
                              </span>
                            </span>
                          </span>
                          <span style={{ fontSize: "17px", fontWeight: 800, color: accent, flexShrink: 0, marginLeft: "10px" }}>
                            {s.yen(r.total)}
                          </span>
                        </button>
                        {recOpen && (
                          <div style={{ padding: "0 8px 12px 30px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {r.items.map((it, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "13px",
                                  color: "var(--text-2)",
                                }}
                              >
                                <span>
                                  {it.name} <span style={{ color: "var(--text-3)" }}>×{it.qty}</span>
                                </span>
                                <span>{s.yen(it.price * it.qty)}</span>
                              </div>
                            ))}
                            {(r.discountAmount > 0 || r.chargeAmount > 0 || r.taxAmount > 0) && (
                              <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #ececee", display: "flex", flexDirection: "column", gap: "3px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-3)" }}>
                                  <span>小計</span>
                                  <span>{s.yen(r.subtotal)}</span>
                                </div>
                                {r.discountAmount > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--red)" }}>
                                    <span>
                                      割引{r.discountType ? `（${r.discountValue}${DISCOUNT_LABEL[r.discountType]}）` : ""}
                                    </span>
                                    <span>−{s.yen(r.discountAmount)}</span>
                                  </div>
                                )}
                                {r.chargeAmount > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-3)" }}>
                                    <span>チャージ料</span>
                                    <span>+{s.yen(r.chargeAmount)}</span>
                                  </div>
                                )}
                                {r.taxAmount > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-3)" }}>
                                    <span>消費税</span>
                                    <span>+{s.yen(r.taxAmount)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
