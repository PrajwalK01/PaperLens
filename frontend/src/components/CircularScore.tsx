import { useEffect, useState } from 'react'

interface Props { value: number; size?: number; strokeWidth?: number }

function scoreColor(v: number) {
  if (v >= 7.5) return '#4ade80'
  if (v >= 6)   return '#34d399'
  if (v >= 5)   return '#cc8757'
  if (v >= 3)   return '#f97316'
  return '#ef4444'
}

export default function CircularScore({ value, size = 120, strokeWidth = 8 }: Props) {
  const r      = (size - strokeWidth) / 2
  const circ   = 2 * Math.PI * r
  const [prog, setP] = useState(0)

  useEffect(() => { const t = setTimeout(() => setP(value / 10), 100); return () => clearTimeout(t) }, [value])

  const offset = circ * (1 - prog)
  const color  = scoreColor(value)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        className="animate-count-up">
        <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'monospace', lineHeight: 1 }}>{value.toFixed(1)}</span>
        <span style={{ fontSize: 9, color: 'rgba(165,180,252,0.4)', marginTop: 1 }}>/ 10</span>
      </div>
    </div>
  )
}
