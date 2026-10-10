import { ImageResponse } from "next/og";
import { fetchStoreSettings } from "@/lib/data";
import { ICON_NAME_FONT } from "@/app/fonts";

type AppKind = "admin" | "handy" | "kitchen";

// ホーム画面に追加したときのアイコン。管理・厨房・ハンディで別の絵にして、3つ並べても見分けがつくようにする。
//   /admin/pwa-icon/192?app=handy   … スマホに注文の行（ハンディ）
//   /admin/pwa-icon/192?app=kitchen … 料理にかぶせる蓋（厨房）
//   /admin/pwa-icon/192?app=admin   … 4つの枠（管理画面）。設定画面でアイコンの画像を登録してあれば、管理画面だけそれを使う
// 地の色は店のテーマ色。絵の下に屋号を入れる（2026-10-11 長谷川さん「屋号もアイコンに入れ込む」）。
// 屋号の書体は店ごと（app/fonts.ts の ICON_NAME_FONT）。使う文字のぶんだけ Google Fonts から取ってくる。
// 取れなかったとき・屋号が長すぎるとき（9文字以上）は、絵だけのアイコンにする（文字化けした札を出さない）。
// &maskable=1 は、端末が丸や角丸に切り抜く用（絵を少し小さくして、切り抜かれても欠けないようにする）。
/** 屋号に使う文字のぶんだけ、書体のデータを取ってくる（画像を作る仕組みは TTF/OTF しか読めない） */
async function loadNameFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${ICON_NAME_FONT}&text=${encodeURIComponent(text)}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;
  const url = new URL(req.url);
  const requested = url.searchParams.get("app");
  const app: AppKind = requested === "handy" || requested === "kitchen" ? requested : "admin";
  const maskable = url.searchParams.get("maskable") === "1";
  const store = await fetchStoreSettings();

  if (app === "admin" && store?.pwaIconUrl) {
    const res = await fetch(store.pwaIconUrl).catch(() => null);
    if (res?.ok) {
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }

  const theme = store?.theme ?? "#cf4b2c";
  const name = (store?.storeName ?? "").trim();
  const font = name && [...name].length <= 8 ? await loadNameFont(name) : null;
  // 屋号を入れるときは、絵を上に寄せて小さくする。端末が丸く切り抜く用（maskable）は、全体をさらに内側へ
  const box = maskable ? 0.62 : 0.84;
  const glyph = Math.round(px * (font ? box * 0.62 : maskable ? 0.62 : 0.78));
  const nameSize = Math.round((px * box * 0.98) / Math.max(4, [...name].length));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: theme,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 絵は画面ごとに1つの svg にする（画像を作る仕組みの都合で、svg の中にまとまり <>…</> を置けない） */}
        {app === "handy" && (
          <svg width={glyph} height={glyph} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {/* スマホと、注文の行 */}
            <rect x="30" y="14" width="40" height="72" rx="8" fill="#fff" />
            <rect x="38" y="27" width="24" height="6" rx="3" fill={theme} />
            <rect x="38" y="39" width="24" height="6" rx="3" fill={theme} />
            <rect x="38" y="51" width="15" height="6" rx="3" fill={theme} />
            <circle cx="50" cy="73" r="4.5" fill={theme} />
          </svg>
        )}
        {app === "kitchen" && (
          <svg width={glyph} height={glyph} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {/* 料理にかぶせる蓋（つまみ・蓋・皿） */}
            <circle cx="50" cy="27" r="6" fill="#fff" />
            <path d="M18 64 A32 32 0 0 1 82 64 Z" fill="#fff" />
            <rect x="12" y="69" width="76" height="8" rx="4" fill="#fff" />
          </svg>
        )}
        {app === "admin" && (
          <svg width={glyph} height={glyph} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {/* 4つの枠（卓・メニュー・履歴・設定をまとめて見る画面） */}
            <rect x="18" y="18" width="29" height="29" rx="7" fill="#fff" />
            <rect x="53" y="18" width="29" height="29" rx="7" fill="#fff" fillOpacity="0.6" />
            <rect x="18" y="53" width="29" height="29" rx="7" fill="#fff" fillOpacity="0.6" />
            <rect x="53" y="53" width="29" height="29" rx="7" fill="#fff" />
          </svg>
        )}
        {font && (
          <div style={{ display: "flex", marginTop: Math.round(px * 0.02), fontFamily: "IconName", fontSize: nameSize, lineHeight: 1.15, color: "#fff" }}>
            {name}
          </div>
        )}
      </div>
    ),
    {
      width: px,
      height: px,
      headers: { "Cache-Control": "public, max-age=300" },
      fonts: font ? [{ name: "IconName", data: font, style: "normal" }] : undefined,
    }
  );
}
