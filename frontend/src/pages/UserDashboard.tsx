import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Download,
  Share2,
  Trash2,
  Clock,
  BookOpen,
  AlignLeft,
  ShieldAlert,
  Edit3,
  Bot,
  Search,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Star,
  Folder,
  Users,
} from 'lucide-react';
import {
  getUserStats,
  getDashboardPapers,
  getActivity,
  getHistory,
  login,
  getToken,
  register,
  type UserStats,
  type DashboardPaper,
  type ActivityGroup,
  type ReviewJobSummary,
} from '../api';
import { useAuth } from '../components/ui/Layout';

// ── Auth Context ─────────────────────────────────────────────────────────────

async function ensureLoggedIn(): Promise<boolean> {
  // Check if user already has valid token
  if (getToken()) return true;
  // User must login manually - no auto-login for security
  return false;
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const { user, openAuth } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [papers, setPapers] = useState<DashboardPaper[]>([]);
  const [history, setHistory] = useState<ReviewJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const authed = await ensureLoggedIn();
      if (!authed) {
        // Not logged in — show a login prompt rather than a scary "backend error"
        setError('not_logged_in');
        setLoading(false);
        return;
      }

      const [statsRes, papersRes, histRes] = await Promise.all([
        getUserStats(),
        getDashboardPapers(),
        getHistory(),
      ]);

      setStats(statsRes);
      setPapers(papersRes.papers);
      setHistory(histRes);
      setIsConnected(true);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('not_logged_in');
      } else {
        setError(err?.response?.data?.detail || 'Failed to connect to backend. Is it running on port 8000?');
      }
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30 seconds to pick up real-time processing changes
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll, user]);

  const username = stats?.username || 'User';

  // ── Not logged in: show a clean prompt instead of the dashboard ────────────
  if (!loading && error === 'not_logged_in') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Users className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Sign in to view your dashboard</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          Log in to see your papers, review history, and statistics.
        </p>
        <button onClick={() => openAuth('login')}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
            px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm">
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            Welcome back, {username.charAt(0).toUpperCase() + username.slice(1)}! 👋
            {isConnected ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                ● Live
              </span>
            ) : (
              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200">
                ● Offline
              </span>
            )}
          </h2>
          <p className="text-[13px] text-slate-500">
            Here's what's happening with your research today.{' '}
            {isConnected && (
              <span className="text-slate-400 text-[11px]">
                Last synced: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Error Banner — only for real backend errors, not auth issues */}
      {error && error !== 'not_logged_in' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Backend Connection Error</p>
            <p className="text-xs mt-0.5">{error}</p>
            <button
              onClick={fetchAll}
              className="text-xs font-bold text-red-700 underline mt-1"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-24 animate-pulse">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-5 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          <StatCard
            icon={<FileText className="text-indigo-600" size={20} />}
            bg="bg-indigo-50"
            value={stats?.total_papers ?? 0}
            label="Total Papers"
            sub={`${stats?.completed_reviews ?? 0} reviews done`}
            trendColor="text-indigo-500"
          />
          <StatCard
            icon={<Folder className="text-blue-600" size={20} />}
            bg="bg-blue-50"
            value={stats?.total_reviews ?? 0}
            label="Total Reviews"
            sub={`Avg: ${stats?.average_time ?? '—'}`}
            trendColor="text-blue-500"
          />
          <StatCard
            icon={<Users className="text-emerald-600" size={20} />}
            bg="bg-emerald-50"
            value={stats?.completed_reviews ?? 0}
            label="Completed"
            sub="AI review cycles"
            trendColor="text-emerald-500"
          />
          <StatCard
            icon={<Star className="text-amber-500" size={20} />}
            bg="bg-amber-50"
            value={stats?.average_score ?? '—'}
            label="Avg Score"
            sub="out of 10.0"
            trendColor="text-amber-500"
          />
        </div>
      )}

      {/* Paper Review Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">Paper Review</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Live status of all your uploaded papers — updates every 30s.
            </p>
          </div>
          <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            View All <ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading papers from database...</p>
            </div>
          ) : papers.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No papers yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload a PDF to get started</p>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="font-semibold text-slate-600 px-5 py-3 w-[30%]">Paper Details</th>
                  <th className="font-semibold text-slate-600 px-5 py-3">Version</th>
                  <th className="font-semibold text-slate-600 px-5 py-3 w-[22%]">Status & Progress</th>
                  <th className="font-semibold text-slate-600 px-5 py-3">AI Confidence</th>
                  <th className="font-semibold text-slate-600 px-5 py-3">Last Updated</th>
                  <th className="font-semibold text-slate-600 px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {papers.map((paper) => (
                  <PaperReviewRow key={paper.id} paper={paper} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Recent Review History */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800">Review History</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              All past AI review jobs from the database.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No review history yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a review to see results here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.slice(0, 10).map((job) => (
                <HistoryRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, bg, value, label, sub, trendColor }: any) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800 leading-none mb-1">{value}</p>
          <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
          <p className={`text-[11px] ${trendColor}`}>{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case 'completed': return 'bg-emerald-50 text-emerald-600';
    case 'reviewing':
    case 'processing': return 'bg-blue-50 text-blue-600';
    case 'summarizing': return 'bg-purple-50 text-purple-600';
    case 'failed': return 'bg-red-50 text-red-600';
    case 'needs revision': return 'bg-amber-50 text-amber-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function progressColor(status: string) {
  switch (status.toLowerCase()) {
    case 'completed': return 'bg-emerald-500';
    case 'reviewing':
    case 'processing': return 'bg-blue-500';
    case 'summarizing': return 'bg-purple-500';
    case 'failed': return 'bg-red-400';
    case 'needs revision': return 'bg-amber-500';
    default: return 'bg-slate-400';
  }
}

function confidenceBadge(confidence: number | null) {
  if (confidence === null) return 'bg-slate-100 text-slate-400 border-slate-200';
  if (confidence >= 90) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (confidence >= 75) return 'bg-blue-50 text-blue-600 border-blue-200';
  return 'bg-amber-50 text-amber-600 border-amber-200';
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Paper Review Row ──────────────────────────────────────────────────────────

function PaperReviewRow({ paper }: { paper: DashboardPaper }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pColor = progressColor(paper.status);
  const sStyle = statusStyle(paper.status);
  const cBadge = confidenceBadge(paper.confidence);

  return (
    <tr className="hover:bg-slate-50 transition-colors group relative">
      <td className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-red-50 border border-red-100 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-slate-800 mb-0.5 truncate max-w-[200px]">{paper.title}</h4>
            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{paper.authors}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{paper.tag}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
          {paper.version}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${sStyle}`}>
            {paper.status}
          </span>
          <span className="text-[11px] font-bold text-slate-700">{paper.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${pColor} transition-all duration-700`}
            style={{ width: `${paper.progress}%` }}
          />
        </div>
        <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
          <Bot size={9} /> {paper.agent}
        </p>
      </td>
      <td className="px-5 py-4">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border ${cBadge}`}>
          {paper.confidence ?? '—'}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-[11px] text-slate-500">{formatRelativeTime(paper.last_updated)}</span>
      </td>
      <td className="px-5 py-4 text-center relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
          className="w-8 h-8 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center mx-auto transition-colors"
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-8 top-10 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-20 py-1 text-left">
            <button className="w-full px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
              <Search size={13} /> Open Details
            </button>
            <button className="w-full px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
              <Download size={13} /> Download PDF
            </button>
            <button className="w-full px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
              <FileText size={13} /> Compare Versions
            </button>
            <button className="w-full px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
              <Share2 size={13} /> Share
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button className="w-full px-4 py-2 text-[12px] text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({ job }: { job: ReviewJobSummary }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-600',
    failed: 'bg-red-50 text-red-600',
    processing: 'bg-blue-50 text-blue-600',
    queued: 'bg-slate-100 text-slate-500',
  };
  const sClass = statusColors[job.status] || 'bg-slate-100 text-slate-500';

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[13px] font-bold text-slate-800 truncate">{job.paper_title || 'Untitled Paper'}</h4>
        <p className="text-[11px] text-slate-500">{formatRelativeTime(job.created_at)}</p>
      </div>
      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${sClass}`}>
        {job.status}
      </span>
      {job.overall_score !== null ? (
        <div className="w-12 text-right shrink-0">
          <span className="text-sm font-bold text-slate-700">{job.overall_score.toFixed(1)}</span>
          <span className="text-[10px] text-slate-400">/10</span>
        </div>
      ) : (
        <div className="w-12 text-right shrink-0 text-slate-400 text-[11px]">—</div>
      )}
      {job.final_recommendation ? (
        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 shrink-0 max-w-[120px] truncate">
          {job.final_recommendation}
        </span>
      ) : (
        <div className="w-[120px]" />
      )}
      <button className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 shrink-0 flex items-center gap-1">
        View Report <ChevronRight size={13} />
      </button>
    </div>
  );
}
