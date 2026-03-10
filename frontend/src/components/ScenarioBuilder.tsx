import { useState } from 'react'
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { computeScenario } from '../api/client'
import type { FinancialAnalysis, ScenarioResult, ExternalIndicator, ScenarioDriverChange, ExternalFactorMapping, Driver } from '../types'
import ExternalIndicators from './ExternalIndicators'

interface Props {
  analysis: FinancialAnalysis
  indicators: ExternalIndicator[]
  onIndicatorsLoaded: (indicators: ExternalIndicator[]) => void
  onScenarioResult: (result: ScenarioResult) => void
}

function formatDriverDisplay(driver: Driver, value: number): string {
  if (driver.type === 'growth_rate' || driver.type === 'margin') {
    return `${(value * 100).toFixed(2)}%`
  }
  if (driver.unit === 'USD' || driver.unit === '$') {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }
  return `${value.toFixed(2)} ${driver.unit}`
}

function DriverSlider({
  driver,
  value,
  onChange,
}: {
  driver: Driver
  value: number
  onChange: (v: number) => void
}) {
  const min = driver.base_value + driver.base_value * driver.sensitivity_min
  const max = driver.base_value + driver.base_value * driver.sensitivity_max
  const step = Math.abs(max - min) / 100 || 0.001
  const changePct = driver.base_value !== 0
    ? ((value - driver.base_value) / Math.abs(driver.base_value)) * 100
    : 0

  return (
    <div className="space-y-2 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-200">{driver.name}</p>
          <p className="text-xs text-slate-500">{driver.description}</p>
        </div>
        <div className="text-right ml-4 shrink-0">
          <p className="text-base font-bold text-indigo-400 tabular-nums">
            {formatDriverDisplay(driver, value)}
          </p>
          <p className={`text-xs tabular-nums ${changePct > 0 ? 'text-emerald-400' : changePct < 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {changePct > 0 ? '+' : ''}{changePct.toFixed(1)}% vs base
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-600 w-10 text-right tabular-nums">
          {formatDriverDisplay(driver, min)}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
        />
        <span className="text-[10px] text-slate-600 w-10 tabular-nums">
          {formatDriverDisplay(driver, max)}
        </span>
        <button
          onClick={() => onChange(driver.base_value)}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Fine-tune input */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">Set exact value:</span>
        <input
          type="number"
          step={step}
          value={parseFloat(value.toFixed(6))}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 tabular-nums"
        />
      </div>
    </div>
  )
}

const DRIVER_TYPE_GROUPS = [
  { key: 'revenue', types: ['volume', 'growth_rate'], label: 'Revenue Drivers', color: 'text-emerald-400' },
  { key: 'price', types: ['price'], label: 'Pricing Drivers', color: 'text-purple-400' },
  { key: 'cost', types: ['margin', 'efficiency'], label: 'Cost & Margin Drivers', color: 'text-amber-400' },
  { key: 'other', types: ['absolute'], label: 'Other Drivers', color: 'text-slate-400' },
]

export default function ScenarioBuilder({ analysis, indicators, onIndicatorsLoaded, onScenarioResult }: Props) {
  const [driverValues, setDriverValues] = useState<Record<string, number>>(
    Object.fromEntries(analysis.drivers.map(d => [d.id, d.base_value]))
  )
  const [externalMappings, setExternalMappings] = useState<ExternalFactorMapping[]>([])
  const [scenarioName, setScenarioName] = useState('Management Scenario')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExternal, setShowExternal] = useState(false)

  const setDriverValue = (id: string, value: number) => {
    setDriverValues(prev => ({ ...prev, [id]: value }))
  }

  const handleRun = async () => {
    setLoading(true)
    setError('')
    try {
      const driverChanges: ScenarioDriverChange[] = analysis.drivers
        .filter(d => driverValues[d.id] !== d.base_value)
        .map(d => ({ driver_id: d.id, new_value: driverValues[d.id] }))

      const result = await computeScenario({
        analysis_id: analysis.analysis_id,
        scenario_name: scenarioName,
        driver_changes: driverChanges,
        external_factor_mappings: externalMappings,
      })
      onScenarioResult(result)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr.response?.data?.detail || 'Failed to compute scenario')
    } finally {
      setLoading(false)
    }
  }

  const changedCount = analysis.drivers.filter(d => driverValues[d.id] !== d.base_value).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Build Scenario</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Adjust drivers below to model different business scenarios
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={scenarioName}
            onChange={e => setScenarioName(e.target.value)}
            placeholder="Scenario name"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 w-48"
          />
          <button
            onClick={handleRun}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Computing...' : 'Run Scenario'}
          </button>
        </div>
      </div>

      {changedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-950/40 border border-indigo-800 rounded-lg text-sm text-indigo-300">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
            {changedCount}
          </span>
          driver{changedCount > 1 ? 's' : ''} changed from base
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Driver groups */}
      {DRIVER_TYPE_GROUPS.map(group => {
        const groupDrivers = analysis.drivers.filter(d => group.types.includes(d.type))
        if (groupDrivers.length === 0) return null
        return (
          <div key={group.key} className="space-y-3">
            <h3 className={`text-sm font-semibold ${group.color} uppercase tracking-wider`}>
              {group.label}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groupDrivers.map(driver => (
                <DriverSlider
                  key={driver.id}
                  driver={driver}
                  value={driverValues[driver.id] ?? driver.base_value}
                  onChange={v => setDriverValue(driver.id, v)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* External indicators section */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowExternal(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-200">Macro &amp; Market Scenario</span>
            {externalMappings.length > 0 && (
              <span className="text-[10px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                {externalMappings.length} linked
              </span>
            )}
          </div>
          {showExternal ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showExternal && (
          <div className="p-5 border-t border-slate-800">
            <ExternalIndicators
              drivers={analysis.drivers}
              mappings={externalMappings}
              onChange={setExternalMappings}
              onIndicatorsLoaded={onIndicatorsLoaded}
            />
          </div>
        )}
      </div>
    </div>
  )
}
