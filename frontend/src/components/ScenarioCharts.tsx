import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ComposedChart, Line, Legend,
} from 'recharts'
import type { FinancialAnalysis, ScenarioResult } from '../types'

interface Props {
  analysis: FinancialAnalysis
  result: ScenarioResult
  onBack: () => void
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function DeltaChip({ base, scenario }: { base: number; scenario: number }) {
  const delta = base !== 0 ? (scenario - base) / Math.abs(base) : 0
  const abs = scenario - base
  if (Math.abs(delta) < 0.0001) return <span className="text-xs text-slate-500">No change</span>
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}% ({fmt(abs)})
    </span>
  )
}

// Waterfall chart data builder
function buildWaterfallData(result: ScenarioResult) {
  const data = []
  let base = 0

  for (const item of result.bridge_items) {
    if (item.is_subtotal) {
      data.push({
        name: item.label,
        base: 0,
        value: item.running_total,
        fill: item.label === 'Base' ? '#6366f1' : '#10b981',
        isSubtotal: true,
        rawValue: item.running_total,
      })
      base = item.running_total
    } else {
      const start = item.running_total - item.value
      data.push({
        name: item.label,
        base: Math.min(start, item.running_total),
        value: Math.abs(item.value),
        fill: item.value >= 0 ? '#10b981' : '#ef4444',
        isSubtotal: false,
        rawValue: item.value,
        start,
      })
    }
  }
  return data
}

// Tornado chart (sensitivity) data
function buildTornadoData(result: ScenarioResult, analysis: FinancialAnalysis) {
  const driverMap = Object.fromEntries(analysis.drivers.map(d => [d.id, d]))
  return Object.entries(result.driver_impacts)
    .filter(([, impact]) => Math.abs(impact) > 1)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 8)
    .map(([driverId, impact]) => ({
      name: driverMap[driverId]?.name || driverId,
      impact,
      abs: Math.abs(impact),
      fill: impact >= 0 ? '#10b981' : '#ef4444',
    }))
}

// Comparison chart data (base vs scenario for key line items)
function buildComparisonData(result: ScenarioResult, analysis: FinancialAnalysis) {
  const keyItemIds = ['total_revenue', 'revenue', 'gross_profit', 'ebitda', 'ebit', 'net_income']
  const lineItemMap = Object.fromEntries(analysis.line_items.map(l => [l.id, l]))

  return keyItemIds
    .filter(id => result.base_line_items[id] != null || result.scenario_line_items[id] != null)
    .map(id => ({
      name: lineItemMap[id]?.name || id.replace(/_/g, ' '),
      base: result.base_line_items[id] || 0,
      scenario: result.scenario_line_items[id] || 0,
    }))
    .filter(d => Math.abs(d.base) > 0 || Math.abs(d.scenario) > 0)
}

const CustomWaterfallTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; rawValue: number; isSubtotal: boolean } }[] }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-200">{d.name}</p>
      <p className={d.rawValue >= 0 ? 'text-emerald-400' : 'text-red-400'}>
        {d.isSubtotal ? 'Total: ' : d.rawValue >= 0 ? '+' : ''}{fmt(d.rawValue)}
      </p>
    </div>
  )
}

export default function ScenarioCharts({ analysis, result, onBack }: Props) {
  const waterfallData = buildWaterfallData(result)
  const tornadoData = buildTornadoData(result, analysis)
  const comparisonData = buildComparisonData(result, analysis)

  const baseEbitda = result.key_metrics_base.ebitda || 0
  const scenarioEbitda = result.key_metrics_scenario.ebitda || 0
  const baseRev = result.key_metrics_base.revenue || 0
  const scenarioRev = result.key_metrics_scenario.revenue || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{result.scenario_name}</h2>
          <p className="text-slate-400 text-sm mt-0.5">Scenario analysis results vs. base period ({analysis.base_period})</p>
        </div>
        <button onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Adjust Scenario
        </button>
      </div>

      {/* AI Summary */}
      {result.summary && (
        <div className="card border-indigo-800/50 bg-indigo-950/20">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">AI Executive Summary</p>
          <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', base: baseRev, scenario: scenarioRev, isMargin: false },
          { label: 'Gross Profit', base: result.key_metrics_base.gross_profit || 0, scenario: result.key_metrics_scenario.gross_profit || 0, isMargin: false },
          { label: 'EBITDA', base: baseEbitda, scenario: scenarioEbitda, isMargin: false },
          { label: 'EBITDA Margin', base: result.key_metrics_base.ebitda_margin || 0, scenario: result.key_metrics_scenario.ebitda_margin || 0, isMargin: true },
        ].map(kpi => (
          <div key={kpi.label} className="card space-y-1">
            <p className="label">{kpi.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500">Base:</span>
              <span className="text-sm font-semibold text-slate-300 tabular-nums">
                {kpi.isMargin ? fmtPct(kpi.base) : fmt(kpi.base)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-500">Scenario:</span>
              <span className={`text-base font-bold tabular-nums ${kpi.scenario >= kpi.base ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.isMargin ? fmtPct(kpi.scenario) : fmt(kpi.scenario)}
              </span>
            </div>
            <DeltaChip base={kpi.base} scenario={kpi.scenario} />
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Waterfall bridge chart */}
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-white">EBITDA Bridge</h3>
            <p className="text-xs text-slate-500 mt-0.5">Waterfall from base to scenario EBITDA</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={waterfallData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tickFormatter={v => fmt(v)}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomWaterfallTooltip />} />
              {/* Invisible base bar for floating effect */}
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Base vs Scenario comparison */}
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-white">Base vs Scenario</h3>
            <p className="text-xs text-slate-500 mt-0.5">Key P&amp;L metrics comparison</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tickFormatter={v => fmt(v)}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v), '']}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{v}</span>} />
              <Bar dataKey="base" name="Base" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="scenario" name="Scenario" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tornado / Sensitivity chart */}
        {tornadoData.length > 0 && (
          <div className="card space-y-4">
            <div>
              <h3 className="font-semibold text-white">Sensitivity Analysis</h3>
              <p className="text-xs text-slate-500 mt-0.5">EBITDA impact by driver (tornado chart)</p>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(tornadoData.length * 40 + 40, 200)}>
              <BarChart
                data={tornadoData}
                layout="vertical"
                margin={{ top: 5, right: 30, bottom: 5, left: 140 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={v => fmt(v)}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <ReferenceLine x={0} stroke="#475569" />
                <Tooltip
                  formatter={(v: number) => [fmt(v), 'EBITDA Impact']}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {tornadoData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Detailed scenario table */}
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-semibold text-white">Detailed Line Item Comparison</h3>
          </div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-2.5 text-slate-400 font-medium">Line Item</th>
                  <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Base</th>
                  <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Scenario</th>
                  <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {analysis.line_items.map((item, i) => {
                  const base = result.base_line_items[item.id] ?? item.values[analysis.base_period] ?? 0
                  const scenario = result.scenario_line_items[item.id] ?? base
                  const delta = base !== 0 ? (scenario - base) / Math.abs(base) : 0
                  return (
                    <tr key={item.id} className={`border-b border-slate-800/50 ${i % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
                      <td className="px-6 py-2.5 text-slate-300 font-medium">{item.name}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{fmt(base)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-200 tabular-nums font-medium">{fmt(scenario)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {Math.abs(delta) > 0.0001 ? (
                          <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
