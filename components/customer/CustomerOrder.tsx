"use client";

import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import ChipRow from "@/components/ui/ChipRow";
import { BellIcon, CheckIcon } from "@/components/ui/Icon";
import { hm, useNow } from "@/lib/time";
import { priceWithTax } from "@/lib/pricing";
import {
  itemCardStyle,
  addBtnStyle,
  stepAddStyle,
  stepSubStyle,
} from "@/lib/styles";

export default function CustomerOrder() {
  const s = useAppStore(
    useShallow((st) => ({
      addCart: st.addCart,
      avail: st.avail,
      confirmCallStaff: st.confirmCallStaff,
      calls: st.calls,
      cart: st.cart,
      confirmOrder: st.confirmOrder,
      customerCat: st.customerCat,
      customerTableId: st.customerTableId,
      dismissSuccess: st.dismissSuccess,
      justOrdered: st.justOrdered,
      menu: st.menu,
      orders: st.orders,
      removeCart: st.removeCart,
      setCustomerCat: st.setCustomerCat,
      settings: st.settings,
      showHistory: st.showHistory,
      submitting: st.submitting,
      tableName: st.tableName,
      toggleHistory: st.toggleHistory,
      yen: st.yen,
    }))
  );
  const accent = s.settings.theme;
  const now = useNow();
  const called = s.calls.some((c) => c.table === s.customerTableId);

  const filtered = s.menu.filter(
    (m) => s.customerCat === "すべて" || m.cat === s.customerCat
  );

  const cartCount = Object.values(s.cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.keys(s.cart).reduce((sum, id) => {
    const m = s.menu.find((x) => x.id === id);
    return sum + (m ? m.price * s.cart[id] : 0);
  }, 0);

  // このテーブルの注文履歴合計
  const myOrders = s.orders.filter((o) => o.table === s.customerTableId);
  const historyTotal = myOrders.reduce(
    (sum, o) => sum + o.items.reduce((t, it) => t + it.price * it.qty, 0),
    0
  );

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        background: "var(--app-bg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* スクロール領域（ヘッダー/カートバーの下を流れる＝ガラスの奥行きの源。
          パディングは下の実測ヘッダー/カート高さ+余白のおおよその値） */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
        }}
      >
        <div style={{ height: "88px", flexShrink: 0 }} />

        {s.settings.showHeaderPhoto && s.settings.headerPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.settings.headerPhoto}
            alt=""
            style={{ width: "100%", height: "150px", objectFit: "cover", display: "block" }}
          />
        )}

        <ChipRow value={s.customerCat} onChange={s.setCustomerCat} accent={accent} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "2px 14px 24px",
          }}
        >
          {filtered.map((m) => {
            const qty = s.cart[m.id] || 0;
            const orderable = s.avail(m);
            return (
              <div key={m.id} style={itemCardStyle(!orderable)}>
                {m.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo}
                    alt={m.name}
                    style={{
                      width: "62px",
                      height: "62px",
                      borderRadius: "14px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{m.name}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {s.yen(m.price)}
                  </div>
                </div>
                {!orderable ? (
                  <span
                    style={{
                      background: "var(--soldout-bg)",
                      color: "var(--soldout-text)",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "6px 12px",
                      borderRadius: "999px",
                    }}
                  >
                    売切
                  </span>
                ) : qty === 0 ? (
                  <button onClick={() => s.addCart(m.id)} style={addBtnStyle(accent)} aria-label={`${m.name}をカートに追加`}>
                    追加
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => s.removeCart(m.id)} style={stepSubStyle(accent)} aria-label={`${m.name}を1つ減らす`}>
                      −
                    </button>
                    <span
                      key={qty}
                      style={{
                        fontSize: "17px",
                        fontWeight: 800,
                        minWidth: "18px",
                        textAlign: "center",
                        color: "var(--text)",
                        display: "inline-block",
                        fontVariantNumeric: "tabular-nums",
                        animation: "pop .22s var(--ease-spring)",
                      }}
                    >
                      {qty}
                    </span>
                    <button onClick={() => s.addCart(m.id)} style={stepAddStyle(accent)} aria-label={`${m.name}を1つ増やす`}>
                      ＋
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {s.settings.showFooterPhoto && s.settings.footerPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.settings.footerPhoto}
              alt=""
              style={{ width: "100%", height: "130px", objectFit: "cover", borderRadius: "18px", marginTop: "6px", display: "block" }}
            />
          )}
        </div>

        <div style={{ height: "136px", flexShrink: 0 }} />
      </div>

      {/* 浮遊ヘッダー（ガラス） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          margin: "8px",
          padding: "10px 14px 10px",
          borderRadius: "24px",
          background: "var(--glass)",
          backdropFilter: "blur(26px) saturate(180%)",
          WebkitBackdropFilter: "blur(26px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-2)" }}>
              ようこそ {s.settings.storeName} へ
            </div>
            <div style={{ fontSize: "25px", fontWeight: 800, color: "var(--text)" }}>
              {s.tableName(s.customerTableId)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            <button
              onClick={() => s.toggleHistory(true)}
              style={{
                border: "none",
                background: "var(--control-tint)",
                color: "var(--text)",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              履歴 {s.yen(historyTotal)}
            </button>
            <button
              onClick={s.confirmCallStaff}
              disabled={called}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                border: "none",
                background: called ? "var(--control-tint)" : accent,
                color: called ? "var(--text-2)" : "var(--accent-ink)",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: called ? "default" : "pointer",
                whiteSpace: "nowrap",
                boxShadow: called ? undefined : "inset 0 1px 0 rgba(255,255,255,.3)",
              }}
            >
              {called ? "✓ 呼び出し中" : (<><BellIcon size={13} />スタッフ呼出</>)}
            </button>
          </div>
        </div>
      </div>

      {/* 浮遊カートバー（ガラス） */}
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          left: 0,
          right: 0,
          bottom: 0,
          margin: "8px",
          borderRadius: "24px",
          background: "var(--glass-strong)",
          backdropFilter: "blur(30px) saturate(190%)",
          WebkitBackdropFilter: "blur(30px) saturate(190%)",
          border: "1px solid var(--glass-edge)",
          boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)",
          padding: "8px 14px 12px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "var(--text-2)",
            marginBottom: "5px",
          }}
        >
          変更・キャンセルはスタッフにお声がけください
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "7px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
            {cartCount}点
          </span>
          <span
            key={cartTotal}
            style={{
              fontSize: "23px",
              fontWeight: 800,
              color: "var(--text)",
              display: "inline-block",
              fontVariantNumeric: "tabular-nums",
              animation: cartTotal > 0 ? "pop .22s var(--ease-spring)" : undefined,
            }}
          >
            {s.yen(cartTotal)}
          </span>
        </div>
        <button
          onClick={s.confirmOrder}
          disabled={cartCount === 0 || s.submitting}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "16px",
            border: "none",
            background: cartCount === 0 ? "var(--soldout-bg)" : accent,
            color: cartCount === 0 ? "var(--soldout-text)" : "var(--accent-ink)",
            fontSize: "17px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: cartCount === 0 ? "default" : "pointer",
            boxShadow: cartCount === 0 ? undefined : "inset 0 1px 0 rgba(255,255,255,.3)",
          }}
        >
          {s.submitting ? "送信中…" : "注文する"}
        </button>
        <div style={{ textAlign: "center", fontSize: "10px", color: "var(--text-3)", marginTop: "6px" }}>
          {s.settings.taxMode === "exclusive"
            ? `表示価格は税抜です（税込 ${s.yen(priceWithTax(cartTotal, "exclusive", s.settings.taxRate))}）`
            : "表示価格は税込です"}
        </div>
      </div>

      {/* 注文成功オーバーレイ */}
      {s.justOrdered && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,.9)",
            backdropFilter: "blur(30px) saturate(180%)",
            WebkitBackdropFilter: "blur(30px) saturate(180%)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px",
            textAlign: "center",
          }}
        >
          <div style={{ animation: "pop .22s ease-out" }}>
            <div
              style={{
                width: "74px",
                height: "74px",
                borderRadius: "50%",
                background: "var(--green)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)",
              }}
            >
              <CheckIcon size={34} />
            </div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: "var(--text)" }}>ご注文を受け付けました</div>
            <div style={{ fontSize: "14px", color: "var(--text-2)", marginTop: "8px" }}>
              厨房で確認しています。少々お待ちください。
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "14px" }}>
              変更・キャンセルはスタッフにお声がけください
            </div>
            <button
              onClick={s.dismissSuccess}
              style={{
                marginTop: "24px",
                width: "100%",
                padding: "15px",
                borderRadius: "18px",
                border: "none",
                background: accent,
                color: "var(--accent-ink)",
                fontSize: "16px",
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)",
              }}
            >
              続けて注文する
            </button>
          </div>
        </div>
      )}

      {/* 履歴シート */}
      {s.showHistory && (
        <div
          onClick={() => s.toggleHistory(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.32)",
            zIndex: 25,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "var(--glass-strong)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              borderTop: "1px solid var(--glass-edge)",
              borderRadius: "28px 28px 0 0",
              padding: "12px 18px 24px",
              maxHeight: "70%",
              overflowY: "auto",
              animation: "sheetup .3s ease-out",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "5px",
                borderRadius: "999px",
                background: "var(--soldout-bg)",
                margin: "0 auto 14px",
              }}
            />
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "12px", color: "var(--text)" }}>
              {s.tableName(s.customerTableId)} の注文履歴
            </div>
            {myOrders.length === 0 ? (
              <div style={{ color: "var(--text-2)", fontSize: "14px", padding: "20px 0" }}>
                まだ注文はありません
              </div>
            ) : (
              <>
                {myOrders.flatMap((o) =>
                  o.items.map((it, i) => (
                    <div
                      key={o.id + "-" + i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--hairline)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{it.name}</span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: o.status === "served" ? "var(--green-bg)" : "#fff3d6",
                              color: o.status === "served" ? "var(--green-dark)" : "#a8791a",
                            }}
                          >
                            {o.status === "served" ? "提供済み" : "調理中"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" }}>
                          ×{it.qty}
                          {now > 0 ? " · " + hm(o.createdAt) : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                        {s.yen(it.price * it.qty)}
                      </div>
                    </div>
                  ))
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "14px",
                    fontSize: "17px",
                    fontWeight: 800,
                    color: "var(--text)",
                  }}
                >
                  <span>合計（税込）</span>
                  <span style={{ color: accent }}>{s.yen(historyTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
