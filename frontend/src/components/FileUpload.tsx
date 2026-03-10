import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, FileText, AlertCircle, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { uploadFile, analyzeFile } from '../api/client'
import type { UploadResponse, FinancialAnalysis } from '../types'

interface Props {
  onComplete: (upload: UploadResponse, analysis: FinancialAnalysis) => void
}

type Status = 'idle' | 'uploading' | 'analyzing' | 'error'

export default function FileUpload({ onComplete }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState('')

  const handleFile = useCallback(async (file: File) => {
    setError('')

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext || '')) {
      setError('Please upload an Excel (.xlsx/.xls), CSV, or PDF file.')
      return
    }

    try {
      setStatus('uploading')
      setProgress('Uploading and parsing file...')
      const uploadResp = await uploadFile(file)

      setStatus('analyzing')
      setProgress('Claude is analyzing your financial data and building the driver model... (this takes ~30 seconds)')
      const analysis = await analyzeFile(uploadResp.file_id)

      onComplete(uploadResp, analysis)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || message)
      setStatus('error')
    }
  }, [onComplete])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const isLoading = status === 'uploading' || status === 'analyzing'

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Upload Financial Data</h2>
        <p className="text-slate-400">
          Upload your P&amp;L, Balance Sheet, Cash Flow, or any financial dataset.
          Claude will understand the structure and build a driver-based model.
        </p>
      </div>

      {/* Drop zone */}
      <label
        className={clsx(
          'relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
          dragOver ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500',
          isLoading && 'pointer-events-none opacity-60'
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            <p className="text-slate-300 font-medium text-center max-w-sm">{progress}</p>
            {status === 'analyzing' && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Using Claude Opus 4.6 with extended thinking
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-slate-200 font-medium">Drop your file here or click to browse</p>
              <p className="text-slate-500 text-sm mt-1">Excel (.xlsx/.xls), CSV, or PDF up to 50 MB</p>
            </div>
          </>
        )}
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={onInputChange}
          disabled={isLoading}
        />
      </label>

      {/* Error */}
      {status === 'error' && error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Upload failed</p>
            <p className="text-xs mt-1 text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Supported data types */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: FileSpreadsheet, label: 'P&L Statement', desc: 'Revenue, COGS, EBITDA' },
          { icon: FileSpreadsheet, label: 'Balance Sheet', desc: 'Assets, Liabilities, Equity' },
          { icon: FileText, label: 'Any Financial Data', desc: 'KPIs, custom metrics' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="card text-center space-y-1">
            <Icon className="w-6 h-6 text-indigo-400 mx-auto" />
            <p className="text-sm font-medium text-slate-200">{label}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
