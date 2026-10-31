"use client";

import { Fragment, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, type MenuItem } from "@/store/useAppStore";
import { parseCartKey, choiceGroups, countSteps, optionsLabel, splitCountOptions } from "@/lib/options";
import { filterMenu, sortByPopularity, tableRepeatItems, type RepeatItem } from "@/lib/handy";
import { useMenuPopularity } from "@/lib/useMenuPopularity";
import { useSwipePager } from "@/lib/useSwipePager";
import OptionSheet from "@/components/ui/OptionSheet";
import SearchField from "@/components/ui/SearchField";
import CategoryChips from "@/components/ui/CategoryChips";
import Sheet from "@/components/handy/Sheet";
import ReviewSheet from "@/components/handy/ReviewSheet";
import CountChoiceSheet from "@/components/handy/CountChoiceSheet";
import CountStepper from "@/components/handy/CountStepper";
import QtyStepper from "@/components/handy/QtyStepper";
import type { SentLine } from "@/components/handy/SentView";
import {
  bottomBar,
  card,
  choiceButton,
  countBadge,
  glassBar,
  itemName,
  primaryButton,
  sectionTitle,
  statusTag,
  subText,
  tapFeedback,
} from "@/components/handy/ui";

/** 行の中の「押すと1つ入る」部分（品名の側）。行そのものは枠だけで、− ＋ は隣に別のボタンとして置く */
const rowTap: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: "64px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px 10px 14px",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontFamily: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

/** まだ入れていない行の右端に出す「＋」の目印 */
const plusHint: React.CSSProperties = {
  ...countBadge,
  minWidth: "38px",
  height: "38px",
  background: "transparent",
  color: "var(--accent)",
  border: "2px solid var(--accent)",
};

/** 注文入力。種類の切替＋検索で品目を選び、確認画面（ReviewSheet）から送信する。金額は出さない。
 *  同じ商品・同じオプションは1行にまとまり（cartKeyが同じ）、備考もその行単位で持つ。
 *  品名を押すと1つ入る。入れたあとは行の − ＋ でも数を合わせられる（お客様の注文画面と同じ）。
 *  「どれか1つを選ぶ」オプション（日本酒の一合／グラス、焼酎の飲み方、瓶のグラスの数）は品目を押したときに聞き、
 *  個別のチェック（Cドリンク）は確認画面で行ごとに付ける（普通の品は1回押すだけで入るように） */
export default function OrderEntry({ tableId, onSent }: { tableId: string; onSent: (lines: SentLine[]) => void }) {
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
      toggleStaffLineOption: st.toggleStaffLineOption,
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
  const itemsFor = (c: string) => sortByPopularity(filterMenu(s.menu, c, query), popularity);
  const repeats = tableRepeatItems(s.orders, tableId, s.itemOptions);
  const soldOutIds = new Set(s.menu.filter((m) => m.soldOut).map((m) => m.id));

  const cartKeys = Object.keys(s.staffCart);
  const totalQty = cartKeys.reduce((a, k) => a + s.staffCart[k], 0);
  /** この品の「数を合わせる組」（瓶に付けるグラスの数）。品の数とは別の数なので、行でも別の ＋− で出す */
  const countGroupsOf = (id: string) =>
    choiceGroups(s.itemOptions[id] ?? [])
      .map((g) => ({ group: g.group, count: countSteps(g.options) }))
      .filter((g): g is { group: string; count: NonNullable<ReturnType<typeof countSteps>> } => g.count !== null);
  /** 入力中の注文のうち、この品の行（飲み方などの組み合わせごとに1行）。label には数を合わせる組を含めない */
  const linesOf = (id: string) => {
    const countIds = new Set(countGroupsOf(id).flatMap((g) => g.count.steps.map((st) => st.option.id)));
    return cartKeys
      .map((key) => ({ key, ...parseCartKey(key) }))
      .filter((l) => l.menuItemId === id)
      .map((l) => {
        const otherIds = l.optionIds.filter((o) => !countIds.has(o));
        return {
          ...l,
          otherIds,
          qty: s.staffCart[l.key],
          label: optionsLabel(
            (s.itemOptions[id] ?? []).filter((o) => otherIds.includes(o.id)).map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta }))
          ),
        };
      });
  };

  const add = (menuItemId: string, optionIds: string[] = [], qty = 1) => {
    for (let i = 0; i < qty; i++) s.addStaff(menuItemId, optionIds);
    tapFeedback();
  };

  // 本体の数と付ける数（瓶とグラス）を足す。すでに入力中の行があれば、別の行にせず、本体もグラスもそこへ足す
  // （「瓶2本・グラス3個」が、行の中で2つの数として並ぶように）
  const addCounted = (m: MenuItem, optionId: string, qty: number) => {
    const group = countGroupsOf(m.id)[0];
    const existing = linesOf(m.id).find((l) => l.otherIds.length === 0);
    if (!group || !existing) {
      add(m.id, [optionId], qty);
      return;
    }
    const steps = group.count.steps;
    const current = steps.find((st) => existing.optionIds.includes(st.option.id));
    const sum = (current?.value ?? 0) + (steps.find((st) => st.option.id === optionId)?.value ?? 0);
    // 用意されている数の中で、合計を超えないいちばん大きい数にする
    const target = steps.filter((st) => st.value <= sum).pop() ?? steps[0];
    add(m.id, existing.optionIds, qty);
    if (target.option.id !== current?.option.id) s.toggleStaffLineOption(m.id, existing.optionIds, target.option.id);
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
  // 左右スライドで隣の種類へ（お客様の注文画面・管理画面と同じ動き。隣の一覧が指について入ってくる）。
  // 検索中は種類の切替が無いので、スライドも止める
  const pager = useSwipePager({ items: ["すべて", ...usedCats], current: cat, onChange: changeCat });
  const pages = (render: (c: string) => React.ReactNode) => (query ? render(cat) : pager.wrap(render));

  const send = async () => {
    if (sending) return;
    setSending(true);
    // 送る内容の控え（送信が済むと入力中の注文は空になるので、先に取っておく）
    const sent: SentLine[] = cartKeys.flatMap((k) => {
      const { menuItemId, optionIds } = parseCartKey(k);
      const m = s.menu.find((x) => x.id === menuItemId);
      if (!m) return [];
      const defs = s.itemOptions[menuItemId] ?? [];
      const split = splitCountOptions(defs, defs.filter((o) => optionIds.includes(o.id)));
      return [
        {
          name: m.name,
          optionsText: split.rest.map((o) => o.name).join("・"),
          counts: split.counts,
          note: s.staffNotes[k] ?? "",
          qty: s.staffCart[k],
        },
      ];
    });
    const ok = await s.submitProxy();
    setSending(false);
    if (ok) {
      setReviewing(false);
      onSent(sent);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* 検索と種類の切替は、一覧をスクロールしても上に残す */}
      <div
        style={{
          ...glassBar,
          position: "sticky",
          top: "var(--handy-header-h)",
          zIndex: 10,
          padding: "10px 12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          borderBottom: "1px solid var(--glass-edge)",
        }}
      >
        <SearchField value={query} onChange={setQuery} placeholder="品名で探す（ひらがな可）" />
        {!query && <CategoryChips categories={usedCats} value={cat} onChange={changeCat} />}
      </div>

      <div {...(query ? {} : pager.handlers)} style={{ flex: 1, padding: "10px 12px 120px" }}>
        {pages((c) => {
          const items = itemsFor(c);
          return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {!query && c === "すべて" && repeats.length > 0 && (
          <section
            aria-label="おかわり"
            // 入れ子のカードにせず、1つの面の中を線で区切る
            style={{ ...card, marginBottom: "6px", border: "1.5px solid var(--accent)", overflow: "hidden" }}
          >
            <h2 style={{ ...sectionTitle, margin: 0, padding: "8px 14px", color: "var(--text)", background: "var(--accent-bg)" }}>
              おかわり
            </h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {repeats.map((r) => {
                const soldOut = soldOutIds.has(r.menuItemId);
                const inCart = s.staffCart[r.key] ?? 0;
                const name = `${r.name}${r.optionsText ? "・" + r.optionsText : ""}`;
                return (
                  <div
                    key={r.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingRight: inCart > 0 ? "10px" : 0,
                      borderTop: "1px solid var(--rule)",
                      background: soldOut ? "var(--chip-tint)" : inCart > 0 ? "var(--accent-bg)" : "transparent",
                    }}
                  >
                    <button
                      onClick={() => repeat(r)}
                      disabled={soldOut}
                      aria-label={soldOut ? `${r.name}（売切）` : `${name}をおかわり`}
                      style={{ ...rowTap, minHeight: "60px", cursor: soldOut ? "default" : "pointer" }}
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
                        <span style={{ ...statusTag, background: "var(--text)", color: "#fff" }}>売切</span>
                      ) : (
                        inCart === 0 && (
                          <span aria-hidden style={plusHint}>
                            ＋
                          </span>
                        )
                      )}
                    </button>
                    {!soldOut && inCart > 0 && (
                      <QtyStepper qty={inCart} label={name} onDec={() => s.removeStaff(r.menuItemId, r.optionIds)} onInc={() => repeat(r)} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {!query && c === "すべて" && repeats.length > 0 && <h2 style={{ ...sectionTitle, margin: "6px 2px 0" }}>メニュー（人気順）</h2>}
        {items.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-2)", fontSize: "16px", padding: "40px 0" }}>該当する品目がありません</div>
        )}
        {items.map((m) => {
          const lines = linesOf(m.id);
          const counts = countGroupsOf(m.id);
          const q = lines.reduce((a, l) => a + l.qty, 0);
          // 飲み方などの違いが無い品は、行の右で − ＋。違いがある品は、下に組み合わせごとの行を出す
          const plain = lines.length === 1 && lines[0].otherIds.length === 0;
          const inline = plain && !m.soldOut;
          return (
            <div
              key={m.id}
              style={{
                ...card,
                overflow: "hidden",
                ...(q > 0 ? { border: "2px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 9%, #fff)" } : {}),
                ...(m.soldOut ? { background: "rgba(255, 255, 255, 0.4)", boxShadow: "none" } : {}),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", paddingRight: inline ? "10px" : 0 }}>
                <button
                  onClick={() => tapItem(m)}
                  disabled={m.soldOut}
                  aria-label={m.soldOut ? `${m.name}（売切）` : `${m.name}を追加`}
                  style={{ ...rowTap, cursor: m.soldOut ? "default" : "pointer" }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...itemName, color: m.soldOut ? "var(--text-2)" : "var(--text)", textDecoration: m.soldOut ? "line-through" : "none" }}>
                      {m.name}
                    </span>
                    {(query || c === "すべて") && <span style={subText}>{m.cat}</span>}
                  </span>
                  {m.soldOut ? (
                    <span style={{ ...statusTag, background: "var(--text)", color: "#fff" }}>売切</span>
                  ) : inline ? null : q > 0 ? (
                    <span style={countBadge}>計{q}</span>
                  ) : (
                    <span aria-hidden style={plusHint}>
                      ＋
                    </span>
                  )}
                </button>
                {inline && <QtyStepper qty={q} label={m.name} onDec={() => s.removeStaff(m.id)} onInc={() => add(m.id)} />}
              </div>
              {!m.soldOut &&
                lines.map((l) => (
                  <Fragment key={l.key}>
                    {!plain && (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px 6px 14px", borderTop: "1px solid var(--rule)" }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: "16px", fontWeight: 800 }}>{l.label || "そのまま"}</span>
                        <QtyStepper
                          qty={l.qty}
                          label={`${m.name}（${l.label || "そのまま"}）`}
                          onDec={() => s.removeStaff(m.id, l.optionIds)}
                          onInc={() => add(m.id, l.optionIds)}
                        />
                      </div>
                    )}
                    {/* グラスの数は、品の数とは別の ＋− で（この行ぜんぶでの数） */}
                    {counts.map((c) => (
                      <div key={c.group} style={{ padding: "0 10px 8px" }}>
                        <CountStepper
                          title={c.group}
                          count={c.count}
                          selectedId={c.count.steps.find((st) => l.optionIds.includes(st.option.id))?.option.id}
                          onChange={(o) => s.toggleStaffLineOption(m.id, l.optionIds, o.id)}
                        />
                      </div>
                    ))}
                  </Fragment>
                ))}
            </div>
          );
        })}
      </div>
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

      {/* 数を合わせる組（瓶のグラスの数）は、本体の数とあわせて＋−で合わせてから入れる */}
      {optionItem && optionCount && (
        <CountChoiceSheet
          itemName={optionItem.name}
          title={optionItemGroups[0].group}
          count={optionCount}
          onClose={() => setOptionItem(null)}
          onAdd={(optionId, qty) => {
            addCounted(optionItem, optionId, qty);
            setOptionItem(null);
          }}
        />
      )}

      {/* 選ぶ組が1つだけ（一合／グラス、飲み方）なら、押した時点でそのまま入れる */}
      {optionItem && optionItemGroups.length === 1 && !optionCount && (
        <Sheet title={optionItem.name} onClose={() => setOptionItem(null)}>
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
