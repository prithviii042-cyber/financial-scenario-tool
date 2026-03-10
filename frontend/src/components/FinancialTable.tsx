import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import type { UploadResponse, FinancialAnalysis } from '../types'

interface Props {
  upload: UploadResponse
  analysis: FinancialAnalysis
  onNext: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'text-emerald-400',
  cogs: 'text-red-400',
  gross_profit: 'text-blue-400',
  opex: 'text-amber-400',
  ebitda: 'text-indigo-400',
  ebit: 'text-indigo-300',
  net_income: 'text-purple-400',
  asset: 'text-cyan-400',
  liability: 'text-orange-400',
}

function fmt(val: number, unit: string = 'USD'): string {
  if (unit === 'USD' || unit === '$') {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
    return `$${val.toFixed(0)}`
  }
  if (unit.includes('%')) return `${(val * 100).toFixed(1)}%`
  return val.toLocaleString()
}

function calcGrowth(values: Record<string, number>, periods: string[]): number | null {
  if (periods.length < 2) return null
  const last = values[periods[periods.length - 1]]
  const prev = values[periods[periods.length - 2]]
  if (!prev || prev === 0) return null
  return (last - prev) / Math.abs(prev)
}

export default function FinancialTable({ upload, analysis, onNext }: Props) {
  const { periods, line_items, key_metrics, statement_type, company_context } = analysis

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="label">Statement Type</p>
          <p className="text-lg font-semibold text-white">{statement_type}</p>
          <p className="text-sm text-slate-400 mt-0.5">{company_context}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="label">Periods Detected</p>
            <p className="text-lg font-semibold text-white">{periods.join(', ')}</p>
          </div>
          <div className="text-right">
            <p className="label">Line Items</p>
            <p className="text-lg font-semibold text-white">{line_items.length}</p>
          </div>
          <div className="text-right">
            <p className="label">Source</p>
            <p className="text-lg font-semibold text-white">{upload.detected_format}</p>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      {Object.keys(key_metrics).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(key_metrics).slice(0, 4).map(([key, value]) => (
            <div key={key} className="card text-center">
              <p className="label">{key.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold text-indigo-400 mt-1">
                {key.includes('margin') || key.includes('cagr') || key.includes('growth')
                  ? `${(value * 100).toFixed(1)}%`
                  : fmt(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Financial table */}
      <div className="card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white">Financial Data — Extracted by AI</h3>
          <span className="text-xs text-slate-500">{line_items.length} line items detected</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-slate-400 font-medium w-56">Line Item</th>
                {periods.map(p => (
                  <th key={p} className="text-right px-4 py-3 text-slate-400 font-medium">{p}</th>
                ))}
                <th className="text-right px-4 py-3 text-slate-400 font-medium">YoY Chg</th>
              </tr>
            </thead>
            <tbody>
              {line_items.map((item, i) => {
                const growth = calcGrowth(item.values, periods)
                const color = CATEGORY_COLORS[item.category] || 'text-slate-200'
                const isSubtotal = ['gross_profit', 'ebitda', 'ebit', 'net_income'].includes(item.category)
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-800/50 ${isSubtotal ? 'bg-slate-800/30' : i % 2 === 0 ? '' : 'bg-slate-900/30'}`}
                  >
                    <td className={`px-6 py-2.5 font-medium ${isSubtotal ? 'font-semibold' : ''} ${color}`}>
                      {isSubtotal && <span className="mr-2 text-slate-500">└</span>}
                      {item.name}
                      <span className="ml-2 text-xs text-slate-600 font-normal">{item.category}</span>
                    </td>
                    {periods.map(p => (
                      <td key={p} className="text-right px-4 py-2.5 text-slate-200 tabular-nums">
                        {item.values[p] != null ? fmt(item.values[p], item.unit) : '—'}
                      </td>
                    ))}
                    <td className="text-right px-4 py-2.5">
                      {growth != null ? (
                        <span className={`flex items-center justify-end gap-1 ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {(growth * 100).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          View Driver Tree <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
