"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { filterMenu } from "@/lib/handy";

/** 厨房画面の売切切替。品目ごとにオン・オフし、切り替えた瞬間にハンディの注文画面へ反映される */
export default function SoldOutSheet({ onClose }: { onClose: () => void }) {
  const s = useAppStore(
    useShallow((st) => ({
      menu: st.menu,
      categories: st.categories,
      toggleSoldOut: st.toggleSoldOut,
    }))
  );
  const [cat, setCat] = useState("すべて");
  const [query, setQuery] = useState("");
  const usedCats = s.categories.filter((c) => s.menu.some((m) => m.cat === c));
  const items = filterMenu(s.menu, cat, query);
  const soldOutCount = s.menu.filter((m) => m.soldOut).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.32)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "760px",
          height: "86vh",
          background: "var(--glass-strong)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderTop: "1px solid var(--glass-edge)",
          borderRadius: "28px 28px 0 0",
          padding: "16px 18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          animation: "sheetup .3s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800 }}>売切の切替</div>
            <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
              いま売切: {soldOutCount}品。タップで切り替わり、スタッフのスマホにすぐ反映されます
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              border: "none",
              background: "var(--control-tint)",
              color: "var(--text)",
              fontFamily: "inherit",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            閉じる
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="品名で探す"
          aria-label="品名で探す"
          style={{
            width: "100%",
            padding: "12px 15px",
            borderRadius: "12px",
            border: "none",
            background: "var(--hairline)",
            fontSize: "16px",
            fontFamily: "inherit",
            color: "var(--text)",
          }}
        />

        {!query && (
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", flexShrink: 0, paddingBottom: "2px" }}>
            {["すべて", ...usedCats].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  flexShrink: 0,
                  padding: "9px 16px",
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

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-2)", padding: "40px 0" }}>該当する品目がありません</div>
          )}
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => s.toggleSoldOut(m.id)}
              aria-pressed={m.soldOut}
              aria-label={`${m.name}を${m.soldOut ? "販売中に戻す" : "売切にする"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "14px",
                border: "none",
                background: m.soldOut ? "var(--red-bg-2)" : "var(--surface)",
                boxShadow: m.soldOut ? "none" : "0 1px 5px rgba(0,0,0,.05)",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "17px",
                    fontWeight: 700,
                    color: m.soldOut ? "var(--text-2)" : "var(--text)",
                    textDecoration: m.soldOut ? "line-through" : "none",
                  }}
                >
                  {m.name}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-2)" }}>{m.cat}</span>
              </span>
              <span
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  borderRadius: "999px",
                  fontSize: "14px",
                  fontWeight: 800,
                  background: m.soldOut ? "var(--red)" : "var(--green-bg)",
                  color: m.soldOut ? "#fff" : "var(--green-dark)",
                }}
              >
                {m.soldOut ? "売切" : "販売中"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
