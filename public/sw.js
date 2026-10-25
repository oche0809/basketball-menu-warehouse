// オフライン対応（Service Worker）。一度インターネットにつながった状態で開くと、アプリ本体をこの端末に保存し、
// 電波がないときでもメニュー・動き・練習計画・実施記録を開けるようにする（YouTube の動画は通信が必要）。
// ・ページ本体（index.html）：まずネットから最新を取り、つながらなければ保存したものを使う
// ・JS・CSS など（ファイル名に版が入っている）：保存したものを使い、なければネットから取って保存する
const CACHE = 'bmw-app-v1'
const SCOPE = new URL(self.registration.scope)
const INDEX = new URL('./', SCOPE).href

// index.html が読み込む JS・CSS などの URL
const assetUrls = (html) => [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => new URL(m[1], SCOPE).href).filter((u) => u.startsWith(SCOPE.href))

// 初めて開いたときに、ページ本体と、それが使うファイルをまとめて保存する（次からオフラインで開ける）
async function precache() {
  const cache = await caches.open(CACHE)
  const res = await fetch(INDEX, { cache: 'no-cache' })
  if (!res.ok) return
  await cache.put(INDEX, res.clone())
  await cache.addAll(assetUrls(await res.text()))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// 新しい index.html が使うファイル以外の古い JS・CSS を消して、保存容量が増え続けないようにする
async function pruneAssets(cache, html) {
  const used = new Set(assetUrls(html))
  for (const req of await cache.keys()) {
    if (req.url.includes('/assets/') && !used.has(req.url)) await cache.delete(req)
  }
}

async function handlePage(request) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(request)
    if (res.ok) {
      await cache.put(INDEX, res.clone())
      pruneAssets(cache, await res.clone().text())
    }
    return res
  } catch {
    return (await cache.match(INDEX, { ignoreVary: true })) ?? Response.error()
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE)
  // ファイル名に版が入っているので中身は変わらない。Vary（Origin など）の違いは無視して保存したものを使う
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) await cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // 自分のサイト以外（YouTube・サムネイルなど）は保存しない
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return
  if (request.mode === 'navigate') event.respondWith(handlePage(request))
  else event.respondWith(handleAsset(request))
})
