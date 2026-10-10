// 【店ごとのファイル】書体の読み込み。使い道の割り当ては app/brand.css。
// よこでじ版: Zen Kaku Gothic New（2026-10-10 長谷川さん「日ノ出茶屋の書体の雰囲気をよこでじにも」）。
// 屋号は筆文字にせず、同じゴシックのまま出す。
// システムの書体のままにしない（docs/10-ui-principles.md）。
//
// 読み込み方: 画面を開いたときに Google Fonts から読む（layout.tsx が <link> を出す）。
// ビルド時に取り込む方式（next/font）は、日本語の書体だと分割ファイルが数百あり、取得が1つでも失敗すると
// ビルドが止まるので使わない。Google Fonts に届かない環境では、端末の書体で表示される（動作は変わらない）。

/** Google Fonts のスタイルシート */
export const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700&display=swap";
