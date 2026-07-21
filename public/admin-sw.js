// 管理画面(/admin配下)専用の最小構成Service Worker。
// 方針は「最小限」: オフライン用の案内ページ1枚だけをキャッシュし、
// 厨房/会計/メニューのデータそのものは一切キャッシュしない
// （注文はリアルタイム性が命なので、古いデータを誤って見せるくらいなら
//   「オフラインです」と正直に出す方を選ぶ）。

const CACHE_NAME = "admin-offline-v1";
const OFFLINE_URL = "/admin-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // ページ遷移（ナビゲーション）だけを対象にする。
  // API/データ通信はそのままネットワークへ（キャッシュを一切挟まない）。
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
