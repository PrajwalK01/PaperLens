import { useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Hash, Loader2, AlertCircle, ArrowRight, Upload, X, FileText, Sparkles, Zap, Shield, Brain } from 'lucide-react'
import { uploadPdf, fetchArxiv, startReview, type Paper } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode]         = useState<'pdf' | 'arxiv'>('pdf')
  const [arxivId, setArxivId]   = useState('')
  const [dropped, setDropped]   = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]       = useState<string | null>(null)

  const onDrop = useCallback((acc: File[]) => {
    if (acc[0]) { setDropped(acc[0]); setError(null) }
  }, [])
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, maxSize: 50_000_000, noClick: true,
  })

  const canSubmit = !loading && ((mode === 'pdf' && !!dropped) || (mode === 'arxiv' && arxivId.trim().length > 3))

  const submit = async () => {
    setError(null); setLoading(true)
    try {
      let paper: Paper
      if (mode === 'pdf') {
        if (!dropped) { setError('Select a PDF first.'); setLoading(false); return }
        setLoadingMsg('Extracting text…')
        paper = await uploadPdf(dropped)
      } else {
        if (!arxivId.trim()) { setError('Enter an arXiv ID.'); setLoading(false); return }
        setLoadingMsg('Fetching from arXiv…')
        paper = await fetchArxiv(arxivId.trim())
      }
      setLoadingMsg('Starting review pipeline…')
      const job = await startReview(paper.id)
      navigate(`/review/${job.id}`)
    } catch (e: unknown) {
      const d = (e as any)?.response?.data?.detail
      setError(d ?? (e as any)?.message ?? 'Something went wrong.')
    } finally { setLoading(false); setLoadingMsg('') }
  }

  return (
    <div className="min-h-full pb-10">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="text-center pt-10 pb-8">
        {/* Glowing icon */}
        <div className="relative inline-flex mb-5">
          <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <FileText className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-black text-white tracking-tight mb-2"
          style={{ letterSpacing: '-0.03em' }}>
          AI Peer Review,{' '}
          <span style={{
            background: 'linear-gradient(90deg, #818cf8, #a78bfa, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Instantly
          </span>
        </h1>
        <p className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">
          5 independent AI agents review your paper in parallel and deliver a structured verdict in minutes.
        </p>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          {[
            { icon: <Brain className="w-3 h-3" />, label: '5 LLM Agents' },
            { icon: <Zap className="w-3 h-3" />,   label: 'Parallel Review' },
            { icon: <Shield className="w-3 h-3" />, label: 'Integrity Check' },
            { icon: <Sparkles className="w-3 h-3" />, label: 'RAG Retrieval' },
          ].map(p => (
            <span key={p.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-indigo-300 border"
              style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.25)' }}>
              {p.icon}{p.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Upload card ────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto">
        <div className="rounded-2xl border p-6"
          style={{ background: '#18191c', borderColor: '#2a2b2e' }}>

          {/* Mode toggle */}
          <div className="flex gap-1 mb-5 p-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {([
              ['pdf',   '📄', 'Upload PDF'],
              ['arxiv', '#',  'arXiv ID'],
            ] as const).map(([m, ico, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? 'text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-300'
                }`}
                style={mode === m ? {
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                } : {}}>
                {ico} {lbl}
              </button>
            ))}
          </div>

          {/* PDF drop zone */}
          {mode === 'pdf' && (
            <div {...getRootProps()}
              className="mb-4 rounded-xl p-7 text-center cursor-default transition-all border-2 border-dashed"
              style={{
                borderColor: isDragActive ? '#6366f1' : dropped ? '#10b981' : '#2a2b2e',
                background: isDragActive
                  ? 'rgba(99,102,241,0.08)'
                  : dropped
                  ? 'rgba(16,185,129,0.06)'
                  : 'rgba(255,255,255,0.02)',
              }}>
              <input {...getInputProps()} />
              {dropped ? (
                <div className="animate-fade-in">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <FileText className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="font-bold text-white text-sm">{dropped.name}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {(dropped.size / 1024 / 1024).toFixed(2)} MB · Ready to review
                  </p>
                  <button onClick={e => { e.stopPropagation(); setDropped(null) }}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" /> Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Upload className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {isDragActive ? 'Drop it here…' : 'Drag & drop a PDF here'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1 mb-3">or</p>
                  <button onClick={open}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold text-indigo-300 border transition-colors hover:text-white"
                    style={{ borderColor: 'rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.1)' }}>
                    Browse files
                  </button>
                  <p className="text-xs text-zinc-700 mt-3">PDF up to 50 MB</p>
                </div>
              )}
            </div>
          )}

          {/* arXiv input */}
          {mode === 'arxiv' && (
            <div className="mb-4 relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                value={arxivId}
                onChange={e => { setArxivId(e.target.value); setError(null) }}
                placeholder="e.g. 2301.00001 or arxiv.org/abs/2301.00001"
                onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all text-zinc-200 placeholder:text-zinc-700"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid #2a2b2e',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = '#2a2b2e'}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 animate-slide-down"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={canSubmit ? {
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            } : {
              background: 'rgba(255,255,255,0.05)',
              color: '#3f3f46',
              cursor: 'not-allowed',
            }}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{loadingMsg || 'Processing…'}</>
            ) : (
              <><span>Start AI Review</span><ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* ── Pipeline diagram ──────────────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border p-5"
          style={{ background: '#18191c', borderColor: '#2a2b2e' }}>
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 text-center">
            5-Agent Review Pipeline
          </p>

          {/* Two parallel groups */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              {
                label: 'Group A',
                color: 'rgba(99,102,241,0.12)',
                border: 'rgba(99,102,241,0.25)',
                text: '#818cf8',
                agents: ['Primary Reviewer', 'Critic Agent'],
              },
              {
                label: 'Group B',
                color: 'rgba(139,92,246,0.12)',
                border: 'rgba(139,92,246,0.25)',
                text: '#a78bfa',
                agents: ['Primary Reviewer', 'Critic Agent'],
              },
            ].map(g => (
              <div key={g.label} className="rounded-xl p-3"
                style={{ background: g.color, border: `1px solid ${g.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: g.text }}>{g.label}</p>
                {g.agents.map((a, i) => (
                  <div key={a} className="flex items-center gap-1.5 mb-1 last:mb-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: g.text, opacity: i === 0 ? 1 : 0.5 }} />
                    <p className="text-[11px] font-medium text-zinc-400">{a}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Synthesizer */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px" style={{ background: '#2a2b2e' }} />
            <span className="text-[10px] text-zinc-700">converge</span>
            <div className="flex-1 h-px" style={{ background: '#2a2b2e' }} />
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
              border: '1px solid rgba(139,92,246,0.3)',
            }}>
            <div className="flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <p className="text-[11px] font-bold text-violet-300">Synthesizer Agent</p>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Final verdict · Score /10 · Confidence · Recommendation</p>
          </div>
        </div>

      </div>
    </div>
  )
}
