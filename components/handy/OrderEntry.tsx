"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, type MenuItem } from "@/store/useAppStore";
import { parseCartKey, optionsLabel } from "@/lib/options";
import { filterMenu, sortByPopularity, tableRepeatItems, type RepeatItem } from "@/lib/handy";
import { useMenuPopularity } from "@/lib/useMenuPopularity";
import OptionSheet from "@/components/ui/OptionSheet";

/** 注文入力。種類の切替＋検索で品目を選び、確認画面（数量・備考）から送信する。金額は出さない。
 *  同じ商品・同じオプションは1行にまとまり（cartKeyが同じ）、備考もその行単位で持つ */
export default function OrderEntry({ tableId, onSent }: { tableId: string; onSent: () => void }) {
  const s = useAppStore(
    useShallow((st) => ({
      menu: st.menu,
      orders: st.orders,
      categories: st.categories,
      itemOptions: st.itemOptions,
      staffCart: st.staffCart,
      staffNotes: st.staffNotes,
      addStaff: st.addStaff,
      removeStaff: st.removeStaff,
      setStaffNote: st.setStaffNote,
      submitProxy: st.submitProxy,
      tableName: st.tableName,
      yen: st.yen,
      theme: st.settings.theme,
    }))
  );
  const [cat, setCat] = useState("すべて");
  const [query, setQuery] = useState("");
  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const popularity = useMenuPopularity();
  const usedCats = s.categories.filter((c) => s.menu.some((m) => m.cat === c));
  // 店全体の人気順（画面を開いた時点の順で固定。押している最中に並びが動かないように）
  const items = sortByPopularity(filterMenu(s.menu, cat, query), popularity);
  const repeats = tableRepeatItems(s.orders, tableId);
  const soldOutIds = new Set(s.menu.filter((m) => m.soldOut).map((m) => m.id));

  // おかわり: 同じ品・同じ飲み方を1杯足す。前回の備考は、この行にまだ備考が無ければ引き継ぐ
  const repeat = (r: RepeatItem) => {
    if (soldOutIds.has(r.menuItemId)) return;
    s.addStaff(r.menuItemId, r.optionIds);
    if (r.note && !s.staffNotes[r.key]) s.setStaffNote(r.key, r.note);
  };
  const cartKeys = Object.keys(s.staffCart);
  const totalQty = cartKeys.reduce((a, k) => a + s.staffCart[k], 0);
  const qtyOf = (id: string) =>
    cartKeys.reduce((a, k) => (parseCartKey(k).menuItemId === id ? a + s.staffCart[k] : a), 0);

  const tapItem = (m: MenuItem) => {
    if (m.soldOut) return;
    if ((s.itemOptions[m.id] ?? []).length > 0) setOptionItem(m);
    else s.addStaff(m.id);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    const ok = await s.submitProxy();
    setSending(false);
    if (ok) {
      setReviewing(false);
      onSent();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ padding: "10px 12px 8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="品名で探す（ひらがな可）"
          aria-label="品名で探す"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "none",
            background: "var(--hairline)",
            fontSize: "16px",
            fontFamily: "inherit",
            color: "var(--text)",
          }}
        />
        {!query && (
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
            {["すべて", ...usedCats].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: "999px",
                  border: "none",
                  background: cat === c ? "var(--accent)" : "var(--control-tint)",
                  color: cat === c ? "var(--accent-ink)" : "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "4px 12px 110px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {!query && repeats.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-2)", margin: "2px 2px 6px" }}>
              この卓の注文（タップでおかわり）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {repeats.map((r) => {
                const soldOut = soldOutIds.has(r.menuItemId);
                const inCart = s.staffCart[r.key] ?? 0;
                return (
                  <button
                    key={r.key}
                    onClick={() => repeat(r)}
                    disabled={soldOut}
                    aria-label={soldOut ? `${r.name}（売切）` : `${r.name}${r.optionsText ? "・" + r.optionsText : ""}をおかわり`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minHeight: "52px",
                      padding: "8px 14px",
                      borderRadius: "14px",
                      border: inCart > 0 ? "2px solid var(--accent)" : "1px dashed var(--accent)",
                      background: soldOut ? "var(--hairline)" : "var(--chip-tint)",
                      fontFamily: "inherit",
                      textAlign: "left",
                      cursor: soldOut ? "default" : "pointer",
                      width: "100%",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "16px",
                          fontWeight: 700,
                          color: soldOut ? "var(--text-3)" : "var(--text)",
                        }}
                      >
                        {r.name}
                      </span>
                      {(r.optionsText || r.note) && (
                        <span style={{ fontSize: "12px", color: "var(--text-2)" }}>
                          {[r.optionsText, r.note && `※ ${r.note}`].filter(Boolean).join("　")}
                        </span>
                      )}
                    </span>
                    {soldOut ? (
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--red-dark)" }}>売切</span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        これまで{r.qty}
                        {inCart > 0 && (
                          <strong style={{ marginLeft: "6px", fontSize: "15px", color: "var(--accent)" }}>＋{inCart}</strong>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-2)", margin: "14px 2px 0" }}>
              メニュー（人気順）
            </div>
          </div>
        )}
        {items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-2)", padding: "40px 0" }}>該当する品目がありません</div>
        )}
        {items.map((m) => {
          const q = qtyOf(m.id);
          return (
            <button
              key={m.id}
              onClick={() => tapItem(m)}
              disabled={m.soldOut}
              aria-label={m.soldOut ? `${m.name}（売切）` : `${m.name}を追加`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minHeight: "56px",
                padding: "10px 14px",
                borderRadius: "14px",
                border: q > 0 ? "2px solid var(--accent)" : "none",
                background: m.soldOut ? "var(--hairline)" : "var(--surface)",
                boxShadow: m.soldOut ? "none" : "0 1px 5px rgba(0,0,0,.05)",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: m.soldOut ? "default" : "pointer",
                width: "100%",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: m.soldOut ? "var(--text-3)" : "var(--text)",
                  }}
                >
                  {m.name}
                </span>
                {query && <span style={{ fontSize: "12px", color: "var(--text-2)" }}>{m.cat}</span>}
              </span>
              {m.soldOut ? (
                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--red-dark)" }}>売切</span>
              ) : (
                q > 0 && (
                  <span
                    style={{
                      minWidth: "30px",
                      height: "30px",
                      borderRadius: "999px",
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      fontSize: "15px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 8px",
                    }}
                  >
                    {q}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {totalQty > 0 && (
        <div style={bottomBar}>
          <button onClick={() => setReviewing(true)} style={primaryButton}>
            確認して送信（{totalQty}点）
          </button>
        </div>
      )}

      {optionItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <OptionSheet
            item={optionItem}
            options={s.itemOptions[optionItem.id] ?? []}
            accent={s.theme}
            yen={s.yen}
            hidePrice
            onClose={() => setOptionItem(null)}
            onAdd={(optionIds) => {
              s.addStaff(optionItem.id, optionIds);
              setOptionItem(null);
            }}
          />
        </div>
      )}

      {reviewing && (
        <div
          onClick={() => !sending && setReviewing(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,.32)",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxHeight: "86dvh",
              overflowY: "auto",
              background: "var(--glass-strong)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderTop: "1px solid var(--glass-edge)",
              borderRadius: "24px 24px 0 0",
              padding: "16px 14px calc(16px + env(safe-area-inset-bottom))",
              animation: "sheetup .3s ease-out",
            }}
          >
            <div style={{ fontSize: "19px", fontWeight: 800, marginBottom: "10px" }}>
              {s.tableName(tableId)} に送信
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cartKeys.map((k) => {
                const { menuItemId, optionIds } = parseCartKey(k);
                const m = s.menu.find((x) => x.id === menuItemId);
                if (!m) return null;
                const opts = (s.itemOptions[menuItemId] ?? []).filter((o) => optionIds.includes(o.id));
                const label = optionsLabel(opts.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })));
                return (
                  <div
                    key={k}
                    style={{ background: "var(--surface)", borderRadius: "14px", padding: "10px 12px" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "16px", fontWeight: 700 }}>{m.name}</span>
                        {label && <span style={{ fontSize: "13px", color: "var(--text-2)" }}>{label}</span>}
                      </span>
                      <button
                        onClick={() => s.removeStaff(menuItemId, optionIds)}
                        aria-label={`${m.name}を1つ減らす`}
                        style={stepButton}
                      >
                        −
                      </button>
                      <span style={{ minWidth: "24px", textAlign: "center", fontSize: "18px", fontWeight: 800 }}>
                        {s.staffCart[k]}
                      </span>
                      <button
                        onClick={() => s.addStaff(menuItemId, optionIds)}
                        aria-label={`${m.name}を1つ増やす`}
                        style={stepButton}
                      >
                        ＋
                      </button>
                    </div>
                    <input
                      value={s.staffNotes[k] ?? ""}
                      onChange={(e) => s.setStaffNote(k, e.target.value)}
                      maxLength={200}
                      placeholder="備考（例: お湯割り、氷なし）"
                      aria-label={`${m.name}の備考`}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "var(--hairline)",
                        fontSize: "16px",
                        fontFamily: "inherit",
                        color: "var(--text)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <button
              onClick={send}
              disabled={sending || totalQty === 0}
              style={{ ...primaryButton, marginTop: "14px", opacity: sending ? 0.6 : 1 }}
            >
              {sending ? "送信中…" : `厨房へ送信（${totalQty}点）`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const bottomBar: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
  padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
  background: "var(--glass)",
  backdropFilter: "blur(26px) saturate(180%)",
  WebkitBackdropFilter: "blur(26px) saturate(180%)",
  borderTop: "1px solid var(--glass-edge)",
};

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  borderRadius: "16px",
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontFamily: "inherit",
  fontSize: "17px",
  fontWeight: 800,
  cursor: "pointer",
};

const stepButton: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  border: "none",
  background: "var(--control-tint)",
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: "20px",
  fontWeight: 800,
  cursor: "pointer",
};
