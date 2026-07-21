// 管理画面の放置ログアウト（12時間アクセスが無ければ自動サインアウト）。
// Supabaseのセッション/リフレッシュトークン自体は開いている限り自動更新され続けるため、
// 「最後に操作した時刻」をこの端末のlocalStorageに自前で記録し、それを基準に判定する。
const LAST_ACTIVITY_KEY = "adminLastActivityAt";
export const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12時間

/** 今この瞬間を「最後にアクセスした時刻」として記録する。 */
export function recordActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* プライベートブラウズ等でlocalStorageが使えない場合は諦める（放置ログアウトなしで動作継続） */
  }
}

/** 記録が無い（初回ログイン等）場合はfalse。まだ一度も判定されていない状態を
 *  「期限切れ」扱いにすると、ログイン直後に即ログアウトされてしまうため。 */
export function isIdleExpired(): boolean {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return false;
    const last = Number(raw);
    if (!Number.isFinite(last)) return false;
    return Date.now() - last > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

export function clearActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
}
