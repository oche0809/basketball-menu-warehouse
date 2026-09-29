import { useState, type FormEvent, type ReactNode } from 'react'
import { CATEGORIES, DIFFICULTIES, SOURCE_TYPES, TARGET_LEVELS } from '../data/options'
import type { MenuInput, PracticeMenu } from '../types/menu'

// animation はフォームでは編集しない（編集しても元の値が残る）
type FormState = Record<Exclude<keyof MenuInput, 'duration' | 'animation'>, string> & { duration: string }

function toForm(menu?: PracticeMenu): FormState {
  return {
    title: menu?.title ?? '',
    category: menu?.category ?? CATEGORIES[0],
    difficulty: menu?.difficulty ?? DIFFICULTIES[0],
    targetLevel: menu?.targetLevel ?? '全員',
    players: menu?.players ?? '',
    duration: String(menu?.duration ?? 10),
    equipment: menu?.equipment.join('、') ?? '',
    purpose: menu?.purpose ?? '',
    setup: menu?.setup ?? '',
    instructions: menu?.instructions ?? '',
    coachingPoints: menu?.coachingPoints.join('\n') ?? '',
    commonMistakes: menu?.commonMistakes.join('\n') ?? '',
    progression: menu?.progression ?? '',
    regression: menu?.regression ?? '',
    tags: menu?.tags.join('、') ?? '',
    sourceType: menu?.sourceType ?? '',
    sourceTitle: menu?.sourceTitle ?? '',
    sourceUrl: menu?.sourceUrl ?? '',
    sourceNote: menu?.sourceNote ?? '',
  }
}

const splitWords = (s: string) => s.split(/[,、，\n]/).map((v) => v.trim()).filter(Boolean)
const splitLines = (s: string) => s.split('\n').map((v) => v.trim()).filter(Boolean)

function toInput(f: FormState): MenuInput {
  return {
    ...f,
    title: f.title.trim(),
    duration: Math.max(0, Number(f.duration) || 0),
    equipment: splitWords(f.equipment),
    coachingPoints: splitLines(f.coachingPoints),
    commonMistakes: splitLines(f.commonMistakes),
    tags: splitWords(f.tags),
    // 出典は空欄なら保存しない（編集で消した場合も消えるよう undefined にする）
    sourceType: f.sourceType || undefined,
    sourceTitle: f.sourceTitle.trim() || undefined,
    sourceUrl: f.sourceUrl.trim() || undefined,
    sourceNote: f.sourceNote.trim() || undefined,
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-bold text-slate-700">{label}</span>
      {hint && <span className="ml-2 text-sm text-slate-500">{hint}</span>}
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="px-1 text-sm font-bold text-orange-700">{title}</legend>
      {children}
    </fieldset>
  )
}

type Props = {
  heading: string
  initial?: PracticeMenu
  onSubmit: (input: MenuInput) => void
  onCancel: () => void
}

export function MenuForm({ heading, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState(() => toForm(initial))

  const bind = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(toInput(form))
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">{heading}</h1>

      <Section title="基本情報">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="メニュー名" hint="必須">
            <input {...bind('title')} required className={inputClass} placeholder="例：ラインドリブル" />
          </Field>
          <Field label="カテゴリ">
            <select {...bind('category')} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="難易度">
            <select {...bind('difficulty')} className={inputClass}>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="対象" hint="選択または自由入力">
            <input {...bind('targetLevel')} list="target-levels" className={inputClass} />
            <datalist id="target-levels">
              {TARGET_LEVELS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="人数">
            <input {...bind('players')} className={inputClass} placeholder="例：2人1組" />
          </Field>
          <Field label="所要時間（分）">
            <input {...bind('duration')} type="number" inputMode="numeric" min={0} className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <Field label="必要な道具" hint="「、」区切り">
              <input {...bind('equipment')} className={inputClass} placeholder="例：ボール、コーン" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="内容">
        <Field label="目的">
          <textarea {...bind('purpose')} rows={2} className={inputClass} />
        </Field>
        <Field label="セットアップ" hint="並び方・配置など">
          <textarea {...bind('setup')} rows={2} className={inputClass} />
        </Field>
        <Field label="実施方法">
          <textarea {...bind('instructions')} rows={5} className={inputClass} />
        </Field>
      </Section>

      <Section title="指導メモ">
        <Field label="指導ポイント" hint="1行に1つ">
          <textarea {...bind('coachingPoints')} rows={4} className={inputClass} />
        </Field>
        <Field label="よくあるミス" hint="1行に1つ">
          <textarea {...bind('commonMistakes')} rows={3} className={inputClass} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="発展（難しくする）">
            <textarea {...bind('progression')} rows={3} className={inputClass} />
          </Field>
          <Field label="簡単にする方法">
            <textarea {...bind('regression')} rows={3} className={inputClass} />
          </Field>
        </div>
        <Field label="タグ" hint="「、」区切り">
          <input {...bind('tags')} className={inputClass} placeholder="例：基礎、1年生向け" />
        </Field>
      </Section>

      <Section title="📚 出典・参考情報">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="出典" hint="任意">
            <select {...bind('sourceType')} className={inputClass}>
              <option value="">なし</option>
              {SOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="出典名" hint="任意">
            <input {...bind('sourceTitle')} className={inputClass} placeholder="例：○○ Basketball Training" />
          </Field>
        </div>
        <Field label="URL" hint="任意">
          <input {...bind('sourceUrl')} inputMode="url" className={inputClass} placeholder="https://..." />
        </Field>
        <Field label="メモ" hint="任意">
          <input {...bind('sourceNote')} className={inputClass} placeholder="例：3人組パス＆カットの説明動画" />
        </Field>
      </Section>

      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-bold hover:bg-slate-50">
          キャンセル
        </button>
        <button type="submit" className="rounded-lg bg-orange-600 px-8 py-3 font-bold text-white hover:bg-orange-700">
          保存する
        </button>
      </div>
    </form>
  )
}
