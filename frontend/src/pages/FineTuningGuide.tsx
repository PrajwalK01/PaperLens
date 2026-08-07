/**
 * FineTuningGuide — light-themed guide for fine-tuning PaperLens agents.
 * Designed for the white (#fafafa) center panel.
 */
import { useEffect, useState } from 'react'
import {
  BookOpen, Database, Cpu, ChevronDown, ChevronUp, Download,
  ExternalLink, CheckCircle2, AlertTriangle, Loader2, Copy,
  FlaskConical, BarChart3, Settings2, ArrowRight, Zap, Star,
} from 'lucide-react'
import { getFineTuneGuide, exportTrainingData } from '../api'

// ── Priority badge — light palette ────────────────────────────────────────────
const PRIORITY_CLS: Record<string, string> = {
  'Very High': 'bg-red-50 text-red-700 border-red-200',
  'High':      'bg-amber-50 text-amber-700 border-amber-200',
  'Medium':    'bg-blue-50 text-blue-700 border-blue-200',
  'Low':       'bg-slate-100 text-slate-500 border-slate-200',
}
const RESOURCE_TYPE_CLS: Record<string, string> = {
  'Dataset':       'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Tool':          'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Documentation': 'bg-blue-50 text-blue-700 border-blue-200',
  'Research':      'bg-purple-50 text-purple-700 border-purple-200',
}

// ── Light card wrapper ────────────────────────────────────────────────────────
function LCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ── Collapsible section — light ───────────────────────────────────────────────
const ACCENT_BORDER: Record<string, string> = {
  amber:  'border-l-amber-400 bg-amber-50/40',
  blue:   'border-l-blue-400 bg-blue-50/40',
  indigo: 'border-l-indigo-400 bg-indigo-50/40',
  green:  'border-l-emerald-400 bg-emerald-50/40',
  purple: 'border-l-purple-400 bg-purple-50/40',
}
const ACCENT_ICON: Record<string, string> = {
  amber: 'text-amber-500', blue: 'text-blue-500', indigo: 'text-indigo-500',
  green: 'text-emerald-500', purple: 'text-purple-500',
}

function Collapsible({ title, icon, defaultOpen = false, children, accent = 'amber' }:
  { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; accent?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <LCard className={`border-l-4 overflow-hidden ${ACCENT_BORDER[accent] ?? ACCENT_BORDER.amber}`}>
      <button
        className="w-full flex items-center justify-between gap-3 text-left px-5 py-4 hover:bg-slate-50/50 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <span className={ACCENT_ICON[accent] ?? 'text-slate-400'}>{icon}</span>
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 animate-fade-in">
          {children}
        </div>
      )}
    </LCard>
  )
}

// ── Code block — dark terminal look on light page ─────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="relative group mt-2">
      <pre className="bg-slate-900 rounded-lg p-4 text-[11px] text-emerald-300 font-mono
        leading-relaxed overflow-x-auto whitespace-pre-wrap break-all border border-slate-700">
        {code}
      </pre>
      <button onClick={copy}
        className="absolute top-2 right-2 p-1.5 bg-slate-700 border border-slate-600 rounded
          text-slate-300 hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FineTuningGuide() {
  const [guide, setGuide] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    getFineTuneGuide()
      .then(d => { setGuide(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleExport = async () => {
    setExporting(true); setExportMsg(null)
    try {
      const data = await exportTrainingData(500)
      const lines = data.samples.map((s: any) => JSON.stringify(s)).join('\n')
      const blob = new Blob([lines], { type: 'application/jsonl' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `paperlens-training-${new Date().toISOString().split('T')[0]}.jsonl`
      a.click(); URL.revokeObjectURL(url)
      setExportMsg({ ok: true, text: `Exported ${data.count} samples as JSONL.` })
    } catch (e: any) {
      setExportMsg({ ok: false, text: `Export failed: ${e.message}` })
    } finally { setExporting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  )
  if (error || !guide) return (
    <div className="text-center py-24">
      <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-red-600 font-medium">{error ?? 'Failed to load guide.'}</p>
    </div>
  )

  return (
    <div className="space-y-6 pb-12">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Fine-Tuning Guide</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{guide.overview.title}</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">{guide.overview.summary}</p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300
            text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm flex-shrink-0">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export Training Data
        </button>
      </div>

      {exportMsg && (
        <div className={`p-3 rounded-xl border text-sm flex items-center gap-2
          ${exportMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{exportMsg.text}
        </div>
      )}

      {/* ── Why fine-tune ───────────────────────────────────────────────── */}
      <Collapsible title="Why Fine-Tune PaperLens Agents?" icon={<Star className="w-4 h-4" />} defaultOpen accent="amber">
        <ul className="space-y-2.5">
          {guide.overview.why_finetune.map((reason: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700">
              <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />{reason}
            </li>
          ))}
        </ul>
      </Collapsible>

      {/* ── Dataset requirements ────────────────────────────────────────── */}
      <Collapsible title="Dataset Requirements & Sources" icon={<Database className="w-4 h-4" />} defaultOpen accent="blue">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Minimum',     val: guide.dataset_requirements.minimum_samples,     color: 'text-red-600',   bg: 'bg-red-50   border-red-100' },
            { label: 'Recommended', val: guide.dataset_requirements.recommended_samples, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
            { label: 'Ideal',       val: guide.dataset_requirements.ideal_samples,       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.val.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{s.label} samples</p>
            </div>
          ))}
        </div>

        <SLabel>Data Sources</SLabel>
        <div className="space-y-2.5 mb-5">
          {guide.dataset_requirements.sources.map((src: any) => (
            <div key={src.name} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{src.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                    ${src.quality === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {src.quality} quality
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{src.estimated_size}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{src.description}</p>
              </div>
              {src.url.startsWith('http') && (
                <a href={src.url} target="_blank" rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-700 flex-shrink-0 mt-0.5">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>

        <SLabel>Training Data Format (ChatML JSONL)</SLabel>
        <p className="text-xs text-slate-500 mb-2">{guide.dataset_requirements.format_example.description}</p>
        <CodeBlock code={JSON.stringify(guide.dataset_requirements.format_example.jsonl_sample, null, 2)} />
      </Collapsible>

      {/* ── Per-agent ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700">Per-Agent Fine-Tuning Details</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="space-y-3">
          {guide.agents.map((agent: any) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </div>

      {/* ── Pipeline ────────────────────────────────────────────────────── */}
      <Collapsible title="Step-by-Step Training Pipeline" icon={<Zap className="w-4 h-4" />} accent="indigo">
        <div className="space-y-5">
          {guide.pipeline.map((step: any) => (
            <div key={step.step} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200
                flex items-center justify-center text-xs font-black text-indigo-700 flex-shrink-0 mt-0.5">
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="text-sm font-bold text-slate-800">{step.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">{step.estimated_time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{step.description}</p>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {step.tools.map((t: string) => (
                    <span key={t} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">{t}</span>
                  ))}
                </div>
                <CodeBlock code={step.code_snippet} />
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* ── Evaluation metrics ──────────────────────────────────────────── */}
      <Collapsible title="Evaluation Metrics" icon={<BarChart3 className="w-4 h-4" />} accent="green">
        <div className="space-y-3">
          {guide.evaluation_metrics.metrics.map((m: any) => (
            <div key={m.name} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <span className="text-sm font-bold text-slate-800">{m.name}</span>
                <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex-shrink-0">
                  Target: {m.target}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2 leading-relaxed">{m.description}</p>
              <code className="text-[11px] text-indigo-600 font-mono bg-indigo-50 px-2 py-1 rounded block">{m.formula}</code>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* ── Env vars ────────────────────────────────────────────────────── */}
      <Collapsible title="Environment Variables — No Code Changes Needed" icon={<Settings2 className="w-4 h-4" />} accent="purple">
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">{guide.env_vars.description}</p>
        <div className="space-y-2 mb-4">
          {guide.env_vars.vars.map((v: any) => (
            <div key={v.key} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
              <code className="text-xs font-mono text-purple-700 w-52 shrink-0">{v.key}</code>
              <code className="text-[11px] font-mono text-slate-400 flex-1 truncate">{v.default || '(empty)'}</code>
              <span className="text-[11px] text-slate-500 hidden lg:block">{v.description}</span>
            </div>
          ))}
        </div>
        <CodeBlock code={guide.env_vars.vars.map((v: any) => `${v.key}=${v.default || 'your-key-here'}`).join('\n')} />
      </Collapsible>

      {/* ── Resources ───────────────────────────────────────────────────── */}
      <Collapsible title="Resources & Links" icon={<BookOpen className="w-4 h-4" />} accent="blue">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {guide.resources.map((r: any) => (
            <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3
                hover:border-indigo-300 hover:shadow-sm transition-all group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">{r.title}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mt-1 inline-block ${RESOURCE_TYPE_CLS[r.type] ?? ''}`}>{r.type}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
            </a>
          ))}
        </div>
      </Collapsible>

    </div>
  )
}

// ── Agent card — light themed ─────────────────────────────────────────────────
function AgentCard({ agent }: { agent: any }) {
  const [open, setOpen] = useState(false)
  const agentColors: Record<string, string> = {
    group_a_primary: '#8B5E3C', group_a_critic: '#5C7A3C',
    group_b_primary: '#3C6B5C', group_b_critic: '#7A4030', synthesizer: '#5C4878',
  }
  const color = agentColors[agent.id] ?? '#5a5a5a'

  return (
    <LCard className="overflow-hidden">
      <button className="w-full flex items-center gap-3 text-left px-5 py-4 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: color }}>
          {agent.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{agent.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PRIORITY_CLS[agent.fine_tune_priority] ?? ''}`}>
              {agent.fine_tune_priority} priority
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{agent.default_model}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4 animate-fade-in">
          <div>
            <SLabel>Recommended Base Model</SLabel>
            <p className="text-xs text-slate-700 font-mono bg-slate-50 border border-slate-200 rounded px-3 py-2">{agent.recommended_base}</p>
          </div>
          <div>
            <SLabel>Training Focus</SLabel>
            <ul className="space-y-1.5">
              {agent.training_focus.map((f: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SLabel>Prompt Engineering Tips</SLabel>
            <ul className="space-y-1.5">
              {agent.prompt_tips.map((t: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="text-amber-500 font-bold flex-shrink-0">→</span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SLabel>Recommended Hyperparameters</SLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(agent.hyperparams).map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10px] text-slate-400 mb-0.5">{k.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-mono text-slate-800 font-bold">{String(v)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </LCard>
  )
}
