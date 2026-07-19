"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import ChipRow from "@/components/ui/ChipRow";
import Toggle from "@/components/ui/Toggle";
import { proxyCardStyle, proxyAddStyle, proxySubStyle, addBtnStyle } from "@/lib/styles";
import { computeCheckoutBreakdown, type DiscountType } from "@/lib/pricing";

export default function StaffCheckout() {
  const s = useAppStore(
    useShallow((st) => ({
      addStaff: st.addStaff,
      addTable: st.addTable,
      addUnit: st.addUnit,
      avail: st.avail,
      cancelUnit: st.cancelUnit,
      confirmCheckout: st.confirmCheckout,
      confirmDeleteTable: st.confirmDeleteTable,
      confirmFinishOrderEdit: st.confirmFinishOrderEdit,
      dragEndTable: st.dragEndTable,
      dragStartTable: st.dragStartTable,
      dragTableId: st.dragTableId,
      dropOnTable: st.dropOnTable,
      editTableName: st.editTableName,
      editingTableId: st.editingTableId,
      justAddedTableId: st.justAddedTableId,
      menu: st.menu,
      orderEditMode: st.orderEditMode,
      orders: st.orders,
      proxyCat: st.proxyCat,
      removeStaff: st.removeStaff,
      saveEditTable: st.saveEditTable,
      selectStaffTable: st.selectStaffTable,
      selectedStaffTable: st.selectedStaffTable,
      setEditTableName: st.setEditTableName,
      setOrderEditMode: st.setOrderEditMode,
      setProxyCat: st.setProxyCat,
      setTableEditMode: st.setTableEditMode,
      settings: st.settings,
      staffCart: st.staffCart,
      startEditTable: st.startEditTable,
      submitProxy: st.submitProxy,
      tableEditMode: st.tableEditMode,
      tableName: st.tableName,
      tables: st.tables,
      yen: st.yen,
    }))
  );
  const accent = s.settings.theme;
  const photoById: Record<string, string> = {};
  s.menu.forEach((m) => {
    if (m.photo) photoById[m.id] = m.photo;
  });

  const tableTotal = (id: string) =>
    s.orders
      .filter((o) => o.table === id)
      .reduce((sum, o) => sum + o.items.reduce((t, it) => t + it.price * it.qty, 0), 0);
  const tableCount = (id: string) =>
    s.orders
      .filter((o) => o.table === id)
      .reduce((c, o) => c + o.items.reduce((t, it) => t + it.qty, 0), 0);

  const sel = s.selectedStaffTable;
  const selOrders = sel != null ? s.orders.filter((o) => o.table === sel) : [];

  // 割引はその場入力、チャージ料は設定の料率を使うがオンオフはその場で選べる（テーブルを切り替えたらリセット）。
  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [chargeEnabled, setChargeEnabled] = useState(true);
  useEffect(() => {
    setDiscountType(null);
    setDiscountValue("");
    setChargeEnabled(true);
  }, [sel]);

  // 明細を商品ID＋単価で集約（名前一致に依存しない。会期中の値変更にも安全）
  const agg: Record<
    string,
    { menuItemId: string; name: string; price: number; qty: number; proxy: boolean }
  > = {};
  selOrders.forEach((o) => {
    o.items.forEach((it) => {
      const k = it.menuItemId + ":" + it.price;
      if (!agg[k])
        agg[k] = { menuItemId: it.menuItemId, name: it.name, price: it.price, qty: 0, proxy: false };
      agg[k].qty += it.qty;
      if (o.proxy) agg[k].proxy = true;
    });
  });
  const aggList = Object.values(agg);
  const selTotal = sel != null ? tableTotal(sel) : 0;
  const discountNum = parseFloat(discountValue) || 0;
  const breakdown = computeCheckoutBreakdown(
    selTotal,
    discountType,
    discountNum,
    chargeEnabled ? s.settings.chargeRate : 0,
    s.settings.taxMode,
    s.settings.taxRate
  );

  const proxyFiltered = s.menu.filter(
    (m) => s.proxyCat === "すべて" || m.cat === s.proxyCat
  );
  const proxyCount = Object.values(s.staffCart).reduce((a, b) => a + b, 0);

  // 追加直後の卓は視認性のため先頭にピン留め（確定すると本来の並び＝末尾へ）
  const orderedTables = (() => {
    const pinnedId = s.justAddedTableId;
    if (pinnedId == null) return s.tables;
    const pinned = s.tables.find((t) => t.id === pinnedId);
    if (!pinned) return s.tables;
    return [pinned, ...s.tables.filter((t) => t.id !== pinnedId)];
  })();

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* テーブル一覧（3列グリッド） */}
        <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "22px", padding: "16px 18px", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "6px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800 }}>テーブル一覧</span>
            {s.tableEditMode ? (
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={s.addTable}
                  style={{
                    border: "none",
                    background: "var(--control-tint)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  ＋ 追加
                </button>
                <button
                  onClick={() => s.setTableEditMode(false)}
                  style={{
                    border: "none",
                    background: accent,
                    borderRadius: "999px",
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    color: "#fff",
                  }}
                >
                  完了
                </button>
              </div>
            ) : (
              <button
                onClick={() => s.setTableEditMode(true)}
                style={{
                  border: "none",
                  background: "var(--control-tint)",
                  borderRadius: "999px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: "var(--text)",
                  flexShrink: 0,
                }}
              >
                テーブル編集
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
            {orderedTables.map((t) => {
              const total = tableTotal(t.id);
              const count = tableCount(t.id);
              const active = count > 0;
              const selected = sel === t.id;
              const editing = s.editingTableId === t.id;
              const canDrag = s.tableEditMode && !editing;
              const dragging = s.dragTableId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => !editing && !s.tableEditMode && s.selectStaffTable(t.id)}
                  draggable={canDrag}
                  onDragStart={() => canDrag && s.dragStartTable(t.id)}
                  onDragEnd={s.dragEndTable}
                  onDragOver={(e) => canDrag && e.preventDefault()}
                  onDrop={() => canDrag && s.dropOnTable(t.id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    cursor: s.tableEditMode ? (canDrag ? "grab" : "default") : "pointer",
                    borderRadius: "16px",
                    padding: "12px 14px",
                    opacity: dragging ? 0.5 : 1,
                    background: selected || active ? "var(--surface)" : "var(--chip-tint)",
                    border: selected ? `2px solid ${accent}` : "2px solid transparent",
                    boxShadow: selected
                      ? "0 4px 16px rgba(0,0,0,.09)"
                      : active
                        ? "0 1px 6px rgba(0,0,0,.05)"
                        : "none",
                    transition: "background .15s, box-shadow .15s, border-color .15s",
                  }}
                >
                  {s.tableEditMode && !editing && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "3px",
                        marginBottom: "8px",
                      }}
                      aria-hidden
                    >
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span
                          key={i}
                          style={{ width: "3px", height: "3px", borderRadius: "50%", background: "var(--text-3)" }}
                        />
                      ))}
                    </div>
                  )}
                  {editing ? (
                    <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        value={s.editTableName}
                        onChange={(e) => s.setEditTableName(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "8px 10px",
                          borderRadius: "9px",
                          border: "none",
                          background: "var(--hairline)",
                          fontSize: "14px",
                          fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={s.saveEditTable}
                        style={{ ...addBtnStyle(accent), padding: "8px 12px", fontSize: "13px" }}
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "3px" }}>
                        {active ? `${count}点 · 注文あり` : "空席"}
                      </div>
                      {s.tableEditMode ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              s.startEditTable(t.id);
                            }}
                            style={{
                              flex: 1,
                              border: `1px solid ${accent}`,
                              background: "var(--surface)",
                              color: accent,
                              fontSize: "13px",
                              fontWeight: 700,
                              fontFamily: "inherit",
                              borderRadius: "999px",
                              padding: "8px 0",
                              cursor: "pointer",
                            }}
                          >
                            名前変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              s.confirmDeleteTable(t.id);
                            }}
                            aria-label="テーブルを削除"
                            style={{
                              width: "40px",
                              height: "40px",
                              flexShrink: 0,
                              borderRadius: "50%",
                              border: "1px solid var(--red-bg)",
                              background: "var(--surface)",
                              color: "var(--red)",
                              fontSize: "14px",
                              fontWeight: 700,
                              cursor: "pointer",
                              lineHeight: 1,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "22px",
                            fontWeight: 800,
                            color: accent,
                          }}
                        >
                          {s.yen(total)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* テーブル詳細（下に全幅表示） */}
        <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "22px", padding: "20px 22px", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)", minHeight: "300px" }}>
          {sel == null ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "260px", color: "var(--text-2)", fontSize: "15px" }}>
              上のテーブルを選択してください
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                <div style={{ fontSize: "23px", fontWeight: 800 }}>{s.tableName(sel)}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
                    合計{s.settings.taxMode === "exclusive" ? "（税込）" : "（内税）"}
                  </div>
                  <div style={{ fontSize: "25px", fontWeight: 800, color: accent }}>
                    {s.yen(breakdown.total)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-2)", marginBottom: "18px", textAlign: "right" }}>
                {s.settings.taxMode === "exclusive"
                  ? `表示価格は税抜です（消費税率 ${s.settings.taxRate}%）`
                  : "表示価格は税込です"}
              </div>

              {/* 注文明細 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "8px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800 }}>注文明細</div>
                {aggList.length > 0 && (
                  s.orderEditMode ? (
                    <button
                      onClick={s.confirmFinishOrderEdit}
                      style={{
                        border: "none",
                        background: accent,
                        color: "#fff",
                        borderRadius: "999px",
                        padding: "5px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      完了
                    </button>
                  ) : (
                    <button
                      onClick={() => s.setOrderEditMode(true)}
                      style={{
                        border: "1px solid var(--soldout-bg)",
                        background: "var(--surface)",
                        color: "var(--text-2)",
                        borderRadius: "999px",
                        padding: "5px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      注文編集
                    </button>
                  )
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "10px" }}>
                {s.orderEditMode
                  ? "「−」で品目を1個ずつ取消できます。完了を押すと編集を終了します。"
                  : "誤操作防止のため、取消するには「注文編集」を押してください。"}
              </div>
              {aggList.length === 0 ? (
                <div style={{ color: "var(--text-2)", fontSize: "14px", padding: "16px 0" }}>
                  このテーブルにまだ注文はありません。
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {aggList.map((it) => (
                    <div
                      key={it.menuItemId + ":" + it.price}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        background: "var(--surface)",
                        borderRadius: "14px",
                        padding: "10px 12px",
                        boxShadow: "0 1px 5px rgba(0,0,0,.05)",
                      }}
                    >
                      {photoById[it.menuItemId] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoById[it.menuItemId]}
                          alt={it.name}
                          style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover" }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>{it.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
                          {s.yen(it.price)} × {it.qty}
                          {it.proxy ? " · 代理あり" : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: 800 }}>
                        {s.yen(it.price * it.qty)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {s.orderEditMode && (
                          <button
                            onClick={() => s.cancelUnit(it.menuItemId)}
                            aria-label={`${it.name}を1つ取消`}
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "10px",
                              border: "none",
                              background: "var(--red-bg)",
                              color: "var(--red)",
                              fontSize: "20px",
                              fontWeight: 600,
                              cursor: "pointer",
                              lineHeight: 1,
                            }}
                          >
                            −
                          </button>
                        )}
                        <span style={{ fontSize: "15px", fontWeight: 800, minWidth: "16px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {it.qty}
                        </span>
                        {s.orderEditMode && (
                          <button
                            onClick={() => s.addUnit(it.menuItemId)}
                            aria-label={`${it.name}を1つ追加`}
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "10px",
                              border: "none",
                              background: "var(--green-bg)",
                              color: "var(--green-dark)",
                              fontSize: "20px",
                              fontWeight: 600,
                              cursor: "pointer",
                              lineHeight: 1,
                            }}
                          >
                            ＋
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 割引 / チャージ料 / 内訳 */}
              {aggList.length > 0 && (
                <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--hairline)" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "10px" }}>割引</div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    {(
                      [
                        { v: null, label: "なし" },
                        { v: "percent", label: "％" },
                        { v: "amount", label: "円" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={String(opt.v)}
                        onClick={() => setDiscountType(opt.v)}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          padding: "7px 16px",
                          fontSize: "13px",
                          fontWeight: 700,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          background: discountType === opt.v ? accent : "var(--hairline)",
                          color: discountType === opt.v ? "#fff" : "var(--text-2)",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {discountType && (
                      <input
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder={discountType === "percent" ? "例: 10" : "例: 500"}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "7px 12px",
                          borderRadius: "10px",
                          border: "none",
                          background: "var(--hairline)",
                          fontSize: "14px",
                          fontFamily: "inherit",
                        }}
                      />
                    )}
                  </div>

                  {/* 内訳 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "var(--text-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>小計</span>
                      <span>{s.yen(breakdown.subtotal)}</span>
                    </div>
                    {breakdown.discountAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--red)" }}>
                        <span>割引</span>
                        <span>−{s.yen(breakdown.discountAmount)}</span>
                      </div>
                    )}
                    {s.settings.chargeRate > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          チャージ料（{s.settings.chargeRate}%）
                          <span style={{ transform: "scale(.6)", transformOrigin: "left center" }}>
                            <Toggle on={chargeEnabled} onChange={setChargeEnabled} />
                          </span>
                        </span>
                        <span>{chargeEnabled ? `+${s.yen(breakdown.chargeAmount)}` : "適用なし"}</span>
                      </div>
                    )}
                    {breakdown.taxAmount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>消費税（{s.settings.taxRate}%）</span>
                        <span>+{s.yen(breakdown.taxAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 800, color: "var(--text)", marginTop: "2px" }}>
                      <span>合計</span>
                      <span>{s.yen(breakdown.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => s.confirmCheckout(discountType, discountNum, chargeEnabled)}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
                }}
              >
                お会計する（セッションを締める）
              </button>
              <div style={{ fontSize: "11px", color: "var(--text-2)", marginTop: "8px", textAlign: "center" }}>
                決済は既存レジで実施。ここではセッションを締めるだけです。
              </div>

              {/* 代理注文 */}
              <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "22px", paddingTop: "18px" }}>
                <div style={{ fontSize: "16px", fontWeight: 800 }}>代理注文</div>
                <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "6px" }}>
                  同じメニューから店員が入力できます
                </div>
                <div style={{ margin: "0 -6px" }}>
                  <ChipRow value={s.proxyCat} onChange={s.setProxyCat} accent={accent} />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                    gap: "10px",
                    marginTop: "6px",
                  }}
                >
                  {proxyFiltered.map((m) => {
                    const qty = s.staffCart[m.id] || 0;
                    const orderable = s.avail(m);
                    return (
                      <div key={m.id} style={proxyCardStyle(!orderable)}>
                        {photoById[m.id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoById[m.id]}
                            alt={m.name}
                            style={{ width: "38px", height: "38px", borderRadius: "9px", objectFit: "cover" }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-2)" }}>{s.yen(m.price)}</div>
                        </div>
                        {!orderable ? (
                          <span style={{ fontSize: "11px", color: "var(--text-2)", fontWeight: 700 }}>売切</span>
                        ) : qty === 0 ? (
                          <button
                            onClick={() => s.addStaff(m.id)}
                            style={proxyAddStyle(accent)}
                          >
                            ＋
                          </button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button onClick={() => s.removeStaff(m.id)} style={proxySubStyle(accent)}>
                              −
                            </button>
                            <span style={{ fontSize: "14px", fontWeight: 800, minWidth: "14px", textAlign: "center" }}>
                              {qty}
                            </span>
                            <button onClick={() => s.addStaff(m.id)} style={proxyAddStyle(accent)}>
                              ＋
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => s.submitProxy()}
                  disabled={proxyCount === 0}
                  style={{
                    width: "100%",
                    marginTop: "14px",
                    padding: "13px",
                    borderRadius: "14px",
                    border: "none",
                    background: proxyCount === 0 ? "var(--text-3)" : accent,
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: proxyCount === 0 ? "default" : "pointer",
                  }}
                >
                  代理注文を送信（{proxyCount}点）
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
