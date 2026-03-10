export interface LineItem {
  id: string
  name: string
  category: string
  values: Record<string, number>
  unit: string
  is_driver_output: boolean
}

export interface Driver {
  id: string
  name: string
  type: 'volume' | 'price' | 'margin' | 'growth_rate' | 'absolute' | 'efficiency'
  base_value: number
  unit: string
  description: string
  affects: string[]
  sensitivity_min: number
  sensitivity_max: number
}

export interface DriverTreeNode {
  id: string
  name: string
  type: 'metric' | 'line_item' | 'driver'
  value?: number
  children: DriverTreeNode[]
}

export interface ComputationStep {
  line_item_id: string
  formula: string
  depends_on: string[]
}

export interface FinancialAnalysis {
  analysis_id: string
  statement_type: string
  company_context: string
  base_period: string
  periods: string[]
  line_items: LineItem[]
  drivers: Driver[]
  driver_tree: DriverTreeNode
  computation_sequence: ComputationStep[]
  key_metrics: Record<string, number>
}

export interface ScenarioDriverChange {
  driver_id: string
  new_value: number
}

export interface ExternalFactorMapping {
  indicator_id: string
  indicator_value: number
  driver_id: string
  elasticity: number
}

export interface ScenarioRequest {
  analysis_id: string
  scenario_name: string
  driver_changes: ScenarioDriverChange[]
  external_factor_mappings: ExternalFactorMapping[]
}

export interface BridgeItem {
  label: string
  value: number
  running_total: number
  category: string
  is_subtotal: boolean
}

export interface ScenarioResult {
  scenario_name: string
  base_line_items: Record<string, number>
  scenario_line_items: Record<string, number>
  bridge_items: BridgeItem[]
  driver_impacts: Record<string, number>
  key_metrics_base: Record<string, number>
  key_metrics_scenario: Record<string, number>
  summary: string
}

export interface ExternalIndicator {
  id: string
  name: string
  value: number
  previous_value?: number
  change_pct?: number
  unit: string
  source: string
  period: string
  description: string
  suggested_driver_mapping?: string
}

export interface UploadResponse {
  file_id: string
  filename: string
  raw_preview: Record<string, unknown>[]
  columns: string[]
  rows: number
  detected_format: string
}

export type AppStep = 'upload' | 'review' | 'drivers' | 'scenario' | 'results'
