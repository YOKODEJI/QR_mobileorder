"use client";

import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { parseCartKey, optionsLabel, freeOptions, choiceGroups, countSteps } from "@/lib/options";
import Sheet from "@/components/handy/Sheet";
import CountStepper from "@/components/handy/CountStepper";
import { disabledLook, itemName, primaryButton, stepButton, subText, textInput } from "@/components/handy/ui";

/** 送信前の確認。行ごとに数量・チェック（Cドリンクなど）・備考を直してから厨房へ送る */
export default function ReviewSheet({
  tableId,
  sending,
  onSend,
  onClose,
}: {
  tableId: string;
  sending: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  const s = useAppStore(
    useShallow((st) => ({
      menu: st.menu,
      itemOptions: st.itemOptions,
      staffCart: st.staffCart,
      staffNotes: st.staffNotes,
      addStaff: st.addStaff,
      removeStaff: st.removeStaff,
      setStaffNote: st.setStaffNote,
      toggleStaffLineOption: st.toggleStaffLineOption,
      tableName: st.tableName,
    }))
  );
  const cartKeys = Object.keys(s.staffCart);
  const totalQty = cartKeys.reduce((a, k) => a + s.staffCart[k], 0);
  const off = sending || totalQty === 0;

  return (
    <Sheet
      title={`${s.tableName(tableId)} の注文内容`}
      subtitle="数とチェックを確かめてから送信してください"
      onClose={() => !sending && onClose()}
      footer={
        <button onClick={onSend} disabled={off} style={{ ...primaryButton, ...disabledLook(off) }}>
          {sending ? "送信中…" : `厨房へ送信する（${totalQty}点）`}
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {cartKeys.map((k) => {
          const { menuItemId, optionIds } = parseCartKey(k);
          const m = s.menu.find((x) => x.id === menuItemId);
          if (!m) return null;
          const allOpts = s.itemOptions[menuItemId] ?? [];
          const checks = freeOptions(allOpts);
          // 数を合わせる組（グラスの数）は、下に＋−を出してここでも直せるようにする
          const counts = choiceGroups(allOpts)
            .map((g) => ({ group: g.group, count: countSteps(g.options) }))
            .filter((g): g is { group: string; count: NonNullable<ReturnType<typeof countSteps>> } => g.count !== null);
          const countGroups = new Set(counts.map((c) => c.group));
          // 個別のチェックと数は下で見せるので、品名の下には選んだ組（一合／グラス、飲み方）だけ出す
          const chosen = allOpts.filter((o) => o.choiceGroup && !countGroups.has(o.choiceGroup) && optionIds.includes(o.id));
          const label = optionsLabel(chosen.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })));
          return (
            <div
              key={k}
              style={{ background: "var(--surface)", border: "1.5px solid var(--rule)", borderRadius: "8px", padding: "10px 12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={itemName}>{m.name}</span>
                  {label && <span style={{ ...subText, fontSize: "16px", fontWeight: 800, color: "var(--text)" }}>{label}</span>}
                </span>
                <button onClick={() => s.removeStaff(menuItemId, optionIds)} aria-label={`${m.name}を1つ減らす`} style={stepButton}>
                  −
                </button>
                <span style={{ minWidth: "28px", textAlign: "center", fontSize: "22px", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {s.staffCart[k]}
                </span>
                <button onClick={() => s.addStaff(menuItemId, optionIds)} aria-label={`${m.name}を1つ増やす`} style={stepButton}>
                  ＋
                </button>
              </div>
              {counts.map((c) => (
                <div key={c.group} style={{ marginTop: "8px" }}>
                  <CountStepper
                    title={c.group}
                    count={c.count}
                    selectedId={c.count.steps.find((st) => optionIds.includes(st.option.id))?.option.id}
                    onChange={(o) => s.toggleStaffLineOption(menuItemId, optionIds, o.id)}
                  />
                </div>
              ))}
              {checks.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                  {checks.map((o) => {
                    const on = optionIds.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        onClick={() => s.toggleStaffLineOption(menuItemId, optionIds, o.id)}
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${m.name}を${o.name}にする`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          minHeight: "44px",
                          padding: "6px 14px 6px 10px",
                          borderRadius: "8px",
                          border: on ? "2px solid var(--accent)" : "2px solid var(--rule)",
                          background: on ? "var(--accent)" : "var(--surface)",
                          color: on ? "var(--accent-ink)" : "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "16px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: on ? "none" : "2px solid var(--text-3)",
                            background: on ? "var(--accent-ink)" : "transparent",
                            color: "var(--accent)",
                            fontSize: "16px",
                            fontWeight: 900,
                            lineHeight: 1,
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {o.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                value={s.staffNotes[k] ?? ""}
                onChange={(e) => s.setStaffNote(k, e.target.value)}
                maxLength={200}
                placeholder="備考（例: 氷なし、薄めで）"
                aria-label={`${m.name}の備考`}
                enterKeyHint="done"
                style={{ ...textInput, marginTop: "8px", fontWeight: 500 }}
              />
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
