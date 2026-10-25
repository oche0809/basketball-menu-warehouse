// オフライン対応（Service Worker）。一度インターネットにつながった状態で開くと、アプリ本体をこの端末に保存し、
// 電波がないときでもメニュー・動き・練習計画・実施記録を開けるようにする（YouTube の動画は通信が必要）。
// ・ページ本体（index.html）：まずネットから最新を取り、つながらなければ保存したものを使う
// ・JS・CSS など（ファイル名に版が入っている）：保存したものを使い、なければネットから取って保存する
const CACHE = 'bmw-app-v2'
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
  // 後から読み込むページのファイルも保存しておく（オフラインでも開けるように）
  try {
    const list = await (await fetch(new URL('asset-manifest.json', SCOPE), { cache: 'no-cache' })).json()
    await cache.addAll(list.files.map((f) => new URL(f, SCOPE).href))
  } catch {
    // 一覧が取れなくても、開いたページから順に保存される
  }
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

// 今の版のファイル一覧（index.html が読むもの＋後から読み込むページ）。一覧が取れなければ null
async function currentFiles(html) {
  try {
    const list = await (await fetch(new URL('asset-manifest.json', SCOPE), { cache: 'no-cache' })).json()
    return new Set([...assetUrls(html), ...list.files.map((f) => new URL(f, SCOPE).href)])
  } catch {
    return null
  }
}

// アプリが更新されたら、新しい版のファイルを保存し、古い版の JS・CSS を消す（保存容量が増え続けないように）
async function refreshAssets(cache, html) {
  const files = await currentFiles(html)
  if (!files) return
  const cached = new Set((await cache.keys()).map((r) => r.url))
  await cache.addAll([...files].filter((u) => u.includes('/assets/') && !cached.has(u))).catch(() => {})
  for (const url of cached) if (url.includes('/assets/') && !files.has(url)) await cache.delete(url)
}

async function handlePage(request) {
  const cache = await caches.open(CACHE)
  try {
    // ブラウザの HTTP キャッシュ（GitHub Pages は最大10分）を使わず、毎回最新かを確かめる（更新がすぐ届くように）
    const res = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    if (res.ok) {
      await cache.put(INDEX, res.clone())
      refreshAssets(cache, await res.clone().text())
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
