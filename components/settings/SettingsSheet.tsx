"use client";

import { useAppStore } from "@/store/useAppStore";
import Toggle from "@/components/ui/Toggle";
import PhotoSlot from "@/components/ui/PhotoSlot";

const SWATCHES = ["#cf4b2c", "#e0902a", "#248a3d", "#0a84ff", "#8a4fd0"];

export default function SettingsSheet() {
  const showSettings = useAppStore((s) => s.showSettings);
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const closeSettings = useAppStore((s) => s.closeSettings);

  if (!showSettings) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "#8e8e93",
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
          background: "#f2f2f7",
          borderRadius: "26px",
          padding: "20px 18px 24px",
          boxShadow: "0 30px 70px rgba(0,0,0,.4)",
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
              background: "rgba(118,118,128,.14)",
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              fontSize: "15px",
              cursor: "pointer",
              color: "#8e8e93",
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
              background: "#fff",
              fontSize: "16px",
              fontFamily: "inherit",
              color: "#1c1c1e",
            }}
          />
        </div>

        {/* テーマカラー */}
        <div style={labelStyle}>テーマカラー</div>
        <div
          style={{
            background: "#fff",
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

        {/* 写真表示（管理画面から設定。客用は表示のみ） */}
        <div style={labelStyle}>客用ページの写真</div>
        <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden" }}>
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
              />
              {settings.headerPhoto && (
                <button
                  onClick={() => setSetting("headerPhoto", null)}
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
              borderTop: "1px solid #f0f0f2",
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
              />
              {settings.footerPhoto && (
                <button
                  onClick={() => setSetting("footerPhoto", null)}
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
            color: "#8e8e93",
            margin: "10px 8px 0",
            lineHeight: 1.5,
          }}
        >
          写真は管理画面から設定します。客用ページには表示だけされます。
        </div>
      </div>
    </div>
  );
}

const removeBtn: React.CSSProperties = {
  marginTop: "8px",
  border: "none",
  background: "transparent",
  color: "#ff3b30",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: 0,
};
