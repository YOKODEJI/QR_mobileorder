/** 厨房の通知音ON/OFF。店舗全体の設定ではなく、この端末だけのローカル設定
 *  （themeModeと同じ方式）。リロードのたびにデフォルトへ戻ると、OFFにしたい
 *  端末で毎回OFF操作が必要になるため永続化する。既定はON。 */
const KEY = "qr-admin-sound-on";

export function getStoredSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}

export function setStoredSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
}
