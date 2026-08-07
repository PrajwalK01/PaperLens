export type Recommendation = 'Accept' | 'Minor Revision' | 'Major Revision' | 'Reject'

const CFG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Accept:           { bg: 'rgba(20,83,45,0.45)',  color: '#86efac', border: 'rgba(22,101,52,0.6)',  dot: '#4ade80' },
  'Minor Revision': { bg: 'rgba(113,63,18,0.45)', color: '#fde68a', border: 'rgba(146,64,14,0.6)', dot: '#fbbf24' },
  'Major Revision': { bg: 'rgba(124,45,18,0.45)', color: '#fdba74', border: 'rgba(154,52,18,0.6)', dot: '#fb923c' },
  Reject:           { bg: 'rgba(69,10,10,0.45)',  color: '#fca5a5', border: 'rgba(127,29,29,0.6)', dot: '#f87171' },
}

interface Props {
  rec: string | undefined | null
  size?: 'sm' | 'md' | 'lg'
}

export default function RecommendationBadge({ rec, size = 'sm' }: Props) {
  if (!rec) return null
  const c = CFG[rec] ?? { bg: 'rgba(68,42,27,0.5)', color: '#a07850', border: 'rgba(90,56,32,0.5)', dot: '#7a5035' }

  const px   = size === 'lg' ? '10px 14px' : size === 'md' ? '6px 11px' : '4px 9px'
  const fs   = size === 'lg' ? 12           : size === 'md' ? 11          : 10
  const dotS = size === 'lg' ? 7            : 6

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: px, borderRadius: 99, fontSize: fs, fontWeight: 700,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: dotS, height: dotS, borderRadius: '50%', background: c.dot, flexShrink: 0, display: 'inline-block' }} />
      {rec}
    </span>
  )
}
