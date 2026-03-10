import { ArrowRight, Info } from 'lucide-react'
import type { FinancialAnalysis, DriverTreeNode, Driver } from '../types'

interface Props {
  analysis: FinancialAnalysis
  onNext: () => void
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  metric: { bg: 'bg-indigo-900/60', text: 'text-indigo-300', border: 'border-indigo-600' },
  line_item: { bg: 'bg-slate-800', text: 'text-slate-200', border: 'border-slate-600' },
  driver: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-700' },
}

const DRIVER_TYPE_BADGE: Record<string, string> = {
  volume: 'bg-blue-900/50 text-blue-300',
  price: 'bg-purple-900/50 text-purple-300',
  margin: 'bg-amber-900/50 text-amber-300',
  growth_rate: 'bg-teal-900/50 text-teal-300',
  absolute: 'bg-slate-700 text-slate-300',
  efficiency: 'bg-rose-900/50 text-rose-300',
}

function formatDriverValue(driver: Driver): string {
  if (driver.type === 'growth_rate') return `${(driver.base_value * 100).toFixed(1)}%`
  if (driver.type === 'margin') return `${(driver.base_value * 100).toFixed(1)}%`
  if (driver.unit === 'USD' || driver.unit === '$') {
    if (Math.abs(driver.base_value) >= 1_000_000) return `$${(driver.base_value / 1_000_000).toFixed(1)}M`
    if (Math.abs(driver.base_value) >= 1_000) return `$${(driver.base_value / 1_000).toFixed(0)}K`
    return `$${driver.base_value.toFixed(0)}`
  }
  return `${driver.base_value.toFixed(2)} ${driver.unit}`
}

function TreeNodeComponent({
  node,
  driverMap,
  depth = 0,
}: {
  node: DriverTreeNode
  driverMap: Record<string, Driver>
  depth?: number
}) {
  const style = TYPE_STYLES[node.type] || TYPE_STYLES.line_item
  const driver = driverMap[node.id]
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={`flex flex-col items-center ${depth > 0 ? 'mt-4' : ''}`}>
      {/* Node box */}
      <div className={`relative px-4 py-2.5 rounded-xl border ${style.border} ${style.bg} text-center min-w-[140px] max-w-[180px] shadow-lg`}>
        <p className={`text-sm font-semibold ${style.text} leading-tight`}>{node.name}</p>
        {driver && (
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{formatDriverValue(driver)}</p>
        )}
        {node.type === 'driver' && driver && (
          <span className={`absolute -top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DRIVER_TYPE_BADGE[driver.type] || DRIVER_TYPE_BADGE.absolute}`}>
            {driver.type.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && (
        <div className="relative mt-0">
          {/* Vertical line from parent */}
          <div className="w-px h-5 bg-slate-600 mx-auto" />

          {/* Horizontal connector line */}
          <div className="relative flex gap-6 justify-center">
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-slate-600"
                style={{
                  left: `calc(50% - ${(node.children.length - 1) * 50}px)`,
                  width: `${(node.children.length - 1) * 100}px`,
                }}
              />
            )}
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-600" />
                <TreeNodeComponent node={child} driverMap={driverMap} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DriverTree({ analysis, onNext }: Props) {
  const driverMap: Record<string, Driver> = {}
  for (const d of analysis.drivers) driverMap[d.id] = d

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Driver Tree</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            AI-generated value driver hierarchy for {analysis.base_period}
          </p>
        </div>
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Build Scenario <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        {Object.entries(TYPE_STYLES).map(([type, style]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${style.border} ${style.bg}`} />
            <span className="text-slate-400 capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Tree visualization */}
      <div className="card overflow-auto">
        <div className="flex justify-center min-w-[600px] py-4">
          <TreeNodeComponent node={analysis.driver_tree} driverMap={driverMap} />
        </div>
      </div>

      {/* Driver detail cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Key Drivers — Base Values &amp; Sensitivity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analysis.drivers.map(driver => (
            <div key={driver.id} className="card space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-medium text-slate-200 text-sm leading-tight">{driver.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${DRIVER_TYPE_BADGE[driver.type] || DRIVER_TYPE_BADGE.absolute}`}>
                  {driver.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-indigo-400 tabular-nums">
                  {formatDriverValue(driver)}
                </span>
                <span className="text-xs text-slate-500">{driver.unit}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{driver.description}</p>

              {/* Sensitivity range bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>{(driver.sensitivity_min * 100).toFixed(0)}%</span>
                  <span className="text-slate-400">Sensitivity Range</span>
                  <span>+{(driver.sensitivity_max * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 via-slate-600 to-emerald-500 rounded-full" />
                </div>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <Info className="w-3 h-3" />
                Affects: {driver.affects.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Computation formulas */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Model Formulas</h3>
        <div className="space-y-1.5">
          {analysis.computation_sequence.map(step => (
            <div key={step.line_item_id} className="flex items-start gap-3 text-xs">
              <span className="text-indigo-400 font-mono font-bold min-w-[140px]">{step.line_item_id}</span>
              <span className="text-slate-500">=</span>
              <span className="text-slate-300 font-mono">{step.formula}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
