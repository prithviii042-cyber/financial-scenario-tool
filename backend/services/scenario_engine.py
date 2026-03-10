"""
Scenario Engine: evaluates driver-based financial models safely.
Uses simpleeval for sandboxed arithmetic expression evaluation.
"""
from typing import Dict, List, Any
from simpleeval import SimpleEval
from models.schemas import (
    FinancialAnalysis, ScenarioRequest, ScenarioResult, BridgeItem,
    ScenarioDriverChange, ExternalFactorMapping
)


def build_variable_namespace(
    analysis: FinancialAnalysis,
    driver_overrides: Dict[str, float],
) -> Dict[str, float]:
    """Build the variable namespace for formula evaluation.

    Includes:
    - base_{line_item_id}: base period value for each line item
    - {driver_id}: current driver value (overridden if user changed it)
    """
    base_period = analysis.base_period
    namespace: Dict[str, float] = {}

    # Add base values for all line items
    for item in analysis.line_items:
        base_val = item.values.get(base_period, 0.0)
        namespace[f"base_{item.id}"] = base_val

    # Add driver values (use override if provided, else base)
    for driver in analysis.drivers:
        if driver.id in driver_overrides:
            namespace[driver.id] = driver_overrides[driver.id]
        else:
            namespace[driver.id] = driver.base_value

    return namespace


def evaluate_formulas(
    analysis: FinancialAnalysis,
    namespace: Dict[str, float],
) -> Dict[str, float]:
    """Evaluate computation sequence formulas in dependency order."""
    evaluator = SimpleEval()
    evaluator.names = dict(namespace)  # copy so we can add computed values

    results: Dict[str, float] = {}

    for step in analysis.computation_sequence:
        try:
            value = evaluator.eval(step.formula)
            results[step.line_item_id] = float(value)
            # Make computed value available for subsequent formulas
            evaluator.names[step.line_item_id] = float(value)
        except Exception as e:
            # If formula fails, fall back to base value
            base_val = namespace.get(f"base_{step.line_item_id}", 0.0)
            results[step.line_item_id] = base_val

    return results


def compute_driver_impacts(
    analysis: FinancialAnalysis,
    base_results: Dict[str, float],
    total_scenario_results: Dict[str, float],
    driver_changes: List[ScenarioDriverChange],
    key_metric_id: str,
) -> Dict[str, float]:
    """Compute isolated impact of each driver change on the key metric."""
    impacts: Dict[str, float] = {}
    base_metric = base_results.get(key_metric_id, 0.0)

    for change in driver_changes:
        # Apply only this one driver change
        single_overrides = {change.driver_id: change.new_value}
        namespace = build_variable_namespace(analysis, single_overrides)
        single_results = evaluate_formulas(analysis, namespace)
        single_metric = single_results.get(key_metric_id, 0.0)
        impacts[change.driver_id] = single_metric - base_metric

    return impacts


def apply_external_factors(
    analysis: FinancialAnalysis,
    driver_changes: List[ScenarioDriverChange],
    external_mappings: List[ExternalFactorMapping],
) -> List[ScenarioDriverChange]:
    """Apply external factor mappings on top of existing driver changes."""
    # Build a mutable dict of driver changes
    changes_dict: Dict[str, float] = {}
    for change in driver_changes:
        changes_dict[change.driver_id] = change.new_value

    # Get base driver values
    base_driver_values: Dict[str, float] = {d.id: d.base_value for d in analysis.drivers}

    for mapping in external_mappings:
        driver = next((d for d in analysis.drivers if d.id == mapping.driver_id), None)
        if not driver:
            continue

        # Current driver value (from existing change or base)
        current_value = changes_dict.get(mapping.driver_id, driver.base_value)

        # Compute macro-induced adjustment
        # Impact = indicator_value * elasticity (indicator_value is already relative, e.g., 0.025 = 2.5% GDP growth)
        macro_adjustment = mapping.indicator_value * mapping.elasticity

        # Apply adjustment based on driver type
        if driver.type in ("growth_rate", "margin"):
            new_value = current_value + macro_adjustment
        elif driver.type == "absolute":
            new_value = current_value * (1 + macro_adjustment)
        else:
            new_value = current_value + macro_adjustment

        changes_dict[mapping.driver_id] = new_value

    return [
        ScenarioDriverChange(driver_id=k, new_value=v)
        for k, v in changes_dict.items()
    ]


def find_key_metric(analysis: FinancialAnalysis) -> str:
    """Find the best key metric ID for bridge analysis (prefer EBITDA, then revenue)."""
    metric_preferences = ["ebitda", "ebit", "net_income", "operating_profit",
                          "gross_profit", "total_revenue", "revenue"]
    item_ids = {item.id.lower() for item in analysis.line_items}
    comp_ids = {step.line_item_id.lower() for step in analysis.computation_sequence}
    all_ids = item_ids | comp_ids

    for pref in metric_preferences:
        for id_ in all_ids:
            if pref in id_:
                return id_

    # Fall back to last item in computation sequence
    if analysis.computation_sequence:
        return analysis.computation_sequence[-1].line_item_id
    if analysis.line_items:
        return analysis.line_items[-1].id
    return "total_revenue"


def build_bridge(
    base_metric: float,
    driver_impacts: Dict[str, float],
    scenario_metric: float,
    analysis: FinancialAnalysis,
    driver_changes: List[ScenarioDriverChange],
) -> List[BridgeItem]:
    """Build waterfall bridge items from base to scenario."""
    bridge: List[BridgeItem] = []
    running = base_metric

    # Base bar
    bridge.append(BridgeItem(
        label="Base",
        value=base_metric,
        running_total=base_metric,
        category="base",
        is_subtotal=True,
    ))

    # Driver impact bars
    driver_map = {d.id: d for d in analysis.drivers}
    for change in driver_changes:
        impact = driver_impacts.get(change.driver_id, 0.0)
        if abs(impact) < 1:  # skip negligible impacts
            continue
        driver = driver_map.get(change.driver_id)
        label = driver.name if driver else change.driver_id
        running += impact
        category = "revenue" if driver and "revenue" in (driver.type or "") else "cost"
        bridge.append(BridgeItem(
            label=label,
            value=impact,
            running_total=running,
            category=category,
        ))

    # Reconciliation for any rounding/interaction effects
    reconciliation = scenario_metric - running
    if abs(reconciliation) > 1:
        bridge.append(BridgeItem(
            label="Interaction Effects",
            value=reconciliation,
            running_total=scenario_metric,
            category="other",
        ))

    # Scenario total
    bridge.append(BridgeItem(
        label="Scenario",
        value=scenario_metric,
        running_total=scenario_metric,
        category="total",
        is_subtotal=True,
    ))

    return bridge


def run_scenario(
    analysis: FinancialAnalysis,
    request: ScenarioRequest,
) -> ScenarioResult:
    """Main entry point: compute scenario from driver changes + external factors."""

    # 1. Apply external factor mappings to get effective driver changes
    effective_changes = apply_external_factors(
        analysis, request.driver_changes, request.external_factor_mappings
    )

    # 2. Build base namespace and compute base results
    base_namespace = build_variable_namespace(analysis, {})
    base_results = evaluate_formulas(analysis, base_namespace)

    # Add base line item values from the data
    base_period = analysis.base_period
    base_from_data = {item.id: item.values.get(base_period, 0.0) for item in analysis.line_items}

    # Merge: computed values override data values for items with formulas
    base_combined = {**base_from_data, **base_results}

    # 3. Build scenario namespace and compute scenario results
    overrides = {change.driver_id: change.new_value for change in effective_changes}
    scenario_namespace = build_variable_namespace(analysis, overrides)
    scenario_results = evaluate_formulas(analysis, scenario_namespace)
    scenario_combined = {**base_from_data, **scenario_results}

    # 4. Find key metric for bridge
    key_metric_id = find_key_metric(analysis)
    base_metric = base_combined.get(key_metric_id, 0.0)
    scenario_metric = scenario_combined.get(key_metric_id, 0.0)

    # 5. Compute isolated driver impacts
    driver_impacts = compute_driver_impacts(
        analysis, base_combined, scenario_combined, effective_changes, key_metric_id
    )

    # 6. Build bridge
    bridge = build_bridge(base_metric, driver_impacts, scenario_metric, analysis, effective_changes)

    # 7. Compute key metrics
    def safe_margin(numerator: float, denominator: float) -> float:
        return numerator / denominator if denominator != 0 else 0.0

    base_rev = base_combined.get("total_revenue", base_combined.get("revenue", 1.0))
    scen_rev = scenario_combined.get("total_revenue", scenario_combined.get("revenue", 1.0))
    base_gp = base_combined.get("gross_profit", 0.0)
    scen_gp = scenario_combined.get("gross_profit", 0.0)

    key_metrics_base = {
        "revenue": base_rev,
        "gross_profit": base_gp,
        "ebitda": base_metric,
        "gross_margin": safe_margin(base_gp, base_rev),
        "ebitda_margin": safe_margin(base_metric, base_rev),
    }
    key_metrics_scenario = {
        "revenue": scen_rev,
        "gross_profit": scen_gp,
        "ebitda": scenario_metric,
        "gross_margin": safe_margin(scen_gp, scen_rev),
        "ebitda_margin": safe_margin(scenario_metric, scen_rev),
    }

    return ScenarioResult(
        scenario_name=request.scenario_name,
        base_line_items=base_combined,
        scenario_line_items=scenario_combined,
        bridge_items=bridge,
        driver_impacts=driver_impacts,
        key_metrics_base=key_metrics_base,
        key_metrics_scenario=key_metrics_scenario,
        summary="",  # Filled in by claude_service if requested
    )
