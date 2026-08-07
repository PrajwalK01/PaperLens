import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, Users, Tag, Calendar, ExternalLink,
  BookOpen, ChevronDown, ChevronUp, Cpu, Zap, CheckCircle2,
  AlertTriangle, Clock, Loader2,
} from 'lucide-react'
import { getReview, type ReviewJob, type AgentResponse, type FinalReview } from '../api'
import ProgressTracker from '../components/ProgressTracker'
import GroupReviewPanel from '../components/GroupReviewPanel'
import FinalVerdict from '../components/FinalVerdict'
import { SkeletonCard } from '../components/Skeleton'
import RecommendationBadge from '../components/RecommendationBadge'

type WSMessage = { event: string; job_id: string; data: Record<string, unknown> }

// Agent pipeline — used only for the avatar row in the AI Analysis header
const AGENT_PIPELINE = [
  { id: 'a-primary', group: 'A', role: 'primary',     label: 'C',  color: '#6366f1' },
  { id: 'a-critic',  group: 'A', role: 'critic',      label: 'G',  color: '#10b981' },
  { id: 'b-primary', group: 'B', role: 'primary',     label: 'G4', color: '#3b82f6' },
  { id: 'b-critic',  group: 'B', role: 'critic',      label: 'M',  color: '#8b5cf6' },
  { id: 'synth',     group: 'S', role: 'synthesizer', label: 'S',  color: '#f59e0b' },
]

export default function ReviewDashboard() {
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob]               = useState<ReviewJob | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [abstractExpanded, setAbstractExpanded] = useState(false)
  const comparisonRef = useRef<HTMLDivElement>(null)
  const wsRef   = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return
    getReview(jobId)
      .then(j => { setJob(j); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    const wsBase = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsBase}/ws/review/${jobId}`)
    wsRef.current = ws
    ws.onmessage = evt => {
      try {
        const msg: WSMessage = JSON.parse(evt.data)
        if (msg.event === 'agent_complete') {
          const ar = msg.data as unknown as AgentResponse
          setJob(prev => {
            if (!prev) return prev
            if (prev.agent_responses.find(r => r.id === ar.id)) return prev
            return { ...prev, agent_responses: [...prev.agent_responses, ar] }
          })
        }
        if (msg.event === 'job_complete') {
          setJob(prev => prev ? { ...prev, status: 'completed', final_review: msg.data.final_review as FinalReview, completed_at: new Date().toISOString() } : prev)
        }
        if (msg.event === 'job_failed') {
          setJob(prev => prev ? { ...prev, status: 'failed', error_message: msg.data.error_message as string } : prev)
        }
        if (msg.event === 'status') {
          setJob(prev => prev ? { ...prev, status: msg.data.status as ReviewJob['status'] } : prev)
        }
      } catch { /* ignore */ }
    }
    ws.onerror = () => {
      pollRef.current = setInterval(() => {
        getReview(jobId!).then(j => {
          setJob(j)
          if (j.status === 'completed' || j.status === 'failed') clearInterval(pollRef.current!)
        }).catch(() => {})
      }, 5000)
    }
    return () => { ws.close(); if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobId])

  const scrollToComparison = () => {
    setShowComparison(true)
    setTimeout(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
      <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
      <SkeletonCard /><SkeletonCard />
    </div>
  )

  if (error || !job) return (
    <div className="text-center py-20">
      <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-red-600 font-medium mb-4">{error ?? 'Review not found.'}</p>
      <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
        ← New Review
      </Link>
    </div>
  )

  const groupA = job.agent_responses.filter(r => r.group === 'A')
  const groupB = job.agent_responses.filter(r => r.group === 'B')
  const bothCriticsDone = groupA.some(r => r.agent_role === 'critic') && groupB.some(r => r.agent_role === 'critic')
  const doneCount = job.agent_responses.filter(r => r.status === 'completed').length

  return (
    <div className="space-y-5 pb-8">

      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> New Review
      </Link>

      {/* ── SECTION 1: PAPER ─────────────────────────────────────────── */}
      <PaperSection job={job} abstractExpanded={abstractExpanded} onToggleAbstract={() => setAbstractExpanded(v => !v)} />

      {/* ── SECTION 2: AI ANALYSIS ───────────────────────────────────── */}
      <AiSection
        job={job} doneCount={doneCount} bothCriticsDone={bothCriticsDone}
        showComparison={showComparison} comparisonRef={comparisonRef}
        onShowComparison={scrollToComparison}
        onToggleComparison={() => setShowComparison(v => !v)}
      />
    </div>
  )
}

// ── Paper Section ─────────────────────────────────────────────────────────────
function PaperSection({ job, abstractExpanded, onToggleAbstract }:
  { job: ReviewJob; abstractExpanded: boolean; onToggleAbstract: () => void }) {
  const p = job.paper

  const statusBadge: Record<string, string> = {
    queued:     'bg-slate-100 text-slate-600 border-slate-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    completed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed:     'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <section>
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Paper</span>
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] text-slate-400 font-mono">Submitted for review</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5">
          {/* Title + status */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-snug">
                {p?.title ?? 'Untitled Paper'}
              </h1>
              {p?.authors && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-500">{p.authors}</p>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 flex-shrink-0 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusBadge[job.status] ?? statusBadge.queued}`}>
                {job.status}
              </span>
              {job.final_review?.final_recommendation && (
                <RecommendationBadge rec={job.final_review.final_recommendation} size="md" />
              )}
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {p?.research_field && <Chip icon={<Tag className="w-3 h-3" />} label={p.research_field} color="indigo" />}
            {p?.arxiv_id && (
              <a href={`https://arxiv.org/abs/${p.arxiv_id}`} target="_blank" rel="noopener noreferrer">
                <Chip icon={<ExternalLink className="w-3 h-3" />} label={`arXiv:${p.arxiv_id}`} color="sky" />
              </a>
            )}
            {p?.created_at && (
              <Chip icon={<Calendar className="w-3 h-3" />}
                label={new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                color="slate" />
            )}
            {job.completed_at && (
              <Chip icon={<Clock className="w-3 h-3" />}
                label={`Reviewed ${new Date(job.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                color="green" />
            )}
          </div>
        </div>

        {/* Abstract collapsible */}
        {p?.abstract && (
          <div className="border-t border-slate-100">
            <button onClick={onToggleAbstract}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Abstract</span>
              </div>
              {abstractExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {abstractExpanded && (
              <div className="px-6 pb-5 animate-fade-in">
                <p className="text-sm text-slate-600 leading-relaxed">{p.abstract}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Chip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  const cls: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    sky:    'bg-sky-50 border-sky-200 text-sky-700 hover:border-sky-400 cursor-pointer',
    slate:  'bg-slate-50 border-slate-200 text-slate-500',
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${cls[color] ?? cls.slate}`}>
      {icon}{label}
    </span>
  )
}

// ── AI Analysis Section ───────────────────────────────────────────────────────
function AiSection({ job, doneCount, bothCriticsDone, showComparison, comparisonRef, onShowComparison, onToggleComparison }: {
  job: ReviewJob; doneCount: number; bothCriticsDone: boolean;
  showComparison: boolean; comparisonRef: React.RefObject<HTMLDivElement>;
  onShowComparison: () => void; onToggleComparison: () => void;
}) {
  const total     = 5
  const pct       = Math.round((doneCount / total) * 100)
  const isRunning = job.status === 'processing' || job.status === 'queued'
  const isFailed  = job.status === 'failed'
  const isDone    = job.status === 'completed'

  return (
    <section>
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">AI Analysis</span>
        <div className="flex-1 h-px bg-slate-200" />

        {/* Agent avatar dots */}
        <div className="flex items-center gap-1">
          {AGENT_PIPELINE.map(a => {
            const done = job.agent_responses.some(r => r.group === a.group && r.agent_role === a.role && r.status === 'completed')
            return (
              <div key={a.id} title={`${a.label} (${a.role})`}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-black transition-all ${
                  done ? 'text-white' : 'text-slate-300 bg-white'
                }`}
                style={{ borderColor: a.color, background: done ? a.color : undefined }}>
                {done ? <CheckCircle2 className="w-3 h-3" /> : <span style={{ color: a.color }}>{a.label[0]}</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        {/* Pipeline status card */}
        <div className={`bg-white border rounded-2xl shadow-sm px-6 py-4 ${
          isFailed ? 'border-red-200' : isDone ? 'border-emerald-200' : isRunning ? 'border-indigo-200' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isDone    && <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />}
              {isRunning && <Loader2 className="w-6 h-6 text-indigo-500 animate-spin flex-shrink-0" />}
              {isFailed  && <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />}
              {!isDone && !isRunning && !isFailed && <Zap className="w-6 h-6 text-slate-400 flex-shrink-0" />}
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isDone ? 'Analysis Complete' : isRunning ? 'Running Multi-Agent Pipeline…' : isFailed ? 'Pipeline Failed' : 'Queued'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isDone
                    ? `All ${total} agents finished${job.completed_at ? ' · ' + new Date(job.completed_at).toLocaleTimeString() : ''}`
                    : `${doneCount} of ${total} agents complete`}
                </p>
              </div>
            </div>
            {isDone && job.final_review?.final_scores?.overall != null && (
              <div className="text-right flex-shrink-0">
                <p className="text-3xl font-black tabular-nums text-indigo-600">
                  {job.final_review.final_scores.overall.toFixed(1)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">out of 10</p>
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${
              isFailed ? 'bg-red-400' : isDone ? 'bg-emerald-500' : 'bg-indigo-500'
            }`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* ProgressTracker */}
        <ProgressTracker responses={job.agent_responses} jobStatus={job.status} />

        {/* Final Verdict */}
        {job.final_review && (
          <FinalVerdict finalReview={job.final_review} jobId={job.id} onShowComparison={onShowComparison} />
        )}

        {/* Group comparison */}
        {bothCriticsDone && (
          <div ref={comparisonRef}>
            {!showComparison && !job.final_review && (
              <button onClick={onToggleComparison}
                className="w-full py-3 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                View Group A vs Group B Debate
              </button>
            )}
            {(showComparison || !job.final_review) && (
              <div className="space-y-4 animate-slide-up">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-slate-700">Group A vs Group B</h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <button onClick={onToggleComparison} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors">
                    {showComparison ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GroupReviewPanel group="A" responses={job.agent_responses} />
                  <GroupReviewPanel group="B" responses={job.agent_responses} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Failed state */}
        {isFailed && !job.final_review && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Review job failed</p>
                {job.error_message && (
                  <p className="text-sm mt-1 text-red-600 leading-relaxed">{job.error_message}</p>
                )}
                <Link to="/" className="inline-flex items-center gap-2 mt-3 bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors">
                  ← Try again
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
