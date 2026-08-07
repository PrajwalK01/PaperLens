import { useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Hash, FileText, Loader2, AlertCircle, ChevronDown, ChevronUp, Upload, ArrowRight } from 'lucide-react'
import { uploadPdf, fetchArxiv, startReview, type Paper } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode]       = useState<'pdf' | 'arxiv'>('pdf')
  const [arxivId, setArxivId] = useState('')
  const [dropped, setDropped] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [showFlow, setShowFlow] = useState(false)

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
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M9 12h6M9 16h6M9 8h3M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PaperLens</h1>
          <p className="text-slate-500 mt-2 text-sm">Multi-agent AI peer review · 5 LLMs · Instant verdict</p>
        </div>

        {/* ── Mode toggle ───────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl">
          {([['pdf', '📄', 'Upload PDF'], ['arxiv', '#', 'arXiv ID']] as const).map(([m, ico, lbl]) => (
            <button key={m} onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {ico} {lbl}
            </button>
          ))}
        </div>

        {/* ── PDF drop zone ─────────────────────────────────────────────── */}
        {mode === 'pdf' && (
          <div {...getRootProps()}
            className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-default ${
              isDragActive
                ? 'border-indigo-400 bg-indigo-50'
                : dropped
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}>
            <input {...getInputProps()} />
            {dropped ? (
              <div>
                <div className="text-3xl mb-2">📄</div>
                <p className="font-semibold text-slate-800 text-sm">{dropped.name}</p>
                <p className="text-slate-500 text-xs mt-1">{(dropped.size / 1024 / 1024).toFixed(2)} MB · Ready to review</p>
                <button onClick={e => { e.stopPropagation(); setDropped(null) }}
                  className="mt-2 text-xs text-slate-400 underline hover:text-slate-600">Remove</button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive ? 'Drop it here…' : 'Drag & drop a PDF here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">or</p>
                <button onClick={open}
                  className="mt-2 px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  Browse files
                </button>
                <p className="text-xs text-slate-400 mt-2">PDF up to 50 MB</p>
              </div>
            )}
          </div>
        )}

        {/* ── arXiv input ───────────────────────────────────────────────── */}
        {mode === 'arxiv' && (
          <div className="mb-4 relative">
            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={arxivId}
              onChange={e => { setArxivId(e.target.value); setError(null) }}
              placeholder="e.g. 2301.00001 or arxiv.org/abs/2301.00001"
              onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                bg-white text-slate-900 placeholder:text-slate-400 transition-colors"
            />
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── Submit button ─────────────────────────────────────────────── */}
        <button onClick={submit} disabled={!canSubmit}
          className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            canSubmit
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{loadingMsg || 'Processing…'}</>
          ) : (
            <><span>Start AI Review</span><ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        {/* ── Pipeline info toggle ──────────────────────────────────────── */}
        <button onClick={() => setShowFlow(v => !v)}
          className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          {showFlow ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showFlow ? 'Hide' : 'Show'} review pipeline
        </button>

        {showFlow && (
          <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">5-Agent Pipeline</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Group A', agents: ['Claude 3.5 — Primary', 'Gemini 1.5 — Critic'], color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: 'Group B', agents: ['GPT-4o — Primary', 'Mistral — Critic'], color: 'bg-purple-50 border-purple-200 text-purple-700' },
              ].map(g => (
                <div key={g.label} className={`border rounded-lg p-3 ${g.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">{g.label}</p>
                  {g.agents.map(a => (
                    <p key={a} className="text-[11px] font-medium">{a}</p>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] text-slate-400">↓ synthesize</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
              <p className="text-[11px] font-bold text-violet-700">Claude 3.5 — Synthesizer</p>
              <p className="text-[10px] text-violet-500 mt-0.5">Final verdict · Score · Confidence</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
