"use client";

import { useState } from "react";
import type { MenuItem, MenuOption } from "@/store/useAppStore";
import { unitPrice } from "@/lib/options";

/**
 * 商品にオプションが設定されているときの選択シート（複数選択）。
 * 客の注文画面とスタッフの代理注文の両方で使う。
 * 選択結果は optionIds（IDのみ）で返す。追加料金の確定はサーバー側の責務。
 */
export default function OptionSheet({
  item,
  options,
  accent,
  yen,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  /** この商品に紐付いたオプション候補（並び順のまま） */
  options: MenuOption[];
  accent: string;
  yen: (n: number) => string;
  onClose: () => void;
  onAdd: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = options.filter((o) => selected.includes(o.id));
  const total = unitPrice(item.price, chosen);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,.32)",
        zIndex: 30,
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
          maxHeight: "76%",
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
        <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--text)" }}>{item.name}</div>
        <div style={{ fontSize: "13px", color: "var(--text-2)", margin: "2px 0 14px" }}>
          オプションを選んでください（いくつでも選べます）
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                aria-label={`${o.name}を${on ? "外す" : "選ぶ"}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "13px 14px",
                  borderRadius: "14px",
                  border: "none",
                  background: on ? "var(--chip-tint)" : "var(--surface)",
                  boxShadow: on ? "none" : "0 1px 5px rgba(0,0,0,.05)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "8px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: on ? "none" : "2px solid var(--soldout-bg)",
                    background: on ? accent : "transparent",
                    color: "#fff",
                    fontSize: "14px",
                    lineHeight: 1,
                  }}
                >
                  {on ? "✓" : ""}
                </span>
                <span style={{ flex: 1, fontSize: "16px", fontWeight: 600, color: "var(--text)" }}>
                  {o.name}
                </span>
                {o.priceDelta !== 0 && (
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--text-2)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(o.priceDelta > 0 ? "+" : "−") + yen(Math.abs(o.priceDelta))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onAdd(selected)}
          style={{
            marginTop: "18px",
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>カートに追加</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(total)}</span>
        </button>
      </div>
    </div>
  );
}
