import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, Clock, FileText, SlidersHorizontal, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { getHistory, getToken, type ReviewJobSummary } from '../api'
import { useAuth } from '../components/ui/Layout'

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString()
}

type Filter = 'all' | 'Accept' | 'Minor Revision' | 'Major Revision' | 'Reject' | 'processing'
const FILTERS: Filter[] = ['all', 'Accept', 'Minor Revision', 'Major Revision', 'Reject', 'processing']

const REC_CLS: Record<string, string> = {
  'Accept':          'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Minor Revision':  'bg-amber-50 text-amber-700 border-amber-200',
  'Major Revision':  'bg-orange-50 text-orange-700 border-orange-200',
  'Reject':          'bg-red-50 text-red-700 border-red-200',
}

const STATUS_DOT: Record<string, string> = {
  queued:     'bg-slate-400',
  processing: 'bg-blue-400 animate-pulse',
  completed:  'bg-emerald-500',
  failed:     'bg-red-500',
}

export default function History() {
  const { user, openAuth } = useAuth()
  const [jobs, setJobs]     = useState<ReviewJobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    getHistory()
      .then(j => { setJobs(j); setLoading(false); setError(null) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [user])

  // ── Not logged in: show a clean prompt instead of the history ────────────
  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Sign in to view your history</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          Log in to see all your previous scientific paper reviews and reports.
        </p>
        <button onClick={() => openAuth('login')}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
            px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm">
          Sign In / Sign Up
        </button>
      </div>
    )
  }

  const filtered = jobs.filter(j => {
    const matchSearch = !search.trim() || (j.paper_title ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all'
      || (filter === 'processing' && (j.status === 'processing' || j.status === 'queued'))
      || j.final_recommendation === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review History</h1>
          {!loading && (
            <p className="text-sm text-slate-500 mt-0.5">
              {jobs.length} review{jobs.length !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <Link to="/"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
            px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          + New Review
        </Link>
      </div>

      {/* ── Search + filter ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by paper title…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
              text-slate-900 placeholder:text-slate-400 transition-colors shadow-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700 hover:border-slate-300'
              }`}>
              {f === 'all' ? 'All' : f === 'processing' ? 'In Progress' : f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!loading && !error && jobs.length === 0 && (
        <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No reviews yet</p>
          <p className="text-sm text-slate-400 mb-5">Submit your first paper to get started.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
            Start your first review <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ── No filter results ─────────────────────────────────────────────── */}
      {!loading && !error && jobs.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
          <p className="text-slate-500 font-medium">No reviews match your search.</p>
          <button onClick={() => { setSearch(''); setFilter('all') }}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium underline">
            Clear filters
          </button>
        </div>
      )}

      {/* ── Results table ────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paper</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Score</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-32 text-right">Verdict</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24 text-right">Submitted</span>
            <span className="w-4" />
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((job, i) => <HistoryRow key={job.id} job={job} index={i} />)}
          </div>
        </div>
      )}

    </div>
  )
}

function HistoryRow({ job, index }: { job: ReviewJobSummary; index: number }) {
  return (
    <Link to={`/review/${job.id}`}
      className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 sm:gap-4 items-center
        px-5 py-4 hover:bg-slate-50 transition-colors group"
      style={{ animationDelay: `${index * 30}ms` }}
      aria-label={`View review of ${job.paper_title ?? 'Untitled'}`}>

      {/* Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">
            {job.paper_title ?? 'Untitled Paper'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[job.status] ?? 'bg-slate-400'}`} />
            <span className="text-xs text-slate-500 capitalize">{job.status}</span>
            <Clock className="w-3 h-3 text-slate-300 ml-1 flex-shrink-0" />
            <span className="text-xs text-slate-400">{timeAgo(job.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="sm:w-20 sm:text-right">
        {job.overall_score != null ? (
          <span className="text-base font-black tabular-nums text-slate-800">
            {job.overall_score.toFixed(1)}
            <span className="text-xs text-slate-400 font-normal ml-0.5">/10</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>

      {/* Verdict */}
      <div className="sm:w-32 sm:text-right">
        {job.final_recommendation ? (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${REC_CLS[job.final_recommendation] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            {job.final_recommendation}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        )}
      </div>

      {/* Date */}
      <div className="hidden sm:block sm:w-24 text-right">
        <span className="text-xs text-slate-400">
          {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
        </span>
      </div>

      {/* Arrow */}
      <ArrowRight className="hidden sm:block w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
    </Link>
  )
}
