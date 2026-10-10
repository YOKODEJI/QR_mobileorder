"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, type MenuItem } from "@/store/useAppStore";
import { parseCartKey, choiceGroups, countSteps } from "@/lib/options";
import { filterMenu, sortByPopularity, tableRepeatItems, type RepeatItem } from "@/lib/handy";
import { useMenuPopularity } from "@/lib/useMenuPopularity";
import OptionSheet from "@/components/ui/OptionSheet";
import SearchField from "@/components/ui/SearchField";
import CategoryChips from "@/components/ui/CategoryChips";
import Sheet from "@/components/handy/Sheet";
import ReviewSheet from "@/components/handy/ReviewSheet";
import CountChoiceSheet from "@/components/handy/CountChoiceSheet";
import {
  bottomBar,
  choiceButton,
  countBadge,
  itemName,
  primaryButton,
  rowCard,
  sectionTitle,
  statusTag,
  subText,
  tapFeedback,
} from "@/components/handy/ui";

/** 注文入力。種類の切替＋検索で品目を選び、確認画面（ReviewSheet）から送信する。金額は出さない。
 *  同じ商品・同じオプションは1行にまとまり（cartKeyが同じ）、備考もその行単位で持つ。
 *  「どれか1つを選ぶ」オプション（日本酒の一合／グラス、焼酎の飲み方、瓶のグラスの数）は品目を押したときに聞き、
 *  個別のチェック（Cドリンク）は確認画面で行ごとに付ける（普通の品は1回押すだけで入るように） */
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
      setStaffNote: st.setStaffNote,
      submitProxy: st.submitProxy,
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

  const cartKeys = Object.keys(s.staffCart);
  const totalQty = cartKeys.reduce((a, k) => a + s.staffCart[k], 0);
  const qtyOf = (id: string) =>
    cartKeys.reduce((a, k) => (parseCartKey(k).menuItemId === id ? a + s.staffCart[k] : a), 0);

  const add = (menuItemId: string, optionIds: string[] = []) => {
    s.addStaff(menuItemId, optionIds);
    tapFeedback();
  };

  // おかわり: 同じ品・同じ飲み方を1杯足す。前回の備考は、この行にまだ備考が無ければ引き継ぐ
  const repeat = (r: RepeatItem) => {
    if (soldOutIds.has(r.menuItemId)) return;
    add(r.menuItemId, r.optionIds);
    if (r.note && !s.staffNotes[r.key]) s.setStaffNote(r.key, r.note);
  };

  const tapItem = (m: MenuItem) => {
    if (m.soldOut) return;
    if (choiceGroups(s.itemOptions[m.id] ?? []).length > 0) setOptionItem(m);
    else add(m.id);
  };
  const optionItemGroups = optionItem ? choiceGroups(s.itemOptions[optionItem.id] ?? []) : [];
  const optionCount = optionItemGroups.length === 1 ? countSteps(optionItemGroups[0].options) : null;

  const changeCat = (c: string) => {
    setCat(c);
    window.scrollTo({ top: 0 });
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
      {/* 検索と種類の切替は、一覧をスクロールしても上に残す */}
      <div
        style={{
          position: "sticky",
          top: "var(--handy-header-h)",
          zIndex: 10,
          padding: "10px 12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "var(--app-bg)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <SearchField value={query} onChange={setQuery} placeholder="品名で探す（ひらがな可）" />
        {!query && <CategoryChips categories={usedCats} value={cat} onChange={changeCat} />}
      </div>

      <div style={{ padding: "10px 12px 120px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {!query && cat === "すべて" && repeats.length > 0 && (
          <section
            aria-label="おかわり"
            // 入れ子のカードにせず、1つの枠の中を罫線で区切る（帳面の欄のように）
            style={{ marginBottom: "6px", borderRadius: "8px", background: "var(--surface)", border: "1.5px solid var(--accent)", overflow: "hidden" }}
          >
            <h2 style={{ ...sectionTitle, margin: 0, padding: "7px 12px", color: "var(--text)", background: "var(--accent-bg)" }}>
              おかわり（この卓が前に頼んだもの）
            </h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
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
                      ...rowCard,
                      minHeight: "60px",
                      border: "none",
                      borderTop: "1px solid var(--rule)",
                      borderRadius: 0,
                      background: soldOut ? "var(--inset)" : inCart > 0 ? "var(--accent-bg)" : "var(--surface)",
                      cursor: soldOut ? "default" : "pointer",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ ...itemName, color: soldOut ? "var(--text-2)" : "var(--text)", textDecoration: soldOut ? "line-through" : "none" }}>
                        {r.name}
                      </span>
                      {(r.optionsText || r.note) && (
                        <span style={subText}>{[r.optionsText, r.note && `※ ${r.note}`].filter(Boolean).join("　")}</span>
                      )}
                    </span>
                    {soldOut ? (
                      <span style={{ ...statusTag, background: "var(--text)", color: "var(--surface)" }}>売切</span>
                    ) : (
                      <>
                        <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-2)", whiteSpace: "nowrap" }}>前回まで {r.qty}</span>
                        {inCart > 0 ? (
                          <span style={countBadge}>＋{inCart}</span>
                        ) : (
                          <span aria-hidden style={{ ...countBadge, minWidth: "38px", height: "38px", background: "var(--surface)", color: "var(--accent)", border: "2px solid var(--accent)" }}>
                            ＋
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {!query && cat === "すべて" && repeats.length > 0 && <h2 style={{ ...sectionTitle, margin: "6px 2px 0" }}>メニュー（人気順）</h2>}
        {items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-2)", fontSize: "16px", padding: "40px 0" }}>該当する品目がありません</div>
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
                ...rowCard,
                border: q > 0 ? "2.5px solid var(--accent)" : rowCard.border,
                background: m.soldOut ? "var(--inset)" : q > 0 ? "var(--accent-bg)" : "var(--surface)",
                cursor: m.soldOut ? "default" : "pointer",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...itemName, color: m.soldOut ? "var(--text-2)" : "var(--text)", textDecoration: m.soldOut ? "line-through" : "none" }}>
                  {m.name}
                </span>
                {(query || cat === "すべて") && <span style={subText}>{m.cat}</span>}
              </span>
              {m.soldOut ? (
                <span style={{ ...statusTag, background: "var(--text)", color: "var(--surface)" }}>売切</span>
              ) : (
                q > 0 && <span style={countBadge}>{q}</span>
              )}
            </button>
          );
        })}
      </div>

      {totalQty > 0 && (
        <div style={bottomBar}>
          <button
            onClick={() => setReviewing(true)}
            style={{ ...primaryButton, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
          >
            注文内容を確認する
            <span style={{ ...countBadge, background: "var(--accent-ink)", color: "var(--accent)", minWidth: "auto", height: "30px", fontSize: "16px" }}>
              {totalQty}点
            </span>
          </button>
        </div>
      )}

      {/* 数を合わせる組（瓶のグラスの数）は、＋−で合わせてから入れる */}
      {optionItem && optionCount && (
        <CountChoiceSheet
          itemName={optionItem.name}
          title={optionItemGroups[0].group}
          count={optionCount}
          onClose={() => setOptionItem(null)}
          onAdd={(optionId) => {
            add(optionItem.id, [optionId]);
            setOptionItem(null);
          }}
        />
      )}

      {/* 選ぶ組が1つだけ（一合／グラス、飲み方）なら、押した時点でそのまま入れる */}
      {optionItem && optionItemGroups.length === 1 && !optionCount && (
        <Sheet title={optionItem.name} subtitle={`${optionItemGroups[0].group}を選んでください`} onClose={() => setOptionItem(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", paddingBottom: "4px" }}>
            {optionItemGroups[0].options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  add(optionItem.id, [o.id]);
                  setOptionItem(null);
                }}
                style={choiceButton}
              >
                {o.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* 選ぶ組が複数ある品は、共通のオプション選択シートで */}
      {optionItem && optionItemGroups.length !== 1 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <OptionSheet
            item={optionItem}
            options={s.itemOptions[optionItem.id] ?? []}
            accent={s.theme}
            yen={s.yen}
            hidePrice
            onClose={() => setOptionItem(null)}
            onAdd={(optionIds) => {
              add(optionItem.id, optionIds);
              setOptionItem(null);
            }}
          />
        </div>
      )}

      {reviewing && <ReviewSheet tableId={tableId} sending={sending} onSend={send} onClose={() => setReviewing(false)} />}
    </div>
  );
}
