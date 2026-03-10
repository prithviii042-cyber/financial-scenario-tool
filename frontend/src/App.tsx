import { useState } from 'react'
import { Upload, Table2, GitBranch, SlidersHorizontal, BarChart3 } from 'lucide-react'
import clsx from 'clsx'
import type { AppStep, UploadResponse, FinancialAnalysis, ScenarioResult, ExternalIndicator } from './types'
import FileUpload from './components/FileUpload'
import FinancialTable from './components/FinancialTable'
import DriverTree from './components/DriverTree'
import ScenarioBuilder from './components/ScenarioBuilder'
import ScenarioCharts from './components/ScenarioCharts'

const STEPS: { id: AppStep; label: string; icon: React.ElementType }[] = [
  { id: 'upload', label: 'Upload Data', icon: Upload },
  { id: 'review', label: 'Review Data', icon: Table2 },
  { id: 'drivers', label: 'Driver Tree', icon: GitBranch },
  { id: 'scenario', label: 'Build Scenario', icon: SlidersHorizontal },
  { id: 'results', label: 'Results', icon: BarChart3 },
]

export default function App() {
  const [step, setStep] = useState<AppStep>('upload')
  const [upload, setUpload] = useState<UploadResponse | null>(null)
  const [analysis, setAnalysis] = useState<FinancialAnalysis | null>(null)
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [indicators, setIndicators] = useState<ExternalIndicator[]>([])

  const currentStepIndex = STEPS.findIndex(s => s.id === step)

  const goTo = (target: AppStep) => {
    const targetIndex = STEPS.findIndex(s => s.id === target)
    // Only allow going to steps that are unlocked
    if (targetIndex <= currentStepIndex + 1) setStep(target)
  }

  const isUnlocked = (id: AppStep) => {
    const idx = STEPS.findIndex(s => s.id === id)
    if (idx === 0) return true
    if (idx === 1) return !!upload
    if (idx === 2) return !!analysis
    if (idx === 3) return !!analysis
    if (idx === 4) return !!scenarioResult
    return false
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">CFO Scenario Analysis</h1>
              <p className="text-xs text-slate-400">AI-powered driver-based financial modelling</p>
            </div>
          </div>
          {analysis && (
            <div className="text-right">
              <p className="text-xs text-slate-400">{analysis.company_context}</p>
              <p className="text-xs text-indigo-400 font-medium">{analysis.statement_type} · Base: {analysis.base_period}</p>
            </div>
          )}
        </div>
      </header>

      {/* Step navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const unlocked = isUnlocked(s.id)
              const active = step === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => unlocked && goTo(s.id)}
                  disabled={!unlocked}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    active
                      ? 'border-indigo-500 text-indigo-400'
                      : unlocked
                      ? 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      : 'border-transparent text-slate-600 cursor-not-allowed'
                  )}
                >
                  <span className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                    active ? 'bg-indigo-600 text-white' : unlocked ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-600'
                  )}>
                    {i + 1}
                  </span>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {step === 'upload' && (
          <FileUpload
            onComplete={(uploadResp, fin) => {
              setUpload(uploadResp)
              setAnalysis(fin)
              setStep('review')
            }}
          />
        )}

        {step === 'review' && upload && analysis && (
          <FinancialTable
            upload={upload}
            analysis={analysis}
            onNext={() => setStep('drivers')}
          />
        )}

        {step === 'drivers' && analysis && (
          <DriverTree
            analysis={analysis}
            onNext={() => setStep('scenario')}
          />
        )}

        {step === 'scenario' && analysis && (
          <ScenarioBuilder
            analysis={analysis}
            indicators={indicators}
            onIndicatorsLoaded={setIndicators}
            onScenarioResult={(result) => {
              setScenarioResult(result)
              setStep('results')
            }}
          />
        )}

        {step === 'results' && scenarioResult && analysis && (
          <ScenarioCharts
            analysis={analysis}
            result={scenarioResult}
            onBack={() => setStep('scenario')}
          />
        )}
      </main>
    </div>
  )
}
