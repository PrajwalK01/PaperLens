import { useState, useCallback } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { FileText, Hash, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { uploadPdf, fetchArxiv, startReview, type Paper } from '../api'

interface Props {
  onJobCreated: (jobId: string) => void
}

export default function UploadForm({ onJobCreated }: Props) {
  const [mode, setMode] = useState<'pdf' | 'arxiv'>('pdf')
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [arxivId, setArxivId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError(null)
    if (rejected.length > 0) {
      const code = rejected[0]?.errors?.[0]?.code
      if (code === 'file-too-large') setError('File exceeds 50 MB limit.')
      else if (code === 'file-invalid-type') setError('Please upload a PDF file.')
      else setError('Invalid file.')
      return
    }
    if (accepted[0]) setDroppedFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    noClick: false,
  })

  const canSubmit =
    !loading && ((mode === 'pdf' && !!droppedFile) || (mode === 'arxiv' && arxivId.trim().length > 3))

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      let paper: Paper
      if (mode === 'pdf') {
        if (!droppedFile) { setError('Please drop a PDF first.'); return }
        setLoadingStep('Extracting text from PDF…')
        paper = await uploadPdf(droppedFile)
      } else {
        if (!arxivId.trim()) { setError('Please enter an arXiv ID.'); return }
        setLoadingStep('Fetching paper from arXiv…')
        paper = await fetchArxiv(arxivId.trim())
      }
      setLoadingStep('Starting review pipeline…')
      const job = await startReview(paper.id)
      onJobCreated(job.id)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const msg = detail ?? (err as { message?: string })?.message ?? 'Something went wrong.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <div className="space-y-5">
      {/* Mode tabs */}
      <div className="inline-flex rounded-lg border border-navy-700 bg-navy-900/60 p-1 gap-1">
        {(['pdf', 'arxiv'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); setDroppedFile(null); setArxivId('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
              mode === m
                ? 'bg-amber-500 text-navy-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'pdf' ? (
              <><FileText className="w-3.5 h-3.5" />PDF Upload</>
            ) : (
              <><Hash className="w-3.5 h-3.5" />arXiv ID</>
            )}
          </button>
        ))}
      </div>

      {/* Input area */}
      {mode === 'pdf' ? (
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 outline-none ${
            isDragActive
              ? 'border-amber-400 bg-amber-400/5 scale-[1.01]'
              : droppedFile
              ? 'border-green-600 bg-green-900/10'
              : 'border-navy-700 hover:border-navy-500 hover:bg-navy-800/30'
          }`}
        >
          <input {...getInputProps()} aria-label="Upload PDF" />

          {droppedFile ? (
            <div className="flex flex-col items-center gap-2 animate-fade-in">
              <div className="w-12 h-12 rounded-xl bg-green-900/40 border border-green-800 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <p className="font-medium text-green-300 font-paper">{droppedFile.name}</p>
              <p className="text-xs text-slate-500">
                {(droppedFile.size / 1024 / 1024).toFixed(2)} MB
                &nbsp;·&nbsp;
                <span className="text-navy-400 cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setDroppedFile(null) }}>
                  Remove
                </span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <UploadIllustration active={isDragActive} />
              <div>
                <p className="text-sm font-medium text-slate-300">
                  {isDragActive ? 'Drop it here' : 'Drop your PDF here'}
                </p>
                <p className="text-xs mt-1">or click to browse · max 50 MB</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="arxiv-input" className="section-label block">arXiv paper ID or URL</label>
          <div className="flex gap-3">
            <input
              id="arxiv-input"
              type="text"
              value={arxivId}
              onChange={(e) => { setArxivId(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
              placeholder="2301.00001  or  https://arxiv.org/abs/2301.00001"
              className="input"
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-600 pl-1">
            Version suffixes (e.g. v2) are stripped automatically.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-950/50 border border-red-900 rounded-lg px-4 py-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-primary w-full py-3.5 text-base"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingStep || 'Working…'}
          </>
        ) : (
          'Start Review →'
        )}
      </button>

      {loading && (
        <p className="text-center text-xs text-slate-600 animate-pulse">
          This may take a moment for large PDFs
        </p>
      )}
    </div>
  )
}

function UploadIllustration({ active }: { active: boolean }) {
  return (
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200 ${
      active ? 'bg-amber-400/15 border-2 border-amber-400/40' : 'bg-navy-800 border border-navy-700'
    }`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M10 22H8a4 4 0 010-8h.5A6 6 0 0120 10h1a5 5 0 010 10h-2" stroke={active ? '#fbbf24' : '#475569'} strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M16 16v8M13 19l3-3 3 3" stroke={active ? '#fbbf24' : '#475569'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
