"use client";

import { useAppStore } from "@/store/useAppStore";
import ChipRow from "@/components/ui/ChipRow";
import { proxyCardStyle, proxyAddStyle, proxySubStyle, addBtnStyle } from "@/lib/styles";

export default function StaffCheckout() {
  const s = useAppStore();
  const accent = s.settings.theme;
  const photoById: Record<string, string> = {};
  s.menu.forEach((m) => {
    if (m.photo) photoById[m.id] = m.photo;
  });

  const tableTotal = (id: number) =>
    s.orders
      .filter((o) => o.table === id)
      .reduce((sum, o) => sum + o.items.reduce((t, it) => t + it.price * it.qty, 0), 0);
  const tableCount = (id: number) =>
    s.orders
      .filter((o) => o.table === id)
      .reduce((c, o) => c + o.items.reduce((t, it) => t + it.qty, 0), 0);

  const sel = s.selectedStaffTable;
  const selOrders = sel != null ? s.orders.filter((o) => o.table === sel) : [];

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

  const proxyFiltered = s.menu.filter(
    (m) => s.proxyCat === "すべて" || m.cat === s.proxyCat
  );
  const proxyCount = Object.values(s.staffCart).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
      <div className="staff-grid">
        {/* 左: テーブル一覧 */}
        <div style={{ background: "#fff", borderRadius: "22px", padding: "16px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", alignSelf: "start" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "6px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800 }}>テーブル一覧</span>
            {s.tableEditMode ? (
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={s.addTable}
                  style={{
                    border: "none",
                    background: "rgba(118,118,128,.12)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    color: "#1c1c1e",
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
                  background: "rgba(118,118,128,.12)",
                  borderRadius: "999px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: "#1c1c1e",
                  flexShrink: 0,
                }}
              >
                テーブル編集
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {s.tables.map((t) => {
              const total = tableTotal(t.id);
              const count = tableCount(t.id);
              const active = count > 0;
              const selected = sel === t.id;
              const editing = s.editingTableId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => !editing && s.selectStaffTable(t.id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    cursor: "pointer",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    background: selected ? "#fff" : active ? "#f7f7f9" : "#fbfbfd",
                    border: selected
                      ? `2px solid ${accent}`
                      : active
                        ? "1px solid #ececee"
                        : "1px solid #f0f0f2",
                  }}
                >
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
                          background: "#f0f0f2",
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "3px" }}>
                          {active ? `${count}点 · 注文あり` : "空席"}
                        </div>
                      </div>
                      {s.tableEditMode ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              s.startEditTable(t.id);
                            }}
                            style={{
                              border: `1px solid ${accent}`,
                              background: "#fff",
                              color: accent,
                              fontSize: "13px",
                              fontWeight: 700,
                              fontFamily: "inherit",
                              borderRadius: "999px",
                              padding: "8px 16px",
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
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: "1px solid #ffd4d1",
                              background: "#fff",
                              color: "#ff3b30",
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
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: "20px",
                            fontWeight: 800,
                            color: accent,
                          }}
                        >
                          {s.yen(total)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右: テーブル詳細 */}
        <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)", minHeight: "640px" }}>
          {sel == null ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8e8e93", fontSize: "15px" }}>
              左のテーブルを選択してください
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                <div style={{ fontSize: "23px", fontWeight: 800 }}>{s.tableName(sel)}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#8e8e93" }}>合計（税込）</div>
                  <div style={{ fontSize: "25px", fontWeight: 800, color: accent }}>
                    {s.yen(selTotal)}
                  </div>
                </div>
              </div>

              {/* 注文明細 */}
              <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "4px" }}>注文明細</div>
              <div style={{ fontSize: "12px", color: "#8e8e93", marginBottom: "10px" }}>
                品目1個ずつ取消できます
              </div>
              {aggList.length === 0 ? (
                <div style={{ color: "#8e8e93", fontSize: "14px", padding: "16px 0" }}>
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
                        background: "#f7f7f9",
                        borderRadius: "14px",
                        padding: "10px 12px",
                      }}
                    >
                      {photoById[it.menuItemId] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoById[it.menuItemId]}
                          alt=""
                          style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover" }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>{it.name}</div>
                        <div style={{ fontSize: "11px", color: "#8e8e93" }}>
                          {s.yen(it.price)} × {it.qty}
                          {it.proxy ? " · 代理あり" : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: "15px", fontWeight: 800 }}>
                        {s.yen(it.price * it.qty)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          onClick={() => s.cancelUnit(it.menuItemId)}
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "10px",
                            border: "none",
                            background: "#ffe5e3",
                            color: "#ff3b30",
                            fontSize: "20px",
                            fontWeight: 600,
                            cursor: "pointer",
                            lineHeight: 1,
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: "15px", fontWeight: 800, minWidth: "16px", textAlign: "center" }}>
                          {it.qty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={s.confirmCheckout}
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  background: "#1c1c1e",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                お会計する（セッションを締める）
              </button>
              <div style={{ fontSize: "11px", color: "#8e8e93", marginTop: "8px", textAlign: "center" }}>
                決済は既存レジで実施。ここではセッションを締めるだけです。
              </div>

              {/* 代理注文 */}
              <div style={{ borderTop: "1px solid #f0f0f2", marginTop: "22px", paddingTop: "18px" }}>
                <div style={{ fontSize: "16px", fontWeight: 800 }}>代理注文</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginBottom: "6px" }}>
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
                            alt=""
                            style={{ width: "38px", height: "38px", borderRadius: "9px", objectFit: "cover" }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "13px", fontWeight: 700 }}>{m.name}</div>
                          <div style={{ fontSize: "12px", color: "#8e8e93" }}>{s.yen(m.price)}</div>
                        </div>
                        {!orderable ? (
                          <span style={{ fontSize: "11px", color: "#6b6b70", fontWeight: 700 }}>売切</span>
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
                  onClick={s.submitProxy}
                  disabled={proxyCount === 0}
                  style={{
                    width: "100%",
                    marginTop: "14px",
                    padding: "13px",
                    borderRadius: "14px",
                    border: "none",
                    background: proxyCount === 0 ? "#c7c7cc" : accent,
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
