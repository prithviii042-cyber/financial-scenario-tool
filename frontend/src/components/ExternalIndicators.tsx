import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Loader2, Globe, Link, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { fetchExternalIndicators } from '../api/client'
import type { ExternalIndicator, Driver, ExternalFactorMapping } from '../types'

interface Props {
  drivers: Driver[]
  mappings: ExternalFactorMapping[]
  onChange: (mappings: ExternalFactorMapping[]) => void
  onIndicatorsLoaded: (indicators: ExternalIndicator[]) => void
}

const SOURCE_COLOR: Record<string, string> = {
  FRED: 'text-blue-400',
  'World Bank': 'text-emerald-400',
  'Yahoo Finance': 'text-amber-400',
}

export default function ExternalIndicators({ drivers, mappings, onChange, onIndicatorsLoaded }: Props) {
  const [indicators, setIndicators] = useState<ExternalIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchExternalIndicators()
      setIndicators(data)
      onIndicatorsLoaded(data)
      setLoaded(true)

      // Auto-apply suggested mappings with default elasticity 0.5
      const autoMappings: ExternalFactorMapping[] = []
      for (const ind of data) {
        if (ind.suggested_driver_mapping) {
          const driver = drivers.find(d => d.id === ind.suggested_driver_mapping)
          if (driver && !mappings.find(m => m.indicator_id === ind.id)) {
            autoMappings.push({
              indicator_id: ind.id,
              indicator_value: ind.value,
              driver_id: driver.id,
              elasticity: 0.5,
            })
          }
        }
      }
      if (autoMappings.length > 0) {
        onChange([...mappings, ...autoMappings])
      }
    } catch {
      setError('Failed to fetch external indicators. Check your API keys.')
    } finally {
      setLoading(false)
    }
  }

  const getMapping = (indicatorId: string) =>
    mappings.find(m => m.indicator_id === indicatorId)

  const updateMapping = (indicatorId: string, indicatorValue: number, driverId: string | null, elasticity: number) => {
    if (!driverId) {
      onChange(mappings.filter(m => m.indicator_id !== indicatorId))
      return
    }
    const existing = mappings.find(m => m.indicator_id === indicatorId)
    if (existing) {
      onChange(mappings.map(m =>
        m.indicator_id === indicatorId
          ? { ...m, driver_id: driverId, elasticity, indicator_value: indicatorValue }
          : m
      ))
    } else {
      onChange([...mappings, { indicator_id: indicatorId, indicator_value: indicatorValue, driver_id: driverId, elasticity }])
    }
  }

  const sources = [...new Set(indicators.map(i => i.source.split(' ')[0]))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Macro &amp; Market Indicators</h3>
          <p className="text-xs text-slate-500 mt-0.5">Link external indicators to financial drivers via elasticity coefficients</p>
        </div>
        {!loaded && (
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            {loading ? 'Fetching...' : 'Load Indicators'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-3 bg-red-950/30 border border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {indicators.length > 0 && (
        <div className="space-y-2">
          {indicators.map(ind => {
            const mapping = getMapping(ind.id)
            const isUnavailable = ind.source.includes('unavailable')

            return (
              <div
                key={ind.id}
                className={clsx(
                  'border rounded-xl p-4 space-y-3 transition-colors',
                  mapping ? 'border-indigo-700 bg-indigo-950/20' : 'border-slate-800 bg-slate-900/30'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200 truncate">{ind.name}</p>
                      <span className={`text-[10px] font-semibold ${SOURCE_COLOR[ind.source.split(' ')[0]] || 'text-slate-400'}`}>
                        {ind.source.split(' ')[0]}
                      </span>
                      {isUnavailable && (
                        <span className="text-[10px] text-yellow-600">no key</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ind.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white tabular-nums">
                      {ind.unit.includes('%')
                        ? `${(ind.value * 100).toFixed(2)}%`
                        : ind.value.toLocaleString()}
                    </p>
                    {ind.change_pct != null && (
                      <p className={`text-xs flex items-center justify-end gap-0.5 ${ind.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ind.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {(ind.change_pct * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Mapping controls */}
                <div className="flex items-center gap-3">
                  <Link className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    value={mapping?.driver_id || ''}
                    onChange={e => updateMapping(ind.id, ind.value, e.target.value || null, mapping?.elasticity || 0.5)}
                  >
                    <option value="">— Not linked —</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  {mapping && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">Elasticity:</span>
                      <input
                        type="number"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={mapping.elasticity}
                        onChange={e => updateMapping(ind.id, ind.value, mapping.driver_id, parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-center text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {mapping && (
                  <p className="text-[11px] text-indigo-400 bg-indigo-950/30 rounded-lg px-3 py-1.5">
                    Macro impact: {ind.unit.includes('%') ? `${(ind.value * 100).toFixed(2)}%` : ind.value.toLocaleString()} × {mapping.elasticity} elasticity
                    {' → '}{((ind.value * mapping.elasticity) * 100).toFixed(2)}% adjustment to <strong>{drivers.find(d => d.id === mapping.driver_id)?.name}</strong>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
