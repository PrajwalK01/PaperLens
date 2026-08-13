import { useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Hash, Loader2, AlertCircle, ArrowRight, Upload, X, FileText, Zap, Shield, Brain, Sparkles } from 'lucide-react'
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
      // Notify chat panel about the uploaded paper so it can access it
      window.dispatchEvent(new CustomEvent('spr:paper_uploaded', { detail: { paperId: paper.id } }))
      navigate(`/review/${job.id}`)
    } catch (e: unknown) {
      const d = (e as any)?.response?.data?.detail
      setError(d ?? (e as any)?.message ?? 'Something went wrong.')
    } finally { setLoading(false); setLoadingMsg('') }
  }

  return (
    <div className="min-h-full pb-8">

      {/* ── Hero ── */}
      <div className="text-center pt-6 pb-4">
        <div className="relative inline-flex mb-3">
          <div className="absolute inset-0 rounded-xl blur-lg opacity-50"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }} />
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <FileText className="w-5 h-5 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-1.5" style={{ letterSpacing: '-0.03em' }}>
          Scientific Paper Review,{' '}
          <span style={{ background: 'linear-gradient(90deg,#818cf8,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Instantly
          </span>
        </h1>
        <p className="text-xs text-indigo-300/50 max-w-xs mx-auto leading-relaxed">
          Scientific Paper Reviewer — 5 independent AI agents review your paper in parallel and deliver a structured verdict in minutes.
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
          {[
            { icon: <Brain className="w-2.5 h-2.5" />, label: '5 LLM Agents' },
            { icon: <Zap className="w-2.5 h-2.5" />,   label: 'Parallel Review' },
            { icon: <Shield className="w-2.5 h-2.5" />, label: 'Integrity Check' },
            { icon: <Sparkles className="w-2.5 h-2.5" />, label: 'RAG Retrieval' },
          ].map(p => (
            <span key={p.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-indigo-300 border"
              style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.25)' }}>
              {p.icon}{p.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Upload card ── */}
      <div className="max-w-lg mx-auto">
        <div className="rounded-2xl border p-4"
          style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.18)' }}>

          {/* Mode toggle */}
          <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)' }}>
            {([['pdf','📄','Upload PDF'],['arxiv','#','arXiv ID']] as const).map(([m, ico, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === m ? 'text-white' : 'text-indigo-400/50 hover:text-indigo-300'}`}
                style={mode === m ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : {}}>
                {ico} {lbl}
              </button>
            ))}
          </div>

          {/* PDF drop zone */}
          {mode === 'pdf' && (
            <div {...getRootProps()}
              className="mb-3 rounded-xl p-5 text-center cursor-default transition-all border-2 border-dashed"
              style={{
                borderColor: isDragActive ? '#6366f1' : dropped ? '#10b981' : 'rgba(99,102,241,0.22)',
                background: isDragActive ? 'rgba(99,102,241,0.1)' : dropped ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.03)',
              }}>
              <input {...getInputProps()} />
              {dropped ? (
                <div className="animate-fade-in">
                  <div className="w-9 h-9 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="font-bold text-white text-xs">{dropped.name}</p>
                  <p className="text-indigo-300/40 text-[10px] mt-0.5">{(dropped.size/1024/1024).toFixed(2)} MB · Ready to review</p>
                  <button onClick={e => { e.stopPropagation(); setDropped(null) }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-indigo-400/40 hover:text-red-400 transition-colors">
                    <X className="w-2.5 h-2.5" /> Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-9 h-9 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Upload className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-xs font-semibold text-indigo-100/70">{isDragActive ? 'Drop it here…' : 'Drag & drop a PDF here'}</p>
                  <p className="text-[10px] text-indigo-400/30 mt-1 mb-2">or</p>
                  <button onClick={open}
                    className="px-3 py-1 rounded-md text-[11px] font-semibold text-indigo-300 border transition-colors hover:text-white"
                    style={{ borderColor: 'rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)' }}>
                    Browse files
                  </button>
                  <p className="text-[10px] text-indigo-400/25 mt-2">PDF up to 50 MB</p>
                </div>
              )}
            </div>
          )}

          {/* arXiv input */}
          {mode === 'arxiv' && (
            <div className="mb-3 relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400/40" />
              <input
                value={arxivId}
                onChange={e => { setArxivId(e.target.value); setError(null) }}
                placeholder="e.g. 2301.00001 or arxiv.org/abs/2301.00001"
                onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs focus:outline-none transition-all text-indigo-100 placeholder:text-indigo-400/30"
                style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.55)'}
                onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.2)'}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 animate-slide-down"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)' }}>
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
            style={canSubmit ? {
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            } : {
              background: 'rgba(99,102,241,0.08)',
              color: 'rgba(99,102,241,0.3)',
              cursor: 'not-allowed',
            }}>
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{loadingMsg || 'Processing…'}</>
              : <><span>Start AI Review</span><ArrowRight className="w-3.5 h-3.5" /></>
            }
          </button>
        </div>

      </div>
    </div>
  )
}