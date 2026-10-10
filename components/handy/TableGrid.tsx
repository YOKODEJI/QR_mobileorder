"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { elapsedMin, useNow } from "@/lib/time";
import { fitTableGrid, tableSummary } from "@/lib/handy";
import { BellIcon } from "@/components/ui/Icon";
import { glassPanel, statusTag } from "@/components/handy/ui";

const GAP = 10;
const PAD_X = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;

/** 卓一覧。空席をタップ → 来店受付 → そのまま注文入力へ。着席中をタップ → 卓画面へ。
 *  タイルの大きさと列の数は、卓の数と画面の大きさに合わせる（できるだけスクロール無しで全卓が見えるように）。
 *  着席中は明るい白い面、空席は透けた面で、明るさと言葉の両方で見分ける */
export default function TableGrid({
  onOpenTable,
  onOrder,
}: {
  onOpenTable: (id: string) => void;
  onOrder: (id: string) => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      tables: st.tables,
      orders: st.orders,
      calls: st.calls,
      openTable: st.openTable,
      openDialog: st.openDialog,
      closeDialog: st.closeDialog,
    }))
  );
  const now = useNow();
  // Supabase未設定（ローカル開発）では卓の開閉が無いので、常に着席中として扱う
  const gated = isSupabaseConfigured();

  // 一覧に使える幅と高さ（画面の下端まで）を測る。画面の回転・大きさの変更にも追従する
  const wrap = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const width = el.clientWidth - PAD_X * 2;
      const height = window.innerHeight - top - PAD_TOP - PAD_BOTTOM;
      setArea((a) => (a.width === width && a.height === height ? a : { width, height }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const fit = fitTableGrid(s.tables.length, area.width, area.height, GAP);

  const receive = (id: string, name: string) =>
    s.openDialog({
      title: `${name} の来店受付`,
      body: "お客様を案内した卓を開いて、注文を入れられるようにします。",
      confirmText: "受付して注文へ",
      danger: false,
      onConfirm: async () => {
        s.closeDialog();
        await s.openTable(id);
        // 受付に失敗したら openTable が元に戻してトーストを出すので、開いたときだけ進む
        if (useAppStore.getState().tables.find((t) => t.id === id)?.openSince) onOrder(id);
      },
    });

  return (
    <div ref={wrap} style={{ flex: 1 }}>
      {s.tables.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-2)", fontSize: "16px" }}>
          卓が登録されていません。右上の「卓の編集」から追加してください。
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))`,
            gridAutoRows: `${fit.tileHeight}px`,
            gap: `${GAP}px`,
            padding: `${PAD_TOP}px ${PAD_X}px calc(${PAD_BOTTOM}px + env(safe-area-inset-bottom))`,
          }}
        >
          {s.tables.map((t) => {
            const open = !gated || !!t.openSince;
            const sum = tableSummary(s.orders, t.id);
            const calling = s.calls.some((c) => c.table === t.id);
            const minutes = open && t.openSince && now > 0 ? elapsedMin(t.openSince, now) : null;
            const pending = open && sum.pendingQty > 0;
            return (
              <button
                key={t.id}
                onClick={() => (open ? onOpenTable(t.id) : receive(t.id, t.name))}
                aria-label={`${t.name}（${open ? "着席中" : "空席"}）`}
                style={{
                  position: "relative",
                  minWidth: 0,
                  padding: fit.tileHeight < 100 ? "8px 12px" : "12px 14px",
                  borderRadius: "20px",
                  ...(open
                    ? { ...glassPanel, background: "rgba(255, 255, 255, 0.94)" }
                    : { background: "rgba(255, 255, 255, 0.3)", border: "1px solid var(--glass-edge)" }),
                  // 提供前の注文がある卓は、強調色の枠でも分かるようにする
                  ...(pending ? { border: "2px solid var(--accent)" } : {}),
                  fontFamily: "inherit",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "4px",
                  textAlign: "left",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: `${fit.nameSize}px`,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: open ? "var(--text)" : "var(--text-2)",
                    // 長い卓名（「カウンター A」など）は折り返す
                    overflowWrap: "anywhere",
                  }}
                >
                  {t.name}
                </span>
                {open ? (
                  <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 6px", fontSize: "15px", fontWeight: 700 }}>
                    {pending ? (
                      <span style={{ ...statusTag, padding: "3px 8px", fontSize: "15px", background: "var(--accent)", color: "var(--accent-ink)" }}>
                        提供前 {sum.pendingQty}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-2)" }}>{sum.orderCount > 0 ? "提供済み" : "注文なし"}</span>
                    )}
                    {minutes != null && <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{minutes}分</span>}
                  </span>
                ) : (
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-2)" }}>空席</span>
                )}
                {calling && (
                  <span
                    aria-label="呼び出し中"
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: "var(--amber-dark)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BellIcon size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
