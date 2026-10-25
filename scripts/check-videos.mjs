// 参考動画（src/data/referenceVideos.json）がまだ見られるかを YouTube の公開API（oEmbed）で確かめる。
// 使い方：node scripts/check-videos.mjs [結果を書くMarkdownファイル]
// 見られない動画があっても終了コードは 0（GitHub Actions 側で件数を見て Issue を作る）
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../src/data/referenceVideos.json', import.meta.url), 'utf8'))
const items = Object.entries(data.videos).flatMap(([menuId, list]) => list.map((v) => ({ menuId, ...v })))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ok：見られる／broken：削除・非公開・埋め込み禁止／unknown：通信エラーなどで判断できない
async function check(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
      if (res.ok) return { status: 'ok' }
      if (res.status === 401 || res.status === 403) return { status: 'broken', reason: '埋め込み再生が禁止されました' }
      if (res.status === 400 || res.status === 404) return { status: 'broken', reason: '削除または非公開になりました' }
    } catch {
      // 通信エラーは少し待って再試行
    }
    await sleep(2000 * (attempt + 1))
  }
  return { status: 'unknown' }
}

const results = []
const queue = [...items]
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const item = queue.shift()
      results.push({ ...item, ...(await check(item.url)) })
    }
  }),
)

const broken = results.filter((r) => r.status === 'broken').sort((a, b) => a.menuId.localeCompare(b.menuId))
const unknown = results.filter((r) => r.status === 'unknown')

const lines = [
  `参考動画 ${results.length}本を確認しました（見られない：${broken.length}本、確認できず：${unknown.length}本）。`,
  '',
]
if (broken.length) {
  lines.push('## 見られなくなった動画', '', '| メニューID | 動画 | 状態 |', '| --- | --- | --- |')
  for (const r of broken) lines.push(`| ${r.menuId} | [${r.title.replace(/\|/g, '｜')}](${r.url}) | ${r.reason} |`)
  lines.push('', '`src/data/referenceVideos.json` から該当メニューの動画を外すか、別の動画に差し替えてください。')
}
if (unknown.length) {
  lines.push('', '## 通信エラーで確認できなかった動画（次回もう一度確認します）', '')
  for (const r of unknown) lines.push(`- ${r.menuId}：${r.url}`)
}
const report = lines.join('\n') + '\n'

console.log(report)
if (process.argv[2]) writeFileSync(process.argv[2], report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `broken=${broken.length}\n`)
