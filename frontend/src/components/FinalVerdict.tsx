import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Download, FileJson, ExternalLink, BookOpen, Star } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import type { FinalReview } from '../api'
import { getRelatedPapers, type RelatedPaper } from '../api'
import ScoreBar from './ScoreBar'
import RecommendationBadge from './RecommendationBadge'
import CircularScore from './CircularScore'

interface Props {
  finalReview: FinalReview
  jobId?: string
  paperId?: string
  onShowComparison?: () => void
}

const CONFIDENCE_MAP = {
  High: { cls: 'text-green-400 bg-green-900/30 border-green-800', label: 'High Confidence' },
  Medium: { cls: 'text-amber-400  bg-amber-900/30  border-amber-800', label: 'Medium Confidence' },
  Low: { cls: 'text-red-400    bg-red-900/30    border-red-900', label: 'Low Confidence' },
}

// ── Score Radar ───────────────────────────────────────────────────────────────

function ScoreRadar({ scores }: { scores: FinalReview['final_scores'] }) {
  const data = [
    { subject: 'Novelty', value: scores.novelty },
    { subject: 'Technical', value: scores.technical_soundness },
    { subject: 'Method', value: scores.methodology },
    { subject: 'Clarity', value: scores.clarity },
    { subject: 'Impact', value: scores.impact },
  ]
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <PolarGrid stroke="rgba(255,255,255,0.07)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Inter' }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.15}
          strokeWidth={1.5}
        />
        <Tooltip
          contentStyle={{
            background: '#1e1b4b',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#fbbf24' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── Export helpers ────────────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadTextAsPdf(fr: FinalReview) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SPR Review Report</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; line-height: 1.7; }
    h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    h2 { color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 28px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 13px; }
    .accept { background: #dcfce7; color: #166534; }
    .minor { background: #fef9c3; color: #854d0e; }
    .major { background: #fed7aa; color: #9a3412; }
    .reject { background: #fee2e2; color: #991b1b; }
    .score-box { background: #f1f5f9; border-radius: 12px; padding: 20px; display: inline-block; text-align: center; margin: 10px 0; }
    .score-big { font-size: 48px; font-weight: 900; color: #4f46e5; }
    .score-sub { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    td:first-child { font-weight: 600; width: 160px; color: #475569; }
    .strength { color: #166534; } .weakness { color: #991b1b; }
    li { margin: 6px 0; }
    footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>🔬 Scientific Paper Reviewer — AI Review Report</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

  <div style="display:flex;align-items:center;gap:20px;margin:20px 0;">
    <div class="score-box">
      <div class="score-big">${fr.final_scores.overall.toFixed(1)}</div>
      <div class="score-sub">out of 10</div>
    </div>
    <div>
      <span class="badge ${
        fr.final_recommendation === 'Accept' ? 'accept' :
        fr.final_recommendation === 'Minor Revision' ? 'minor' :
        fr.final_recommendation === 'Major Revision' ? 'major' : 'reject'
      }">${fr.final_recommendation}</span>
      <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Confidence: <strong>${fr.confidence}</strong></p>
    </div>
  </div>

  <h2>Dimension Scores</h2>
  <table>
    ${Object.entries(fr.final_scores).filter(([k]) => k !== 'overall').map(([k, v]) =>
      `<tr><td>${k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td><td>${v}/10</td></tr>`
    ).join('')}
  </table>

  <h2>Consolidated Summary</h2>
  <p>${fr.consolidated_summary}</p>

  <h2>Key Strengths</h2>
  <ul>${fr.key_strengths.map(s => `<li class="strength">✓ ${s}</li>`).join('')}</ul>

  <h2>Key Weaknesses</h2>
  <ul>${fr.key_weaknesses.map(w => `<li class="weakness">✗ ${w}</li>`).join('')}</ul>

  <h2>Detailed Feedback</h2>
  <p>${fr.detailed_final_feedback}</p>

  <h2>Synthesis Rationale</h2>
  <p>${fr.synthesis_rationale}</p>

  <footer>Scientific Paper Reviewer · AI-Powered Peer Review Platform · Generated by 5-Agent Pipeline</footer>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
  win.document.close()
}

// ── Expandable section ────────────────────────────────────────────────────────

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(13,15,26,0.7)', border: '1px solid rgba(99,102,241,0.15)' }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-all"
        style={{ background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => setOpen(v => !v)}>
        <span className="text-sm font-semibold text-indigo-200/70">{title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-indigo-400/40" />
          : <ChevronDown className="w-4 h-4 text-indigo-400/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 animate-fade-in"
          style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinalVerdict({ finalReview: fr, jobId, paperId, onShowComparison }: Props) {
  const conf = CONFIDENCE_MAP[fr.confidence]
  const [relatedPapers, setRelatedPapers] = useState<RelatedPaper[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  useEffect(() => {
    if (!paperId) return
    setLoadingRelated(true)
    getRelatedPapers(paperId, 5)
      .then(setRelatedPapers)
      .finally(() => setLoadingRelated(false))
  }, [paperId])

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Hero card */}
      <div className="rounded-xl overflow-hidden animate-fade-in"
        style={{ background: 'rgba(13,15,26,0.8)', border: '1px solid rgba(245,158,11,0.25)' }}>
        {/* Top strip */}
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="flex items-center gap-3">
            <VerdictStar />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'rgba(251,191,36,0.6)' }}>Final Verdict</p>
              <h2 className="text-xl font-bold text-white">Consolidated Review</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <RecommendationBadge rec={fr.final_recommendation} size="lg" />
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${conf.cls}`}>
              {conf.label}
            </span>
          </div>
        </div>

        {/* Score + radar + bars */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Circular score */}
          <div className="flex flex-col items-center justify-center gap-3">
            <CircularScore value={fr.final_scores.overall} size={130} strokeWidth={9} />
            <p className="text-xs text-slate-500 text-center">Overall Score</p>
          </div>

          {/* Radar */}
          <div className="flex items-center justify-center">
            <ScoreRadar scores={fr.final_scores} />
          </div>

          {/* Dimension bars */}
          <div className="flex flex-col justify-center space-y-2.5">
            {Object.entries(fr.final_scores)
              .filter(([k]) => k !== 'overall')
              .map(([k, v]) => (
                <ScoreBar key={k} label={k} value={v as number} />
              ))}
          </div>
        </div>
      </div>

      {/* Consolidated summary */}
      <div className="rounded-xl p-5 animate-fade-in"
        style={{ background: 'rgba(13,15,26,0.7)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(99,102,241,0.45)' }}>Consolidated Summary</p>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(165,180,252,0.7)' }}>
          {fr.consolidated_summary}
        </p>
      </div>

      {/* Strengths + Weaknesses side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 animate-fade-in"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(110,231,183,0.6)' }}>Key Strengths</p>
          <ul className="space-y-2">
            {fr.key_strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(165,180,252,0.65)' }}>
                <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: '#6ee7b7' }}>+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-5 animate-fade-in"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(252,165,165,0.6)' }}>Key Weaknesses</p>
          <ul className="space-y-2">
            {fr.key_weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(165,180,252,0.65)' }}>
                <span className="font-bold flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }}>−</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Expandable sections */}
      <div className="space-y-2">
        <Section title="Detailed Final Feedback" defaultOpen>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(165,180,252,0.6)' }}>{fr.detailed_final_feedback}</p>
        </Section>
        <Section title="Synthesis Rationale — How the Judge Decided">
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(165,180,252,0.6)' }}>{fr.synthesis_rationale}</p>
        </Section>
      </div>

      {/* Related Papers from OpenAlex */}
      <div className="rounded-xl overflow-hidden animate-fade-in"
        style={{ background: 'rgba(13,15,26,0.7)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <div className="px-5 py-4 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <p className="text-sm font-bold text-white">Related Papers</p>
          <span className="text-[10px] text-indigo-400/40 ml-1">via OpenAlex</span>
        </div>
        <div className="p-4 space-y-2">
          {loadingRelated ? (
            <div className="flex items-center gap-2 py-2" style={{ color: 'rgba(165,180,252,0.4)' }}>
              <div className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
              <span className="text-xs">Searching OpenAlex…</span>
            </div>
          ) : relatedPapers.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(165,180,252,0.35)' }}>No related papers found.</p>
          ) : (
            relatedPapers.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg transition-all group"
                style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-200/80 truncate group-hover:text-white transition-colors">
                    {p.title}
                  </p>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(165,180,252,0.4)' }}>
                    {p.authors}{p.year ? ` · ${p.year}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1" style={{ color: 'rgba(165,180,252,0.4)' }}>
                    <Star className="w-2.5 h-2.5" />
                    <span className="text-[9px] font-mono">{p.citations.toLocaleString()}</span>
                  </div>
                  {p.open_access && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>OA</span>
                  )}
                </div>
                <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'rgba(99,102,241,0.35)' }} />
              </a>
            ))
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex gap-2">
          <button onClick={() => downloadTextAsPdf(fr)}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}>
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
          <button onClick={() => downloadJson(fr, `PaperAI-verdict-${jobId ?? 'export'}.json`)}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}>
            <FileJson className="w-3.5 h-3.5" /> Download JSON
          </button>
        </div>
        {onShowComparison && (
          <button onClick={onShowComparison}
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: 'rgba(99,102,241,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(99,102,241,0.5)')}>
            <ExternalLink className="w-3.5 h-3.5" /> View Group A / B comparison
          </button>
        )}
      </div>
    </div>
  )
}

function VerdictStar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-600/30 flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fbbf24" aria-hidden="true">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    </div>
  )
}
