import { useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  value: number
  max?: number
  animate?: boolean
}

function barColor(v: number) {
  if (v >= 7.5) return 'linear-gradient(90deg,#15803d,#4ade80)'
  if (v >= 6)   return 'linear-gradient(90deg,#0d7a5a,#34d399)'
  if (v >= 5)   return 'linear-gradient(90deg,#a05c10,#cc8757)'
  if (v >= 3)   return 'linear-gradient(90deg,#9a3412,#f97316)'
  return              'linear-gradient(90deg,#7f1d1d,#ef4444)'
}

export default function ScoreBar({ label, value, max = 10, animate = true }: Props) {
  const [w, setW] = useState(animate ? 0 : (value / max) * 100)
  const done = useRef(false)

  useEffect(() => {
    if (!animate || done.current) return
    done.current = true
    const t = setTimeout(() => setW((value / max) * 100), 100)
    return () => clearTimeout(t)
  }, [animate, value, max])

  const pretty = label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'rgba(165,180,252,0.5)', width: 112, flexShrink: 0, fontWeight: 500 }}>{pretty}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 99, overflow: 'hidden', background: 'rgba(99,102,241,0.12)' }}>
        <div style={{
          width: `${w}%`, height: '100%', borderRadius: 99,
          background: barColor(value),
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
        }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#a5b4fc', width: 18, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
