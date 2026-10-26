import type { PracticeMenu, PracticePlan } from '../types/menu'
import { today } from './plan'
import { buildStudentPayload, studentPlanFromPayload, type StudentPayload, type StudentPlan } from './studentView'

// チームページ（見るだけ・URL は固定）。先生が「公開」した練習計画を、生徒がいつでも同じ URL で見られる。
// 公開した計画は GitHub の team-board ブランチの team-board.json に保存し、サイトを作り直して
// https://oche0809.github.io/basketball-menu-warehouse/team-board.json として配る（生徒は GitHub のアカウント不要）
const OWNER = 'oche0809'
const REPO = 'basketball-menu-warehouse'
const BRANCH = 'team-board'
const FILE = 'team-board.json'
const API = `https://api.github.com/repos/${OWNER}/${REPO}`
const TOKEN_KEY = 'basketball-menu-warehouse-team-token'
// 古い予定から消す（ファイルが大きくなりすぎないように）
const MAX_PLANS = 30

// 1つの練習日に1つの計画。同じ日に公開し直すと置き換える
export type BoardEntry = { date: string; publishedAt: string; plan: StudentPayload }
export type Board = { v: 1; updatedAt: string; plans: BoardEntry[] }

export const EMPTY_BOARD: Board = { v: 1, updatedAt: '', plans: [] }
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function normalizeBoard(raw: unknown): Board {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Board>
  if (o.v !== 1 || !Array.isArray(o.plans)) return EMPTY_BOARD
  const plans = o.plans.filter((e): e is BoardEntry => !!e && isDate(e.date) && !!studentPlanFromPayload(e.plan))
  return { v: 1, updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '', plans }
}

// 計画を公開（同じ日付のものは置き換え）。日付順に並べ、多すぎたら古いものから消す
export function publishToBoard(board: Board, plan: PracticePlan, menus: PracticeMenu[], withNotes: boolean, now = new Date()): Board {
  const date = isDate(plan.date) ? plan.date : today()
  const entry: BoardEntry = { date, publishedAt: now.toISOString(), plan: buildStudentPayload({ ...plan, date }, menus, withNotes) }
  const plans = [...board.plans.filter((e) => e.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_PLANS)
  return { v: 1, updatedAt: now.toISOString(), plans }
}

export function removeFromBoard(board: Board, date: string, now = new Date()): Board {
  return { v: 1, updatedAt: now.toISOString(), plans: board.plans.filter((e) => e.date !== date) }
}

export type BoardPlan = StudentPlan & { publishedAt: string }

// 生徒のページ用：今日以降（近い順）と、終わった練習（新しい順）に分ける
export function splitBoard(board: Board, day = today()): { upcoming: BoardPlan[]; past: BoardPlan[] } {
  const plans = board.plans.flatMap((e): BoardPlan[] => {
    const p = studentPlanFromPayload(e.plan)
    return p ? [{ ...p, date: e.date, publishedAt: e.publishedAt }] : []
  })
  return { upcoming: plans.filter((p) => p.date >= day), past: plans.filter((p) => p.date < day).reverse() }
}

export const teamPageUrl = () => `${location.origin}${location.pathname}#/team`

// 生徒の端末：公開中の予定を読む（毎回最新を取りにいく）。まだ公開したことがなければ空
export async function fetchPublicBoard(): Promise<Board> {
  const res = await fetch(`${import.meta.env.BASE_URL}${FILE}?t=${Date.now()}`, { cache: 'no-store' })
  if (res.status === 404) return EMPTY_BOARD
  if (!res.ok) throw new Error(`読み込めませんでした（${res.status}）`)
  return normalizeBoard(await res.json())
}

// ---- 先生の端末だけ：GitHub への書き込み ----
// 書き込みには先生の GitHub のトークン（このリポジトリの Contents だけ書き込める Fine-grained token）を使う。
// トークンはこの端末のブラウザだけに保存し、バックアップのファイルにも入れない
export function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 保存できない環境では、開くたびに入力してもらう
  }
}

async function github(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init?.headers },
  })
  if (res.status === 401) throw new Error('トークンが正しくないか、期限が切れています。トークンを入れ直してください。')
  if (res.status === 403) throw new Error('このトークンには書き込みの許可がありません。「Contents：Read and write」を選んで作り直してください。')
  return res
}

// 日本語を含む JSON を Base64 にする（GitHub の API はファイルの中身を Base64 で受け渡しする）
const toBase64 = (text: string) => btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(''))
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)))

// 今 GitHub に保存されている予定（公開サイトより新しい）。sha は上書きするときに必要
export async function loadRemoteBoard(token: string): Promise<{ board: Board; sha?: string }> {
  const res = await github(token, `/contents/${FILE}?ref=${BRANCH}`)
  if (res.status === 404) return { board: EMPTY_BOARD }
  if (!res.ok) throw new Error(`GitHub から読み込めませんでした（${res.status}）`)
  const data = (await res.json()) as { content: string; sha: string }
  return { board: normalizeBoard(JSON.parse(fromBase64(data.content))), sha: data.sha }
}

// 保存して、サイトの作り直し（公開）を始める。生徒の画面に出るまで1〜2分かかる
export async function saveRemoteBoard(token: string, board: Board, sha: string | undefined, message: string) {
  const res = await github(token, `/contents/${FILE}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: toBase64(JSON.stringify(board, null, 1)), branch: BRANCH, ...(sha && { sha }) }),
  })
  if (res.status === 409 || res.status === 422) throw new Error('ほかの端末で同時に更新されました。もう一度お試しください。')
  if (!res.ok) throw new Error(`GitHub に保存できませんでした（${res.status}）`)
  const dispatch = await github(token, '/dispatches', { method: 'POST', body: JSON.stringify({ event_type: 'team-board' }) })
  if (!dispatch.ok) throw new Error(`保存はできましたが、サイトの更新を始められませんでした（${dispatch.status}）`)
}
