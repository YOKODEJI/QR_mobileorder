// 【店ごとのファイル】書体の読み込み。使い道の割り当ては app/brand.css。
// よこでじ版: よこでじのHPと同じ BIZ UDPGothic（読みやすさ重視のUD書体）。
// 数字だけ別の書体（Montserrat）にする案は、「テーブル 1」のように和文と数字が並ぶと太さがそろわないのでやめた。
// システムの書体のままにしない（docs/10-ui-principles.md）。
//
// 読み込み方: 画面を開いたときに Google Fonts から読む（layout.tsx が <link> を出す）。
// ビルド時に取り込む方式（next/font）は、日本語の書体だと分割ファイルが数百あり、取得が1つでも失敗すると
// ビルドが止まるので使わない。Google Fonts に届かない環境では、端末の書体で表示される（動作は変わらない）。

/** Google Fonts のスタイルシート */
export const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap";
