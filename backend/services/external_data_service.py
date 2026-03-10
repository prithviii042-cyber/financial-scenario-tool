"""
External macro indicator fetching from FRED, World Bank, and yfinance.
"""
import os
import requests
from typing import List, Optional
from datetime import datetime, timedelta
from models.schemas import ExternalIndicator

FRED_API_KEY = os.environ.get("FRED_API_KEY", "")
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"
WB_BASE = "https://api.worldbank.org/v2/country/US/indicator"


# ── FRED Series ──────────────────────────────────────────────────────────────

FRED_INDICATORS = [
    {
        "id": "GDP_GROWTH",
        "series_id": "A191RL1Q225SBEA",
        "name": "US Real GDP Growth (QoQ, annualized)",
        "unit": "% annual rate",
        "description": "Real gross domestic product growth rate, seasonally adjusted annual rate",
        "suggested_driver_mapping": "revenue_volume_growth",
    },
    {
        "id": "CPI",
        "series_id": "CPIAUCSL",
        "name": "US Consumer Price Index (YoY %)",
        "unit": "% change YoY",
        "description": "Consumer price index for all urban consumers, used as inflation proxy",
        "suggested_driver_mapping": "avg_price_change",
    },
    {
        "id": "FED_FUNDS_RATE",
        "series_id": "FEDFUNDS",
        "name": "Federal Funds Rate",
        "unit": "%",
        "description": "Effective federal funds rate — affects cost of debt and discount rates",
        "suggested_driver_mapping": None,
    },
    {
        "id": "UNEMPLOYMENT",
        "series_id": "UNRATE",
        "name": "US Unemployment Rate",
        "unit": "%",
        "description": "Civilian unemployment rate — proxy for labor market tightness and wages",
        "suggested_driver_mapping": None,
    },
    {
        "id": "RETAIL_SALES",
        "series_id": "RSXFS",
        "name": "US Retail Sales (YoY %)",
        "unit": "% change YoY",
        "description": "Retail and food services sales excluding motor vehicles — consumer spending indicator",
        "suggested_driver_mapping": "revenue_volume_growth",
    },
    {
        "id": "PPI",
        "series_id": "PPIACO",
        "name": "Producer Price Index (YoY %)",
        "unit": "% change YoY",
        "description": "Producer price index for all commodities — leading indicator of input cost changes",
        "suggested_driver_mapping": "cogs_pct",
    },
]


def fetch_fred_series(series_id: str, num_observations: int = 2) -> Optional[List[float]]:
    """Fetch the latest N observations from a FRED series."""
    if not FRED_API_KEY:
        return None

    try:
        params = {
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "sort_order": "desc",
            "limit": num_observations,
        }
        resp = requests.get(FRED_BASE, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        obs = data.get("observations", [])
        values = []
        for o in obs:
            try:
                values.append(float(o["value"]))
            except (ValueError, KeyError):
                pass
        return values if values else None
    except Exception:
        return None


def get_fred_indicators() -> List[ExternalIndicator]:
    """Fetch all configured FRED indicators."""
    indicators: List[ExternalIndicator] = []
    current_year = datetime.now().year

    for cfg in FRED_INDICATORS:
        observations = fetch_fred_series(cfg["series_id"], num_observations=2)

        if observations and len(observations) >= 1:
            current_val = observations[0]
            prev_val = observations[1] if len(observations) > 1 else None

            # For growth-rate series, values are already in %
            # Convert to decimal for driver compatibility
            if "GROWTH" in cfg["id"] or "%" in cfg["unit"]:
                value_decimal = current_val / 100.0
                prev_decimal = prev_val / 100.0 if prev_val is not None else None
            else:
                value_decimal = current_val
                prev_decimal = prev_val

            change_pct = None
            if prev_val is not None and prev_val != 0:
                change_pct = (current_val - prev_val) / abs(prev_val)

            indicators.append(ExternalIndicator(
                id=cfg["id"],
                name=cfg["name"],
                value=value_decimal,
                previous_value=prev_decimal,
                change_pct=change_pct,
                unit=cfg["unit"],
                source="FRED",
                period=str(current_year),
                description=cfg["description"],
                suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
            ))
        else:
            # Return placeholder when FRED key is missing or API fails
            indicators.append(ExternalIndicator(
                id=cfg["id"],
                name=cfg["name"],
                value=0.025 if "GROWTH" in cfg["id"] else 0.03,  # placeholder
                unit=cfg["unit"],
                source="FRED (unavailable — add FRED_API_KEY)",
                period=str(current_year),
                description=cfg["description"],
                suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
            ))

    return indicators


# ── World Bank ────────────────────────────────────────────────────────────────

WB_INDICATORS = [
    {
        "id": "WB_GDP_GROWTH",
        "indicator_code": "NY.GDP.MKTP.KD.ZG",
        "name": "World GDP Growth Rate",
        "unit": "% annual",
        "description": "World aggregate GDP growth — global demand proxy",
        "suggested_driver_mapping": "revenue_volume_growth",
    },
    {
        "id": "WB_INFLATION",
        "indicator_code": "FP.CPI.TOTL.ZG",
        "name": "World Inflation (CPI)",
        "unit": "% annual",
        "description": "Global consumer price inflation — pricing power indicator",
        "suggested_driver_mapping": "avg_price_change",
    },
]


def get_world_bank_indicators() -> List[ExternalIndicator]:
    """Fetch World Bank indicators (no API key required)."""
    indicators: List[ExternalIndicator] = []

    for cfg in WB_INDICATORS:
        try:
            url = f"{WB_BASE}/{cfg['indicator_code']}?format=json&mrv=2&per_page=2"
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if len(data) > 1 and data[1]:
                values = [entry for entry in data[1] if entry.get("value") is not None]
                if values:
                    current = values[0]
                    prev = values[1] if len(values) > 1 else None

                    current_val = float(current["value"]) / 100.0
                    prev_val = float(prev["value"]) / 100.0 if prev else None
                    change_pct = ((current_val - prev_val) / abs(prev_val)) if prev_val else None

                    indicators.append(ExternalIndicator(
                        id=cfg["id"],
                        name=cfg["name"],
                        value=current_val,
                        previous_value=prev_val,
                        change_pct=change_pct,
                        unit=cfg["unit"],
                        source="World Bank",
                        period=str(current.get("date", "")),
                        description=cfg["description"],
                        suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
                    ))
                    continue
        except Exception:
            pass

        # Fallback placeholder
        indicators.append(ExternalIndicator(
            id=cfg["id"],
            name=cfg["name"],
            value=0.03,
            unit=cfg["unit"],
            source="World Bank (unavailable)",
            period=str(datetime.now().year - 1),
            description=cfg["description"],
            suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
        ))

    return indicators


# ── Yahoo Finance / yfinance ──────────────────────────────────────────────────

YFINANCE_TICKERS = [
    {
        "id": "SP500",
        "ticker": "^GSPC",
        "name": "S&P 500 Index",
        "unit": "index level",
        "description": "US equity market benchmark — proxy for business confidence and valuation multiples",
        "suggested_driver_mapping": None,
    },
    {
        "id": "VIX",
        "ticker": "^VIX",
        "name": "CBOE Volatility Index (VIX)",
        "unit": "index",
        "description": "Market fear gauge — high VIX indicates uncertainty, may affect capex and hiring decisions",
        "suggested_driver_mapping": None,
    },
    {
        "id": "OIL_WTI",
        "ticker": "CL=F",
        "name": "Crude Oil WTI ($/barrel)",
        "unit": "USD/barrel",
        "description": "Oil price — key input cost driver for energy-intensive industries",
        "suggested_driver_mapping": "cogs_pct",
    },
    {
        "id": "DXY",
        "ticker": "DX-Y.NYB",
        "name": "US Dollar Index (DXY)",
        "unit": "index",
        "description": "Dollar strength — affects international revenue and import costs",
        "suggested_driver_mapping": "avg_price_change",
    },
]


def get_market_indicators() -> List[ExternalIndicator]:
    """Fetch market data from Yahoo Finance."""
    indicators: List[ExternalIndicator] = []

    try:
        import yfinance as yf
        from datetime import timedelta

        for cfg in YFINANCE_TICKERS:
            try:
                ticker = yf.Ticker(cfg["ticker"])
                hist = ticker.history(period="5d")

                if not hist.empty:
                    current_price = float(hist["Close"].iloc[-1])
                    prev_price = float(hist["Close"].iloc[-2]) if len(hist) > 1 else None
                    change_pct = ((current_price - prev_price) / abs(prev_price)) if prev_price else None

                    indicators.append(ExternalIndicator(
                        id=cfg["id"],
                        name=cfg["name"],
                        value=current_price,
                        previous_value=prev_price,
                        change_pct=change_pct,
                        unit=cfg["unit"],
                        source="Yahoo Finance",
                        period=hist.index[-1].strftime("%Y-%m-%d"),
                        description=cfg["description"],
                        suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
                    ))
                    continue
            except Exception:
                pass

            indicators.append(ExternalIndicator(
                id=cfg["id"],
                name=cfg["name"],
                value=0.0,
                unit=cfg["unit"],
                source="Yahoo Finance (unavailable)",
                period=datetime.now().strftime("%Y-%m-%d"),
                description=cfg["description"],
                suggested_driver_mapping=cfg.get("suggested_driver_mapping"),
            ))

    except ImportError:
        pass

    return indicators


def get_all_indicators() -> List[ExternalIndicator]:
    """Fetch all external indicators from all sources."""
    indicators = []
    indicators.extend(get_fred_indicators())
    indicators.extend(get_world_bank_indicators())
    indicators.extend(get_market_indicators())
    return indicators
