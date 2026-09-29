import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 静的生成のキャッシュ（ISR）は使っていないので、R2（有料・カード登録が必要）の設定は付けない
export default defineCloudflareConfig({});
