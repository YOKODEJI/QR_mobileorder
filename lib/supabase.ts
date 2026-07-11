import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase クライアント（遅延生成・任意）。
 * 環境変数が未設定なら null を返し、アプリはローカル(Zustand)のまま動く。
 * .env.local に以下を設定すると有効化される:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *   NEXT_PUBLIC_STORE_ID=...        (seed実行時に notice で出た store の uuid)
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? "";

/**
 * 注文/会計を Edge Function(place_order) / RPC(close_table) 経由にするか。
 * true にするのは、supabase/functions.sql を実行し、submit_order をデプロイした後。
 */
export const ORDER_VIA_FUNCTION =
  process.env.NEXT_PUBLIC_ORDER_VIA_FUNCTION === "true";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/** Supabase が設定済みか（URL/キー/STORE_ID が揃っているか） */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && STORE_ID);
}
