from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Literal
from enum import Enum


class DriverType(str, Enum):
    volume = "volume"
    price = "price"
    margin = "margin"
    growth_rate = "growth_rate"
    absolute = "absolute"
    efficiency = "efficiency"


class LineItem(BaseModel):
    id: str
    name: str
    category: str  # revenue | cogs | gross_profit | opex | ebitda | ebit | net_income | asset | liability | other
    values: Dict[str, float]  # period -> value
    unit: str = "USD"
    is_driver_output: bool = False


class Driver(BaseModel):
    id: str
    name: str
    type: DriverType
    base_value: float
    unit: str
    description: str
    affects: List[str]  # line item ids this driver affects
    sensitivity_min: float = -0.5
    sensitivity_max: float = 0.5
    # For growth_rate type: 0.05 means 5% growth; for margin type: 0.45 means 45% margin


class DriverTreeNode(BaseModel):
    id: str
    name: str
    type: Literal["metric", "line_item", "driver"] = "metric"
    value: Optional[float] = None
    children: List["DriverTreeNode"] = []


DriverTreeNode.model_rebuild()


class ComputationStep(BaseModel):
    line_item_id: str
    formula: str  # safe arithmetic expression using driver ids and line item ids
    depends_on: List[str] = []  # other line item ids needed first


class FinancialAnalysis(BaseModel):
    analysis_id: str
    statement_type: str  # P&L | Balance Sheet | Cash Flow | Mixed | KPI
    company_context: str
    base_period: str
    periods: List[str]
    line_items: List[LineItem]
    drivers: List[Driver]
    driver_tree: DriverTreeNode
    computation_sequence: List[ComputationStep]
    key_metrics: Dict[str, float] = {}


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    raw_preview: List[Dict[str, Any]]
    columns: List[str]
    rows: int
    detected_format: str


class ScenarioDriverChange(BaseModel):
    driver_id: str
    new_value: float  # absolute new value for the driver


class ExternalFactorMapping(BaseModel):
    indicator_id: str  # e.g., "GDP_GROWTH"
    indicator_value: float  # actual value, e.g., 0.025 for 2.5% GDP growth
    driver_id: str  # which driver this affects
    elasticity: float  # 1.0 = 1:1, 0.5 = half elasticity
    # Impact = (indicator_value - indicator_baseline) * elasticity -> added to driver change


class ScenarioRequest(BaseModel):
    analysis_id: str
    scenario_name: str = "Scenario 1"
    driver_changes: List[ScenarioDriverChange] = []
    external_factor_mappings: List[ExternalFactorMapping] = []


class BridgeItem(BaseModel):
    label: str
    value: float  # the incremental change
    running_total: float
    category: str  # revenue | cost | other | subtotal | base | total
    is_subtotal: bool = False


class ScenarioResult(BaseModel):
    scenario_name: str
    base_line_items: Dict[str, float]  # line_item_id -> base value
    scenario_line_items: Dict[str, float]  # line_item_id -> scenario value
    bridge_items: List[BridgeItem]
    driver_impacts: Dict[str, float]  # driver_id -> impact on key metric
    key_metrics_base: Dict[str, float]
    key_metrics_scenario: Dict[str, float]
    summary: str


class ExternalIndicator(BaseModel):
    id: str
    name: str
    value: float
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    unit: str
    source: str  # FRED | WorldBank | yfinance | Manual
    period: str
    description: str
    suggested_driver_mapping: Optional[str] = None  # suggested driver id to map to
