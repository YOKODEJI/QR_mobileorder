"use client";

import { useAppStore } from "@/store/useAppStore";
import ChipRow from "@/components/ui/ChipRow";
import PhotoSlot from "@/components/ui/PhotoSlot";
import { hm, useNow } from "@/lib/time";
import {
  itemCardStyle,
  addBtnStyle,
  stepAddStyle,
  stepSubStyle,
} from "@/lib/styles";

export default function CustomerOrder() {
  const s = useAppStore();
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
    <div style={{ display: "flex", justifyContent: "center", padding: "26px 16px 40px" }}>
      <div
        style={{
          width: "394px",
          maxWidth: "100%",
          height: "800px",
          background: "#fff",
          borderRadius: "44px",
          boxShadow: "0 30px 70px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* ヘッダーバンド */}
        <div style={{ background: accent, color: "#fff", padding: "22px 20px 18px", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", opacity: 0.85 }}>
                ようこそ {s.settings.storeName} へ
              </div>
              <div style={{ fontSize: "25px", fontWeight: 800, marginTop: "2px" }}>
                {s.tableName(s.customerTableId)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
              <button
                onClick={() => s.toggleHistory(true)}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,.22)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "8px 13px",
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
                onClick={s.callStaff}
                disabled={called}
                style={{
                  border: called ? "none" : "1px solid rgba(255,255,255,.6)",
                  background: called ? "rgba(255,255,255,.9)" : "transparent",
                  color: called ? accent : "#fff",
                  borderRadius: "999px",
                  padding: "8px 13px",
                  fontSize: "13px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: called ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {called ? "✓ 呼び出し中" : "🔔 スタッフ呼出"}
              </button>
            </div>
          </div>
        </div>

        {/* スクロール領域（縦スクロールは menu list のみ。チップ行は潰さない） */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {s.settings.showHeaderPhoto && (
            <PhotoSlot height={150} label="ヘッダー写真をタップで追加" />
          )}

          <ChipRow
            value={s.customerCat}
            onChange={s.setCustomerCat}
            accent={accent}
            borderBottom
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px 14px 24px",
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
                      alt=""
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
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>{m.name}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#8e8e93" }}>
                      {s.yen(m.price)}
                    </div>
                  </div>
                  {!orderable ? (
                    <span
                      style={{
                        background: "#d1d1d6",
                        color: "#6b6b70",
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "6px 12px",
                        borderRadius: "999px",
                      }}
                    >
                      売切
                    </span>
                  ) : qty === 0 ? (
                    <button onClick={() => s.addCart(m.id)} style={addBtnStyle(accent)}>
                      追加
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button onClick={() => s.removeCart(m.id)} style={stepSubStyle(accent)}>
                        −
                      </button>
                      <span style={{ fontSize: "17px", fontWeight: 800, minWidth: "18px", textAlign: "center" }}>
                        {qty}
                      </span>
                      <button onClick={() => s.addCart(m.id)} style={stepAddStyle(accent)}>
                        ＋
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {s.settings.showFooterPhoto && (
              <div style={{ marginTop: "6px" }}>
                <PhotoSlot height={130} radius={18} label="フッター写真をタップで追加" />
              </div>
            )}
          </div>
        </div>

        {/* 固定カートバー */}
        <div
          style={{
            flexShrink: 0,
            background: "rgba(248,248,250,.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid #f0f0f2",
            padding: "10px 16px 16px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: "#8e8e93",
              marginBottom: "8px",
            }}
          >
            変更・キャンセルはスタッフにお声がけください
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#6b6b70" }}>
              {cartCount}点
            </span>
            <span style={{ fontSize: "23px", fontWeight: 800 }}>{s.yen(cartTotal)}</span>
          </div>
          <button
            onClick={s.confirmOrder}
            disabled={cartCount === 0 || s.submitting}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: "16px",
              border: "none",
              background: cartCount === 0 ? "#c7c7cc" : accent,
              color: "#fff",
              fontSize: "17px",
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: cartCount === 0 ? "default" : "pointer",
            }}
          >
            {s.submitting ? "送信中…" : "注文する"}
          </button>
        </div>

        {/* 注文成功オーバーレイ */}
        {s.justOrdered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,.96)",
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
                  background: "#34c759",
                  color: "#fff",
                  fontSize: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 18px",
                }}
              >
                ✓
              </div>
              <div style={{ fontSize: "21px", fontWeight: 800 }}>ご注文を受け付けました</div>
              <div style={{ fontSize: "14px", color: "#6b6b70", marginTop: "8px" }}>
                厨房で確認しています。少々お待ちください。
              </div>
              <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "14px" }}>
                変更・キャンセルはスタッフにお声がけください
              </div>
              <button
                onClick={s.dismissSuccess}
                style={{
                  marginTop: "24px",
                  width: "100%",
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
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
              background: "rgba(0,0,0,.35)",
              zIndex: 25,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                background: "#fff",
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
                  background: "#d1d1d6",
                  margin: "0 auto 14px",
                }}
              />
              <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "12px" }}>
                {s.tableName(s.customerTableId)} の注文履歴
              </div>
              {myOrders.length === 0 ? (
                <div style={{ color: "#8e8e93", fontSize: "14px", padding: "20px 0" }}>
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
                          borderBottom: "1px solid #f4f4f6",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "15px", fontWeight: 700 }}>{it.name}</span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: o.status === "served" ? "#e3f7ea" : "#fff3d6",
                                color: o.status === "served" ? "#248a3d" : "#a8791a",
                              }}
                            >
                              {o.status === "served" ? "提供済み" : "調理中"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                            ×{it.qty}
                            {now > 0 ? " · " + hm(o.createdAt) : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 700 }}>
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
    </div>
  );
}
