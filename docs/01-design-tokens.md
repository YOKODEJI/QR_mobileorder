# デザイントークン（実装用）

handoff README の「Global Design Language」を、Next.js + Tailwind に落とし込むための確定値。
テーマアクセントは**ユーザー設定で切替**なので、Tailwindの固定色ではなく **CSS変数 `--accent`** で持ち、Tailwindからは `bg-[var(--accent)]` 等で参照する。

## 1. CSS変数（`globals.css` の `:root`）

```css
:root {
  /* サーフェス */
  --app-bg:        #f2f2f7;   /* アプリ背景（iOS system gray 6） */
  --surface:       #ffffff;   /* カード/パネル */
  --header-bg:     rgba(248,248,250,.82); /* フロスト。backdrop-filterと併用 */
  --inset:         #f0f0f2;   /* インセット入力欄背景 */

  /* テキスト */
  --text:          #1c1c1e;   /* 主テキスト */
  --text-2:        #6b6b70;   /* 副テキスト */
  --text-3:        #8e8e93;   /* ミュート */
  --text-4:        #a0a0a5;   /* さらにミュート */

  /* 罫線 */
  --hairline:      #f0f0f2;
  --hairline-2:    #f4f4f6;

  /* コントロール */
  --control-tint:  rgba(118,118,128,.12); /* 未選択セグメント/チップ */
  --chip-tint:     rgba(118,118,128,.10);

  /* 意味色 */
  --blue:          #007aff;   /* リンク/キャンセル */
  --green:         #34c759;
  --green-dark:    #248a3d;
  --green-bg:      #e3f7ea;
  --red:           #ff3b30;
  --red-dark:      #d70015;
  --red-bg:        #ffe5e3;
  --red-bg-2:      #fff0ef;
  --soldout-bg:    #d1d1d6;
  --soldout-text:  #6b6b70;

  /* テーマアクセント（設定で上書き。既定は red-orange） */
  --accent:        #cf4b2c;
  --accent-ink:    #ffffff;   /* アクセント上の文字 */
}
```

### テーマアクセントの5候補（設定画面の丸ボタン）
| 名前 | 値 |
|---|---|
| red-orange（既定） | `#cf4b2c` |
| amber | `#e0902a` |
| green | `#248a3d` |
| blue | `#0a84ff` |
| purple | `#8a4fd0` |

> アクセントが効く箇所: 主ボタン / 数量ステッパー / アクティブなチップ・タブ / 合計金額 / 客用ヘッダー背景。
> 実装: 設定変更時に `document.documentElement.style.setProperty('--accent', value)`。DBには `stores.theme` として1値保存。

## 2. 角丸（radius）
| 用途 | 値 |
|---|---|
| スマホ枠 | 44px |
| 大カード/パネル | 22–24px |
| 中カード/リスト項目 | 14–18px |
| 入力/小コントロール | 9–12px |
| セグメントtrack | 12px / thumb 9px |
| ピル/チップ/トグル | 999px |

Tailwind拡張:
```js
borderRadius: {
  phone: '44px', panel: '22px', 'panel-lg': '24px',
  card: '16px', 'card-sm': '14px', control: '12px', pill: '999px',
}
```

## 3. 影（shadow）
```js
boxShadow: {
  panel:   '0 12px 34px rgba(0,0,0,.06)',
  phone:   '0 30px 70px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04)',
  segment: '0 1px 3px rgba(0,0,0,.14), 0 1px 1px rgba(0,0,0,.04)',
  dialog:  '0 24px 60px rgba(0,0,0,.4)',
}
```

## 4. タイポグラフィ
- フォントスタック: `-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif`
- Noto Sans JP を Google Fonts（`next/font`）で 400/500/700/900 読み込み
- ルートに `zoom: 1.07`（全体を約7%拡大）。Next.jsでは `<body>` かレイアウトのルートdivに適用
- body letter-spacing: `.01em`、見出しは `-.01em`〜`-.02em`
- ウェイト: 400/500/600/700/800/900

## 5. キーフレーム（`globals.css`）
```css
@keyframes kpulse { 0%,100%{box-shadow:0 0 0 4px rgba(255,59,48,.20)} 50%{box-shadow:0 0 0 12px rgba(255,59,48,.03)} }
@keyframes pop     { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
@keyframes sheetup { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
```
- `pop` .22s ease-out … ダイアログ・注文成功カード
- `sheetup` .28–.3s ease-out … シート・設定
- `kpulse` 1s × 2 … 新着キッチン伝票のハイライト

## 6. グローバルCSS必須事項
```css
/* number入力のスピナー非表示 */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
input[type="number"] { -moz-appearance: textfield; }
```

## 7. 再利用コンポーネント仕様（要点）
- **セグメントコントロール**: track `--control-tint`, padding 3px。アクティブ=白ピル+`shadow-segment`、text `--text`/700。非アクティブ text `--text-2`/600。
- **カテゴリチップ**: アクティブ=`--accent`塗り/白/700。非アクティブ=`--chip-tint`/`#3c3c43`/600。radius 999px。
- **iOSトグル**: track 51×31px。ON `--green` / OFF `#e4e4ea`。knob 27px白丸 `0 1px 3px rgba(0,0,0,.25)`、2px→22pxスライド、0.2s。
- **iOSアラート**: 300px幅/radius20px/フロスト白+blur。title 17/700、body 13px `--text-2` line-height1.6 `white-space:pre-line`。ボタン2分割（左キャンセル `--blue`／右 `--blue` or 破壊時 `--red`、16px）。`pop`。
- **ボトムシート**: 上角28px、グラブハンドル38×5px `#d1d1d6`、`sheetup`。
