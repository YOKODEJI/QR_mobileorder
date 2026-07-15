import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
