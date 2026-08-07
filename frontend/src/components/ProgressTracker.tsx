import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react'
import type { AgentResponse, AgentReview } from '../api'
import ModelAvatar from './ModelAvatar'
import RecommendationBadge from './RecommendationBadge'

const STAGES = [
  { group: 'A',     role: 'primary',     label: 'Group A — Primary Review',    icon: 'A1' },
  { group: 'A',     role: 'critic',      label: 'Group A — Critic Refinement', icon: 'A2' },
  { group: 'B',     role: 'primary',     label: 'Group B — Primary Review',    icon: 'B1' },
  { group: 'B',     role: 'critic',      label: 'Group B — Critic Refinement', icon: 'B2' },
  { group: 'FINAL', role: 'synthesizer', label: 'Synthesizer — Final Verdict', icon: 'S'  },
] as const

type Status = 'pending' | 'running' | 'done' | 'failed'

function getStatus(group: string, role: string, responses: AgentResponse[], jobStatus: string): Status {
  const found = responses.find(r => r.group === group && r.agent_role === role)
  if (found) return found.status === 'failed' ? 'failed' : 'done'
  if (jobStatus === 'processing') {
    const done = new Set(responses.map(r => `${r.group}:${r.agent_role}`))
    const firstPending = STAGES.findIndex(s => !done.has(`${s.group}:${s.role}`))
    if (STAGES.findIndex(s => s.group === group && s.role === role) === firstPending) return 'running'
  }
  return 'pending'
}

export default function ProgressTracker({ responses, jobStatus }: { responses: AgentResponse[]; jobStatus: string }) {
  const doneN = STAGES.filter(s =>
    responses.some(r => r.group === s.group && r.agent_role === s.role && r.status === 'completed')
  ).length
  const pct = Math.round((doneN / STAGES.length) * 100)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Review Progress</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">{doneN} / {STAGES.length} agents</span>
          <span className="text-xs font-bold text-indigo-600">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stage rows */}
      <div className="divide-y divide-slate-50">
        {STAGES.map((stage, i) => {
          const status = getStatus(stage.group, stage.role, responses, jobStatus)
          const ar     = responses.find(r => r.group === stage.group && r.agent_role === stage.role)
          const review = ar?.response as AgentReview | null

          return (
            <div key={i} className={`px-5 py-3.5 transition-colors ${
              status === 'running' ? 'bg-indigo-50/60' :
              status === 'done'    ? 'bg-white' :
              status === 'failed'  ? 'bg-red-50/40' : 'bg-white'
            }`}>
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {status === 'done'    && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {status === 'running' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                  {status === 'failed'  && <XCircle className="w-5 h-5 text-red-500" />}
                  {status === 'pending' && <Circle className="w-5 h-5 text-slate-300" />}
                </div>

                {/* Stage number badge */}
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                  status === 'done'    ? 'bg-emerald-100 text-emerald-700' :
                  status === 'running' ? 'bg-indigo-100 text-indigo-700' :
                  status === 'failed'  ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {i + 1}
                </div>

                {/* Label */}
                <span className={`flex-1 text-sm font-medium ${
                  status === 'running' ? 'text-indigo-700' :
                  status === 'done'    ? 'text-slate-700' :
                  status === 'failed'  ? 'text-red-600' :
                  'text-slate-400'
                }`}>
                  {stage.label}
                  {status === 'running' && (
                    <span className="ml-2 text-xs text-indigo-400 font-normal animate-pulse">processing…</span>
                  )}
                </span>

                {/* Right side: model + score */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ar?.model_name && (
                    <span className="text-[10px] font-mono text-slate-400 max-w-[100px] truncate hidden sm:block">
                      {ar.model_name}
                    </span>
                  )}
                  {status === 'done' && review?.scores?.overall != null && (
                    <span className="text-sm font-black tabular-nums text-slate-700">
                      {review.scores.overall.toFixed(1)}
                      <span className="text-[10px] text-slate-400 font-normal">/10</span>
                    </span>
                  )}
                  {status === 'done' && review?.recommendation && (
                    <RecommendationBadge rec={review.recommendation} size="sm" />
                  )}
                </div>
              </div>

              {/* Summary on completion */}
              {status === 'done' && review?.paper_summary && (
                <p className="mt-2 ml-14 text-xs text-slate-500 leading-relaxed line-clamp-2 animate-fade-in">
                  {review.paper_summary}
                </p>
              )}

              {/* Error message */}
              {status === 'failed' && ar?.error_message && (
                <p className="mt-1.5 ml-14 text-xs text-red-500 leading-relaxed animate-fade-in">
                  {ar.error_message}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
