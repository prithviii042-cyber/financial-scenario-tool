from fastapi import APIRouter
from typing import List
from models.schemas import ExternalIndicator
from services.external_data_service import get_all_indicators, get_fred_indicators, get_world_bank_indicators, get_market_indicators

router = APIRouter(prefix="/api/external", tags=["external"])


@router.get("/indicators", response_model=List[ExternalIndicator])
async def get_all_external_indicators():
    """Fetch all macro and market indicators from FRED, World Bank, and yfinance."""
    return get_all_indicators()


@router.get("/indicators/fred", response_model=List[ExternalIndicator])
async def get_fred():
    return get_fred_indicators()


@router.get("/indicators/worldbank", response_model=List[ExternalIndicator])
async def get_worldbank():
    return get_world_bank_indicators()


@router.get("/indicators/market", response_model=List[ExternalIndicator])
async def get_market():
    return get_market_indicators()
