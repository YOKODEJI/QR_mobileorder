"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import type { MenuItem } from "@/store/useAppStore";
import ChipRow from "@/components/ui/ChipRow";
import Picker from "@/components/ui/Picker";
import { isSupabaseConfigured } from "@/lib/supabase";
import { uploadPhoto, deletePhoto, resizeImage } from "@/lib/storage";

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
        <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "var(--text-3)" }} />
      ))}
    </span>
  );
}

function PhotoCell({ item }: { item: MenuItem }) {
  const setPhoto = useAppStore((s) => s.setPhoto);
  const confirmRemovePhoto = useAppStore((s) => s.confirmRemovePhoto);
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
    const resized = await resizeImage(f);
    const r = new FileReader();
    r.onload = () => setPhoto(item.id, r.result as string);
    r.readAsDataURL(resized);
  };

  if (uploading) {
    return (
      <div
        style={{
          width: "54px",
          height: "54px",
          borderRadius: "13px",
          background: "var(--hairline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--text-2)",
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
          alt={item.name}
          style={{ width: "54px", height: "54px", borderRadius: "13px", objectFit: "cover", display: "block" }}
        />
        <button
          onClick={() => confirmRemovePhoto(item.id)}
          aria-label={`${item.name}の写真を削除`}
          style={{
            position: "absolute",
            top: "-10px",
            right: "-10px",
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            border: "none",
            background: "var(--red)",
            color: "#fff",
            fontSize: "12px",
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
        border: "1px dashed var(--text-3)",
        background: "var(--chip-tint)",
        color: "var(--text-2)",
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
      editCategoryNameValue: st.editCategoryNameValue,
      editingCategoryName: st.editingCategoryName,
      enterDeleteMode: st.enterDeleteMode,
      menu: st.menu,
      newCat: st.newCat,
      newCategoryName: st.newCategoryName,
      newName: st.newName,
      newPrice: st.newPrice,
      newStock: st.newStock,
      requestDelete: st.requestDelete,
      saveEditCategory: st.saveEditCategory,
      selectedIds: st.selectedIds,
      setAdminCat: st.setAdminCat,
      setCat: st.setCat,
      setEditCategoryNameValue: st.setEditCategoryNameValue,
      setNewCat: st.setNewCat,
      setNewCategoryName: st.setNewCategoryName,
      setNewField: st.setNewField,
      setPrice: st.setPrice,
      setStock: st.setStock,
      settings: st.settings,
      startEditCategory: st.startEditCategory,
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
    background: "var(--hairline)",
    fontSize: "15px",
    fontFamily: "inherit",
    color: "var(--text)",
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
      <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "22px", padding: "20px 22px", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)" }}>
        <div style={{ fontSize: "17px", fontWeight: 800, marginBottom: "14px" }}>商品を追加</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="商品名"
            value={s.newName}
            onChange={(e) => s.setNewField("newName", e.target.value)}
            style={{ ...insetInput, flex: "2 1 160px" }}
          />
          <Picker
            value={s.newCat}
            options={s.categories}
            onChange={s.setNewCat}
            label="カテゴリ"
            accent={accent}
            triggerStyle={{
              ...insetInput,
              flex: "1 1 110px",
              justifyContent: "space-between",
              fontWeight: 400,
            }}
          />
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
      <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "22px", overflow: "hidden", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)" }}>
        <div style={{ padding: "18px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "19px", fontWeight: 800 }}>メニュー管理</div>
            <div style={{ fontSize: "12px", color: "var(--text-2)", marginTop: "2px" }}>
              価格は1円単位、在庫は増減できます。行をドラッグ&ドロップで並び替え。
            </div>
          </div>
          {s.deleteMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-2)" }}>
                {s.selectedIds.length}件選択中
              </span>
              <button
                onClick={s.requestDelete}
                disabled={s.selectedIds.length === 0}
                style={{
                  ...pill,
                  border: "none",
                  background: s.selectedIds.length === 0 ? "var(--hairline)" : "var(--red)",
                  color: s.selectedIds.length === 0 ? "var(--text-3)" : "#fff",
                }}
              >
                削除する
              </button>
              <button
                onClick={s.cancelDeleteMode}
                style={{ ...pill, border: "none", background: "var(--control-tint)", color: "var(--text-2)" }}
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={s.enterDeleteMode}
              style={{ ...pill, border: "1px solid var(--red-bg)", background: "var(--surface)", color: "var(--red)" }}
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
                  borderBottom: "1px solid var(--hairline-2)",
                  background: dragging
                    ? "rgba(238,243,255,.5)"
                    : s.deleteMode && selected
                      ? "var(--red-bg-2)"
                      : m.soldOut
                        ? "var(--chip-tint)"
                        : "transparent",
                }}
              >
                {/* 左: ドラッグ or チェックボックス */}
                {s.deleteMode ? (
                  <button
                    onClick={() => s.toggleSelect(m.id)}
                    aria-label={selected ? `${m.name}の選択を解除` : `${m.name}を選択`}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: selected ? "none" : "2px solid var(--soldout-bg)",
                      background: selected ? accent : "var(--surface)",
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
                    <span style={{ minWidth: "20px", fontSize: "15px", fontWeight: 700, color: "var(--text-2)" }}>
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
                  <div style={{ marginTop: "3px" }}>
                    <Picker
                      value={m.cat}
                      // 削除済みなど、一覧に無い現在値も選べるよう先頭に補完
                      options={s.categories.includes(m.cat) ? s.categories : [m.cat, ...s.categories]}
                      onChange={(c) => s.setCat(m.id, c)}
                      label="カテゴリ"
                      accent={accent}
                      triggerStyle={{ fontSize: "11px", padding: "2px 8px 2px 10px" }}
                    />
                  </div>
                </div>

                {/* 価格 */}
                <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", color: "var(--text-2)" }}>¥</span>
                  <input
                    type="number"
                    value={m.price}
                    onChange={(e) => s.setPrice(m.id, e.target.value)}
                    aria-label={`${m.name}の価格`}
                    style={{
                      width: "90px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "none",
                      background: "var(--hairline)",
                      textAlign: "right",
                      fontSize: "15px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </div>

                {/* 在庫 */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => s.bumpStock(m.id, -1)}
                    aria-label={`${m.name}の在庫を1減らす`}
                    style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "var(--hairline)", color: "var(--text-2)", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={m.stock}
                    onChange={(e) => s.setStock(m.id, e.target.value)}
                    aria-label={`${m.name}の在庫数`}
                    style={{
                      width: "46px",
                      padding: "7px 4px",
                      borderRadius: "9px",
                      border: "none",
                      background: "var(--hairline)",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                  <button
                    onClick={() => s.bumpStock(m.id, 1)}
                    aria-label={`${m.name}の在庫を1増やす`}
                    style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: accent, color: "#fff", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}
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
                    background: m.soldOut ? "var(--red-bg)" : "var(--green-bg)",
                    color: m.soldOut ? "var(--red)" : "var(--green-dark)",
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
      <div style={{ background: "var(--glass)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)", border: "1px solid var(--glass-edge)", borderRadius: "22px", padding: "20px 22px", boxShadow: "inset 0 1px 0 var(--glass-spec), var(--glass-shadow)" }}>
        <div style={{ fontSize: "17px", fontWeight: 800, marginBottom: "4px" }}>カテゴリ管理</div>
        <div style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: "14px" }}>
          カテゴリを追加・削除・名前変更できます。削除すると、そのカテゴリのメニューは「その他」に移動します。
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          {s.categories.map((c) => {
            if (s.editingCategoryName === c) {
              return (
                <span
                  key={c}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <input
                    autoFocus
                    value={s.editCategoryNameValue}
                    onChange={(e) => s.setEditCategoryNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") s.saveEditCategory();
                    }}
                    onBlur={s.saveEditCategory}
                    style={{
                      border: "none",
                      background: "var(--surface)",
                      boxShadow: `0 0 0 2px ${accent}`,
                      color: "var(--text)",
                      borderRadius: "999px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      width: "120px",
                    }}
                  />
                </span>
              );
            }
            return (
              <span
                key={c}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--hairline)",
                  color: "var(--text)",
                  borderRadius: "999px",
                  padding: "6px 8px 6px 14px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                {c !== "その他" ? (
                  <button
                    onClick={() => s.startEditCategory(c)}
                    aria-label={c + "の名前を変更"}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: "13px",
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {c}
                  </button>
                ) : (
                  <span>{c}</span>
                )}
                {c !== "その他" && (
                  <button
                    onClick={() => s.confirmDeleteCategory(c)}
                    aria-label={c + "を削除"}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "none",
                      background: accent,
                      color: "#fff",
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
            );
          })}
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
              background: s.newCategoryName.trim() ? accent : "var(--hairline)",
              color: s.newCategoryName.trim() ? "#fff" : "var(--text-3)",
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
