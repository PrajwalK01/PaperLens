import type { CSSProperties } from 'react'

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Skeleton style={{ width: 28, height: 28, borderRadius: '50%' }} />
        <Skeleton style={{ height: 14, width: 180, borderRadius: 6 }} />
        <Skeleton style={{ height: 20, width: 72, borderRadius: 99, marginLeft: 'auto' }} />
      </div>
      <Skeleton style={{ height: 11, width: '100%', borderRadius: 6 }} />
      <Skeleton style={{ height: 11, width: '82%',  borderRadius: 6 }} />
      <Skeleton style={{ height: 11, width: '65%',  borderRadius: 6 }} />
      <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
        {[1,2,3].map(i => <Skeleton key={i} style={{ height: 6, flex: 1, borderRadius: 99 }} />)}
      </div>
    </div>
  )
}
