"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import type { MenuItem } from "@/store/useAppStore";
import ChipRow from "@/components/ui/ChipRow";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadPhoto, deletePhoto } from "@/lib/storage";

function DragDots() {
  return (
    <span
      style={{
        display: "inline-grid",
        gridTemplateColumns: "repeat(2, 3px)",
        gap: "3px",
        cursor: "grab",
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#c7c7cc" }} />
      ))}
    </span>
  );
}

function PhotoCell({ item }: { item: MenuItem }) {
  const setPhoto = useAppStore((s) => s.setPhoto);
  const removePhoto = useAppStore((s) => s.removePhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (isSupabaseConfigured()) {
      setUploading(true);
      const url = await uploadPhoto(f, `menu-${item.id}`);
      setUploading(false);
      if (!url) return;
      const prev = item.photo;
      setPhoto(item.id, url);
      if (prev) deletePhoto(prev);
      return;
    }
    const r = new FileReader();
    r.onload = () => setPhoto(item.id, r.result as string);
    r.readAsDataURL(f);
  };

  if (uploading) {
    return (
      <div
        style={{
          width: "54px",
          height: "54px",
          borderRadius: "13px",
          background: "#f0f0f2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          fontWeight: 700,
          color: "#8e8e93",
          flexShrink: 0,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        処理
        <br />
        中…
      </div>
    );
  }

  if (item.photo) {
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photo}
          alt=""
          style={{ width: "54px", height: "54px", borderRadius: "13px", objectFit: "cover", display: "block" }}
        />
        <button
          onClick={() => {
            deletePhoto(item.photo);
            removePhoto(item.id);
          }}
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "none",
            background: "#ff3b30",
            color: "#fff",
            fontSize: "11px",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => inputRef.current?.click()}
      style={{
        width: "54px",
        height: "54px",
        borderRadius: "13px",
        border: "1px dashed #c7c7cc",
        background: "#fafafa",
        color: "#8e8e93",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
        lineHeight: 1.3,
        fontFamily: "inherit",
      }}
    >
      写真
      <br />
      追加
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </button>
  );
}

export default function MenuManagement() {
  const s = useAppStore(
    useShallow((st) => ({
      addCategory: st.addCategory,
      addItem: st.addItem,
      adminCat: st.adminCat,
      bumpStock: st.bumpStock,
      cancelDeleteMode: st.cancelDeleteMode,
      categories: st.categories,
      confirmDeleteCategory: st.confirmDeleteCategory,
      deleteMode: st.deleteMode,
      dragEnd: st.dragEnd,
      dragId: st.dragId,
      dragStart: st.dragStart,
      dropOn: st.dropOn,
      enterDeleteMode: st.enterDeleteMode,
      menu: st.menu,
      newCat: st.newCat,
      newCategoryName: st.newCategoryName,
      newName: st.newName,
      newPrice: st.newPrice,
      newStock: st.newStock,
      requestDelete: st.requestDelete,
      selectedIds: st.selectedIds,
      setAdminCat: st.setAdminCat,
      setCat: st.setCat,
      setNewCat: st.setNewCat,
      setNewCategoryName: st.setNewCategoryName,
      setNewField: st.setNewField,
      setPrice: st.setPrice,
      setStock: st.setStock,
      settings: st.settings,
      toggleSelect: st.toggleSelect,
      toggleSoldOut: st.toggleSoldOut,
    }))
  );
  const accent = s.settings.theme;

  const filtered = s.menu.filter(
    (m) => s.adminCat === "すべて" || m.cat === s.adminCat
  );

  const insetInput: React.CSSProperties = {
    padding: "11px 13px",
    borderRadius: "12px",
    border: "none",
    background: "#f0f0f2",
    fontSize: "15px",
    fontFamily: "inherit",
    color: "#1c1c1e",
  };
  const pill: React.CSSProperties = {
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "24px 18px 40px", maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* 商品を追加 */}
      <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: "17px", fontWeight: 800, marginBottom: "14px" }}>商品を追加</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="商品名"
            value={s.newName}
            onChange={(e) => s.setNewField("newName", e.target.value)}
            style={{ ...insetInput, flex: "2 1 160px" }}
          />
          <select
            value={s.newCat}
            onChange={(e) => s.setNewCat(e.target.value)}
            style={{ ...insetInput, flex: "1 1 110px" }}
          >
            {s.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="価格"
            value={s.newPrice}
            onChange={(e) => s.setNewField("newPrice", e.target.value)}
            style={{ ...insetInput, width: "100px" }}
          />
          <input
            type="number"
            placeholder="在庫"
            value={s.newStock}
            onChange={(e) => s.setNewField("newStock", e.target.value)}
            style={{ ...insetInput, width: "90px" }}
          />
          <button
            onClick={s.addItem}
            style={{ ...pill, border: "none", background: accent, color: "#fff", padding: "11px 22px", fontSize: "14px" }}
          >
            追加
          </button>
        </div>
      </div>

      {/* メニュー管理 */}
      <div style={{ background: "#fff", borderRadius: "22px", overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
        <div style={{ padding: "18px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "19px", fontWeight: 800 }}>メニュー管理</div>
            <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
              価格は1円単位、在庫は増減できます。行をドラッグ&ドロップで並び替え。
            </div>
          </div>
          {s.deleteMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b6b70" }}>
                {s.selectedIds.length}件選択中
              </span>
              <button
                onClick={s.requestDelete}
                disabled={s.selectedIds.length === 0}
                style={{
                  ...pill,
                  border: "none",
                  background: s.selectedIds.length === 0 ? "#f0f0f2" : "#ff3b30",
                  color: s.selectedIds.length === 0 ? "#c7c7cc" : "#fff",
                }}
              >
                削除する
              </button>
              <button
                onClick={s.cancelDeleteMode}
                style={{ ...pill, border: "none", background: "rgba(118,118,128,.12)", color: "#6b6b70" }}
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={s.enterDeleteMode}
              style={{ ...pill, border: "1px solid #ffd4d1", background: "#fff", color: "#ff3b30" }}
            >
              メニューを削除
            </button>
          )}
        </div>

        <div style={{ padding: "6px 16px 0" }}>
          <ChipRow value={s.adminCat} onChange={s.setAdminCat} accent={accent} />
        </div>

        <div className="menu-rows">
          {filtered.map((m, idx) => {
            const selected = s.selectedIds.includes(m.id);
            const dragging = s.dragId === m.id;
            return (
              <div
                key={m.id}
                draggable={!s.deleteMode}
                onDragStart={() => s.dragStart(m.id)}
                onDragEnd={s.dragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => s.dropOn(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "12px 20px",
                  minWidth: "660px",
                  borderBottom: "1px solid #f4f4f6",
                  background: dragging
                    ? "rgba(238,243,255,.5)"
                    : s.deleteMode && selected
                      ? "#fff5f5"
                      : m.soldOut
                        ? "#fafafa"
                        : "#fff",
                }}
              >
                {/* 左: ドラッグ or チェックボックス */}
                {s.deleteMode ? (
                  <button
                    onClick={() => s.toggleSelect(m.id)}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      border: selected ? "none" : "2px solid #d1d1d6",
                      background: selected ? accent : "#fff",
                      color: "#fff",
                      fontSize: "14px",
                      cursor: "pointer",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {selected ? "✓" : ""}
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                    <DragDots />
                    <span style={{ minWidth: "20px", fontSize: "15px", fontWeight: 700, color: "#8e8e93" }}>
                      {idx + 1}
                    </span>
                  </div>
                )}

                {/* 写真 */}
                <PhotoCell item={m} />

                {/* 名前 + カテゴリ */}
                <div style={{ flex: 1, minWidth: "120px" }}>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.name}
                  </div>
                  <select
                    value={m.cat}
                    onChange={(e) => s.setCat(m.id, e.target.value)}
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      background: "#f0f0f2",
                      color: "#6b6b70",
                      border: "none",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {/* 削除済みなど、一覧に無い現在値も選べるよう先頭に補完 */}
                    {!s.categories.includes(m.cat) && <option value={m.cat}>{m.cat}</option>}
                    {s.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 価格 */}
                <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", color: "#8e8e93" }}>¥</span>
                  <input
                    type="number"
                    value={m.price}
                    onChange={(e) => s.setPrice(m.id, e.target.value)}
                    style={{
                      width: "90px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#f0f0f2",
                      textAlign: "right",
                      fontSize: "15px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* 在庫 */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => s.bumpStock(m.id, -1)}
                    style={{ width: "32px", height: "32px", borderRadius: "9px", border: "none", background: "#f0f0f2", color: "#6b6b70", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={m.stock}
                    onChange={(e) => s.setStock(m.id, e.target.value)}
                    style={{
                      width: "46px",
                      padding: "7px 4px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#f0f0f2",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={() => s.bumpStock(m.id, 1)}
                    style={{ width: "32px", height: "32px", borderRadius: "9px", border: "none", background: accent, color: "#fff", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}
                  >
                    ＋
                  </button>
                </div>

                {/* 停止 / 再販 */}
                <button
                  onClick={() => s.toggleSoldOut(m.id)}
                  style={{
                    ...pill,
                    border: "none",
                    flexShrink: 0,
                    background: m.soldOut ? "#ffe5e3" : "#e3f7ea",
                    color: m.soldOut ? "#ff3b30" : "#248a3d",
                  }}
                >
                  {m.soldOut ? "再販" : "停止"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* カテゴリ管理 */}
      <div style={{ background: "#fff", borderRadius: "22px", padding: "20px 22px", boxShadow: "0 12px 34px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: "17px", fontWeight: 800, marginBottom: "4px" }}>カテゴリ管理</div>
        <div style={{ fontSize: "12px", color: "#8e8e93", marginBottom: "14px" }}>
          カテゴリを追加・削除できます。削除すると、そのカテゴリのメニューは「その他」に移動します。
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          {s.categories.map((c) => (
            <span
              key={c}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f0f0f2",
                color: "#1c1c1e",
                borderRadius: "999px",
                padding: "6px 8px 6px 14px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {c}
              {c !== "その他" && (
                <button
                  onClick={() => s.confirmDeleteCategory(c)}
                  aria-label={c + "を削除"}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "none",
                    background: "#e3e3e6",
                    color: "#6b6b70",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            placeholder="新しいカテゴリ名"
            value={s.newCategoryName}
            onChange={(e) => s.setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") s.addCategory();
            }}
            style={{ ...insetInput, flex: 1 }}
          />
          <button
            onClick={s.addCategory}
            disabled={!s.newCategoryName.trim()}
            style={{
              ...pill,
              border: "none",
              background: s.newCategoryName.trim() ? accent : "#f0f0f2",
              color: s.newCategoryName.trim() ? "#fff" : "#c7c7cc",
              padding: "11px 22px",
              fontSize: "14px",
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
