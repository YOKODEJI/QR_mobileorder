import type { NextConfig } from "next";

// 公開した版の印（ビルドした時刻）。端末が古い版のまま動いていないかを確かめるのに使う（components/UpdateNotice.tsx）
const BUILD_ID = new Date().toISOString();

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  async headers() {
    return [
      {
        // 全ルート共通。/order/[table]?k=<トークン> のURLを外部リンク遷移時の
        // リファラで漏らさないため（strict-origin-when-cross-originは
        // クロスオリジンにはオリジンのみ送りクエリ文字列は送らない）。
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
