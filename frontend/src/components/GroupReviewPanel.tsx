import { useState } from 'react'
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import type { AgentResponse, AgentReview } from '../api'
import ScoreBar from './ScoreBar'
import RecommendationBadge from './RecommendationBadge'
import ModelAvatar from './ModelAvatar'

interface GroupProps {
  group: 'A' | 'B'
  responses: AgentResponse[]
}

const GROUP_META = {
  A: {
    label: 'Group A',
    accent: 'text-navy-300',
    border: 'border-navy-600/40',
    bg: 'bg-navy-800/20',
    headerBg: 'bg-navy-800/40',
    dot: 'bg-navy-400',
  },
  B: {
    label: 'Group B',
    accent: 'text-indigo-300',
    border: 'border-indigo-700/40',
    bg: 'bg-indigo-950/20',
    headerBg: 'bg-indigo-900/20',
    dot: 'bg-indigo-400',
  },
}

// ── Single agent review card ──────────────────────────────────────────────────

function AgentCard({ ar }: { ar: AgentResponse }) {
  const [open, setOpen] = useState(false)
  const review = ar.response as AgentReview | null

  if (ar.status === 'failed') {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
        Agent failed: {ar.error_message}
      </div>
    )
  }
  if (!review) return null

  const roleLabel = ar.agent_role === 'primary' ? 'Primary Reviewer' : 'Critic / Refiner'

  return (
    <div className="rounded-xl border border-navy-800/50 bg-navy-900/40 overflow-hidden animate-slide-up">
      {/* Card header — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-navy-800/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ModelAvatar modelName={ar.model_name} size={26} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-200">{roleLabel}</span>
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[120px]">
              {ar.model_name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {review.recommendation && (
            <RecommendationBadge rec={review.recommendation} size="sm" />
          )}
          {review.scores?.overall != null && (
            <span className="text-sm font-bold tabular-nums text-slate-200">
              {review.scores.overall.toFixed(1)}
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-navy-800/50 px-4 py-4 space-y-5 animate-fade-in">
          {/* Summary */}
          {review.paper_summary && (
            <p className="text-sm text-slate-400 leading-relaxed font-paper italic border-l-2 border-navy-600 pl-3">
              {review.paper_summary}
            </p>
          )}

          {/* Scores */}
          {review.scores && (
            <div className="space-y-2">
              <p className="section-label mb-2">Dimension Scores</p>
              {Object.entries(review.scores)
                .filter(([k]) => k !== 'overall')
                .map(([k, v]) => <ScoreBar key={k} label={k} value={v as number} />)}
            </div>
          )}

          {/* Strengths / Weaknesses */}
          <div className="grid grid-cols-1 gap-4">
            {review.strengths && review.strengths.length > 0 && (
              <PointList title="Strengths" items={review.strengths} color="green" marker="+" />
            )}
            {review.weaknesses && review.weaknesses.length > 0 && (
              <PointList title="Weaknesses" items={review.weaknesses} color="red" marker="−" />
            )}
          </div>

          {/* Detailed feedback */}
          {review.detailed_feedback && (
            <div>
              <p className="section-label mb-1.5">Detailed Feedback</p>
              <p className="text-xs text-slate-400 leading-relaxed">{review.detailed_feedback}</p>
            </div>
          )}

          {/* Questions for authors */}
          {review.questions_for_authors && review.questions_for_authors.length > 0 && (
            <div>
              <p className="section-label mb-2">Questions for Authors</p>
              <ul className="space-y-1.5">
                {review.questions_for_authors.map((q: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-400">
                    <MessageSquare className="w-3.5 h-3.5 text-navy-400 flex-shrink-0 mt-0.5" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critic extras */}
          {review.improvements_over_initial && review.improvements_over_initial.length > 0 && (
            <PointList
              title="Improvements Over Initial Review"
              items={review.improvements_over_initial}
              color="amber"
              marker="→"
            />
          )}
          {review.new_concerns && review.new_concerns.length > 0 && (
            <PointList title="New Concerns Identified" items={review.new_concerns} color="orange" marker="!" />
          )}
        </div>
      )}
    </div>
  )
}

// ── Group panel ───────────────────────────────────────────────────────────────

export default function GroupReviewPanel({ group, responses }: GroupProps) {
  const groupResponses = responses.filter((r) => r.group === group)
  if (groupResponses.length === 0) return null
  const meta = GROUP_META[group]

  // Aggregate score from critic (or primary if no critic yet)
  const critic = groupResponses.find((r) => r.agent_role === 'critic')
  const primary = groupResponses.find((r) => r.agent_role === 'primary')
  const bestReview = (critic?.response ?? primary?.response) as AgentReview | null
  const overallScore = bestReview?.scores?.overall

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      {/* Panel header */}
      <div className={`${meta.headerBg} px-5 py-4 border-b ${meta.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <h3 className={`font-bold text-base ${meta.accent}`}>{meta.label}</h3>
          <span className="text-xs text-slate-600">
            {groupResponses.length} agent{groupResponses.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {bestReview?.recommendation && (
            <RecommendationBadge rec={bestReview.recommendation} size="md" />
          )}
          {overallScore != null && (
            <span className="text-lg font-black tabular-nums text-slate-200">
              {overallScore.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {groupResponses.map((ar) => <AgentCard key={ar.id} ar={ar} />)}
      </div>
    </div>
  )
}

// ── Shared point list ─────────────────────────────────────────────────────────

function PointList({
  title,
  items,
  color,
  marker,
}: {
  title: string
  items: string[]
  color: 'green' | 'red' | 'amber' | 'orange'
  marker: string
}) {
  const colors = {
    green:  { label: 'text-green-400',  marker: 'text-green-500' },
    red:    { label: 'text-red-400',    marker: 'text-red-500' },
    amber:  { label: 'text-amber-400',  marker: 'text-amber-500' },
    orange: { label: 'text-orange-400', marker: 'text-orange-500' },
  }
  const c = colors[color]

  return (
    <div>
      <p className={`section-label mb-2 ${c.label}`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs text-slate-400 leading-relaxed">
            <span className={`${c.marker} flex-shrink-0 font-bold mt-0.5 w-3`}>{marker}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
