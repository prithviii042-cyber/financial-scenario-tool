from fastapi import APIRouter, HTTPException
from models.schemas import ScenarioRequest, ScenarioResult
from services.scenario_engine import run_scenario
from services.claude_service import generate_scenario_summary
from routers.analysis import get_analysis

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.post("/compute", response_model=ScenarioResult)
async def compute_scenario(request: ScenarioRequest):
    """Compute a scenario given driver changes and optional external factor mappings."""
    analysis = get_analysis(request.analysis_id)

    try:
        result = run_scenario(analysis, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario computation failed: {str(e)}")

    # Generate AI narrative summary asynchronously
    try:
        base_summary = {
            k: v for k, v in result.base_line_items.items()
            if abs(v) > 0
        }
        driver_changes_summary = [
            {"driver": c.driver_id, "new_value": c.new_value}
            for c in request.driver_changes
        ]
        scenario_summary = {
            k: v for k, v in result.scenario_line_items.items()
            if abs(v) > 0
        }

        summary = await generate_scenario_summary(
            base_financials=base_summary,
            driver_changes=driver_changes_summary,
            computed_results=scenario_summary,
            metrics_delta={
                "base_ebitda": result.key_metrics_base.get("ebitda", 0),
                "scenario_ebitda": result.key_metrics_scenario.get("ebitda", 0),
                "base_revenue": result.key_metrics_base.get("revenue", 0),
                "scenario_revenue": result.key_metrics_scenario.get("revenue", 0),
                "ebitda_margin_base": result.key_metrics_base.get("ebitda_margin", 0),
                "ebitda_margin_scenario": result.key_metrics_scenario.get("ebitda_margin", 0),
            },
        )
        result.summary = summary
    except Exception:
        result.summary = "Scenario computed successfully."

    return result
