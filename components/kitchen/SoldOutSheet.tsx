"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/useAppStore";
import { filterMenu, sortByPopularity } from "@/lib/handy";
import { useMenuPopularity } from "@/lib/useMenuPopularity";
import Sheet from "@/components/handy/Sheet";
import SearchField from "@/components/ui/SearchField";
import CategoryChips from "@/components/ui/CategoryChips";
import { itemName, rowCard, statusTag, subText } from "@/components/handy/ui";

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
  const popularity = useMenuPopularity();
  const items = sortByPopularity(filterMenu(s.menu, cat, query), popularity);
  const soldOutCount = s.menu.filter((m) => m.soldOut).length;

  return (
    <Sheet
      title="売切の切替"
      subtitle={`いま売切 ${soldOutCount}品。タップで切り替わり、スタッフのスマホにすぐ反映されます`}
      onClose={onClose}
      maxWidth="760px"
      tall
      header={
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SearchField value={query} onChange={setQuery} />
          {!query && <CategoryChips categories={usedCats} value={cat} onChange={setCat} />}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
              ...rowCard,
              padding: "14px 16px",
              background: m.soldOut ? "var(--red-bg-2)" : "var(--surface)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  ...itemName,
                  color: m.soldOut ? "var(--text-2)" : "var(--text)",
                  textDecoration: m.soldOut ? "line-through" : "none",
                }}
              >
                {m.name}
              </span>
              <span style={subText}>{m.cat}</span>
            </span>
            <span
              style={{
                ...statusTag,
                padding: "7px 14px",
                fontSize: "14px",
                background: m.soldOut ? "var(--red)" : "var(--green-bg)",
                color: m.soldOut ? "#fff" : "var(--green-dark)",
              }}
            >
              {m.soldOut ? "売切" : "販売中"}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
