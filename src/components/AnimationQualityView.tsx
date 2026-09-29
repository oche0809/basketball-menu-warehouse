import { FEATURE_LABELS, type Feature } from '../utils/animationQuality'

// 品質の3段階（❌ エラー はチェックに通らないもの）
export function QualityBadge({ level }: { level: 'ok' | 'warn' | 'error' }) {
  const style = {
    ok: ['✅ 正常', 'bg-emerald-50 text-emerald-800'],
    warn: ['⚠️ 要確認', 'bg-amber-50 text-amber-800'],
    error: ['❌ エラー', 'bg-rose-50 text-rose-700'],
  }[level]
  return <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${style[1]}`}>{style[0]}</span>
}

// 動きの種類（パスあり・シュートありなど）
export function FeatureChips({ features }: { features: Feature[] }) {
  if (features.length === 0) return <span className="text-xs text-slate-400">動きの種類なし</span>
  return (
    <>
      {features.map((f) => (
        <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
          {FEATURE_LABELS[f]}
        </span>
      ))}
    </>
  )
}
