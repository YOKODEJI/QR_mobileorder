"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import Toggle from "@/components/ui/Toggle";
import PhotoSlot from "@/components/ui/PhotoSlot";
import QrCodes from "@/components/qr/QrCodes";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { deletePhoto } from "@/lib/storage";
import { getStoredThemeMode, setThemeMode, type ThemeMode } from "@/lib/themeMode";

const SWATCHES = ["#cf4b2c", "#e0902a", "#248a3d", "#0a84ff", "#8a4fd0"];

export default function SettingsSheet() {
  const showSettings = useAppStore((s) => s.showSettings);
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const closeSettings = useAppStore((s) => s.closeSettings);

  // 見た目(ライト/ダーク/自動)はこの端末だけのローカル設定(localStorage)。
  // 店舗全体の設定ではないため useAppStore/DB は経由しない。
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  useEffect(() => {
    setThemeModeState(getStoredThemeMode());
  }, []);

  if (!showSettings) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-2)",
    margin: "0 8px 7px",
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };

  return (
    <div
      onClick={closeSettings}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "46px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "440px",
          maxWidth: "100%",
          background: "var(--glass-strong)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          border: "1px solid var(--glass-edge)",
          borderRadius: "26px",
          padding: "20px 18px 24px",
          boxShadow: "inset 0 1px 0 var(--glass-spec), 0 30px 70px rgba(0,0,0,.4)",
          animation: "sheetup .28s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
            padding: "0 4px",
          }}
        >
          <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-.02em" }}>
            設定
          </div>
          <button
            onClick={closeSettings}
            style={{
              border: "none",
              background: "var(--control-tint)",
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              fontSize: "15px",
              cursor: "pointer",
              color: "var(--text-2)",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* 店舗名 */}
        <div style={labelStyle}>店舗名</div>
        <div style={{ marginBottom: "20px" }}>
          <input
            value={settings.storeName}
            onChange={(e) => setSetting("storeName", e.target.value)}
            style={{
              width: "100%",
              padding: "13px 15px",
              borderRadius: "12px",
              border: "none",
              background: "var(--surface)",
              fontSize: "16px",
              fontFamily: "inherit",
              color: "var(--text)",
            }}
          />
        </div>

        {/* テーマカラー */}
        <div style={labelStyle}>テーマカラー</div>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            display: "flex",
            gap: "14px",
          }}
        >
          {SWATCHES.map((c) => {
            const on = settings.theme === c;
            return (
              <button
                key={c}
                onClick={() => setSetting("theme", c)}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  background: c,
                  border: on ? "3px solid #fff" : "3px solid transparent",
                  boxShadow: on ? `0 0 0 2px ${c}` : "none",
                }}
              />
            );
          })}
        </div>

        {/* 画面の見た目（この端末だけのローカル設定。店舗全体の設定ではない） */}
        <div style={labelStyle}>画面の見た目</div>
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "14px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "13px" }}>この端末での表示</span>
          <SegmentedControl
            segments={[
              { value: "light" as ThemeMode, label: "ライト" },
              { value: "dark" as ThemeMode, label: "ダーク" },
              { value: "system" as ThemeMode, label: "自動" },
            ]}
            value={themeMode}
            onChange={(v) => {
              setThemeModeState(v);
              setThemeMode(v);
            }}
          />
        </div>

        {/* 写真表示（管理画面から設定。客用は表示のみ） */}
        <div style={labelStyle}>客用ページの写真</div>
        <div style={{ background: "var(--surface)", borderRadius: "14px", overflow: "hidden" }}>
          {/* ヘッダー */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
            }}
          >
            <span style={{ fontSize: "15px" }}>ヘッダー写真を表示</span>
            <Toggle
              on={settings.showHeaderPhoto}
              onChange={(v) => setSetting("showHeaderPhoto", v)}
            />
          </div>
          {settings.showHeaderPhoto && (
            <div style={{ padding: "0 16px 14px" }}>
              <PhotoSlot
                height={110}
                radius={12}
                label="ヘッダー写真をタップ／ドロップで追加"
                value={settings.headerPhoto}
                onChange={(url) => setSetting("headerPhoto", url)}
                folder="header"
              />
              {settings.headerPhoto && (
                <button
                  onClick={() => {
                    deletePhoto(settings.headerPhoto);
                    setSetting("headerPhoto", null);
                  }}
                  style={removeBtn}
                >
                  写真を削除
                </button>
              )}
            </div>
          )}
          {/* フッター */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <span style={{ fontSize: "15px" }}>フッター写真を表示</span>
            <Toggle
              on={settings.showFooterPhoto}
              onChange={(v) => setSetting("showFooterPhoto", v)}
            />
          </div>
          {settings.showFooterPhoto && (
            <div style={{ padding: "0 16px 14px" }}>
              <PhotoSlot
                height={110}
                radius={12}
                label="フッター写真をタップ／ドロップで追加"
                value={settings.footerPhoto}
                onChange={(url) => setSetting("footerPhoto", url)}
                folder="footer"
              />
              {settings.footerPhoto && (
                <button
                  onClick={() => {
                    deletePhoto(settings.footerPhoto);
                    setSetting("footerPhoto", null);
                  }}
                  style={removeBtn}
                >
                  写真を削除
                </button>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-2)",
            margin: "10px 8px 0",
            lineHeight: 1.5,
          }}
        >
          写真は管理画面から設定します。客用ページには表示だけされます。
        </div>

        {/* 税・チャージ料 */}
        <div style={{ ...labelStyle, marginTop: "20px" }}>税・チャージ料</div>
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>表示価格の税区分</div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {(
              [
                { v: "inclusive" as const, label: "内税（税込表示）" },
                { v: "exclusive" as const, label: "外税（税抜表示）" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setSetting("taxMode", opt.v)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: settings.taxMode === opt.v ? "var(--accent)" : "var(--hairline)",
                  color: settings.taxMode === opt.v ? "#fff" : "var(--text-2)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {settings.taxMode === "exclusive" && (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px" }}>消費税率</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="number"
                  min={0}
                  value={settings.taxRate}
                  onChange={(e) => setSetting("taxRate", parseFloat(e.target.value) || 0)}
                  style={{ width: "64px", padding: "8px 10px", borderRadius: "9px", border: "none", background: "var(--hairline)", fontSize: "14px", fontFamily: "inherit", textAlign: "right" }}
                />
                <span style={{ fontSize: "13px", color: "var(--text-2)" }}>%</span>
              </span>
            </label>
          )}
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px" }}>チャージ料</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="number"
                min={0}
                value={settings.chargeRate}
                onChange={(e) => setSetting("chargeRate", parseFloat(e.target.value) || 0)}
                style={{ width: "64px", padding: "8px 10px", borderRadius: "9px", border: "none", background: "var(--hairline)", fontSize: "14px", fontFamily: "inherit", textAlign: "right" }}
              />
              <span style={{ fontSize: "13px", color: "var(--text-2)" }}>%</span>
            </span>
          </label>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-2)", margin: "10px 8px 0", lineHeight: 1.5 }}>
          会計時に自動で反映されます。チャージ料は0%で無しになります。
        </div>

        {/* QRコード管理 */}
        <div style={{ ...labelStyle, marginTop: "20px" }}>QRコード管理</div>
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px" }}>
          <QrCodes />
        </div>
      </div>
    </div>
  );
}

const removeBtn: React.CSSProperties = {
  marginTop: "8px",
  border: "none",
  background: "transparent",
  color: "var(--red)",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: 0,
};
