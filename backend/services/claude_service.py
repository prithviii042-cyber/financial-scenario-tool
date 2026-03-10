import os
import json
import anthropic
from typing import Dict, Any, List
from models.schemas import FinancialAnalysis, ScenarioResult, BridgeItem

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

ANALYSIS_SYSTEM_PROMPT = """You are a CFO-level financial analyst and financial modelling expert.
Your role is to analyze uploaded financial data, identify the financial statement structure,
extract key value drivers, and build a driver-based financial model.

You always respond with valid, parseable JSON. No markdown fences, no extra text — only JSON."""

ANALYSIS_PROMPT_TEMPLATE = """Analyze this financial data and build a driver-based financial model.

FINANCIAL DATA:
{data}

Your task:
1. Identify statement type (P&L, Balance Sheet, Cash Flow, Mixed, or KPI data)
2. Identify time periods and the most recent base period
3. Extract all meaningful line items with values per period
4. Identify the 5-10 key business drivers that explain the financials
5. Build a driver tree (hierarchical breakdown from key metric down to drivers)
6. Define formulas for computing each line item from drivers (safe arithmetic only)
7. Order computations so each item is computed after its dependencies

Respond ONLY with this exact JSON structure:
{{
  "statement_type": "P&L",
  "company_context": "Brief description of the business based on the data",
  "base_period": "most recent period label e.g. 2024 or Q4 2024",
  "periods": ["2022", "2023", "2024"],
  "line_items": [
    {{
      "id": "total_revenue",
      "name": "Total Revenue",
      "category": "revenue",
      "values": {{"2022": 8500000, "2023": 9800000, "2024": 11200000}},
      "unit": "USD",
      "is_driver_output": true
    }}
  ],
  "drivers": [
    {{
      "id": "revenue_volume_growth",
      "name": "Revenue Volume Growth",
      "type": "growth_rate",
      "base_value": 0.143,
      "unit": "% growth",
      "description": "YoY growth rate in units/transactions sold",
      "affects": ["total_revenue"],
      "sensitivity_min": -0.3,
      "sensitivity_max": 0.5
    }},
    {{
      "id": "avg_price_change",
      "name": "Average Price Change",
      "type": "growth_rate",
      "base_value": 0.02,
      "unit": "% change",
      "description": "YoY change in average selling price",
      "affects": ["total_revenue"],
      "sensitivity_min": -0.2,
      "sensitivity_max": 0.2
    }},
    {{
      "id": "cogs_pct",
      "name": "COGS as % of Revenue",
      "type": "margin",
      "base_value": 0.45,
      "unit": "% of revenue",
      "description": "Cost of goods sold as a percentage of total revenue",
      "affects": ["cogs"],
      "sensitivity_min": -0.1,
      "sensitivity_max": 0.15
    }},
    {{
      "id": "sga_growth",
      "name": "SG&A Growth Rate",
      "type": "growth_rate",
      "base_value": 0.05,
      "unit": "% growth",
      "description": "Year-over-year growth in selling, general and administrative expenses",
      "affects": ["sga"],
      "sensitivity_min": -0.3,
      "sensitivity_max": 0.3
    }}
  ],
  "driver_tree": {{
    "id": "ebitda",
    "name": "EBITDA",
    "type": "metric",
    "children": [
      {{
        "id": "total_revenue",
        "name": "Total Revenue",
        "type": "line_item",
        "children": [
          {{"id": "revenue_volume_growth", "name": "Volume Growth", "type": "driver", "children": []}},
          {{"id": "avg_price_change", "name": "Price Change", "type": "driver", "children": []}}
        ]
      }},
      {{
        "id": "total_opex",
        "name": "Total Operating Costs",
        "type": "line_item",
        "children": [
          {{"id": "cogs_pct", "name": "COGS Margin", "type": "driver", "children": []}},
          {{"id": "sga_growth", "name": "SG&A Growth", "type": "driver", "children": []}}
        ]
      }}
    ]
  }},
  "computation_sequence": [
    {{
      "line_item_id": "total_revenue",
      "formula": "base_total_revenue * (1 + revenue_volume_growth) * (1 + avg_price_change)",
      "depends_on": []
    }},
    {{
      "line_item_id": "cogs",
      "formula": "total_revenue * cogs_pct",
      "depends_on": ["total_revenue"]
    }},
    {{
      "line_item_id": "gross_profit",
      "formula": "total_revenue - cogs",
      "depends_on": ["total_revenue", "cogs"]
    }},
    {{
      "line_item_id": "sga",
      "formula": "base_sga * (1 + sga_growth)",
      "depends_on": []
    }},
    {{
      "line_item_id": "ebitda",
      "formula": "gross_profit - sga",
      "depends_on": ["gross_profit", "sga"]
    }}
  ],
  "key_metrics": {{
    "revenue_growth_yoy": 0.143,
    "gross_margin": 0.55,
    "ebitda_margin": 0.22,
    "cagr_2y": 0.148
  }}
}}

Use ONLY actual numbers from the data. All monetary values in the same currency as the data.
Driver base_values must reflect the ACTUAL observed ratios/growth rates in the data.
Formulas must use ONLY: +, -, *, /, (, ), and variable names (driver ids and line item ids prefixed with base_ for base period values).
For base period values in formulas, prefix the line item id with "base_" (e.g., base_total_revenue).
"""


SCENARIO_PROMPT_TEMPLATE = """You are a financial modelling expert. Compute the scenario impact and provide a narrative summary.

BASE FINANCIALS (most recent period):
{base_financials}

DRIVER CHANGES APPLIED:
{driver_changes}

COMPUTED SCENARIO RESULTS:
{computed_results}

KEY METRICS CHANGE:
{metrics_delta}

Provide a brief executive summary (3-4 sentences) of what these changes mean for the business.
Respond ONLY with JSON:
{{
  "summary": "Executive summary of scenario impact..."
}}"""


async def analyze_financial_data(raw_text: str) -> Dict[str, Any]:
    """Call Claude to analyze financial data and return structured model."""
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(data=raw_text[:15000])  # Limit context

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        response = stream.get_final_message()

    # Extract text from response
    text_content = next(
        (block.text for block in response.content if block.type == "text"), ""
    )

    # Clean up any markdown fences if Claude included them
    text_content = text_content.strip()
    if text_content.startswith("```"):
        text_content = text_content.split("```")[1]
        if text_content.startswith("json"):
            text_content = text_content[4:]
    if text_content.endswith("```"):
        text_content = text_content[:-3]

    return json.loads(text_content.strip())


async def generate_scenario_summary(
    base_financials: Dict,
    driver_changes: List[Dict],
    computed_results: Dict,
    metrics_delta: Dict,
) -> str:
    """Generate an executive narrative for the scenario."""
    prompt = SCENARIO_PROMPT_TEMPLATE.format(
        base_financials=json.dumps(base_financials, indent=2),
        driver_changes=json.dumps(driver_changes, indent=2),
        computed_results=json.dumps(computed_results, indent=2),
        metrics_delta=json.dumps(metrics_delta, indent=2),
    )

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1000,
        system="You are a financial analyst. Respond only with the requested JSON.",
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    if text.endswith("```"):
        text = text[:-3]

    result = json.loads(text.strip())
    return result.get("summary", "Scenario analysis complete.")
