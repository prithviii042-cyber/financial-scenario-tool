import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.schemas import FinancialAnalysis
from services.claude_service import analyze_financial_data
from routers.upload import get_upload_data

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# In-memory store for analysis results
_analysis_store: dict = {}


def get_analysis(analysis_id: str) -> FinancialAnalysis:
    if analysis_id not in _analysis_store:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    return _analysis_store[analysis_id]


class AnalyzeRequest(BaseModel):
    file_id: str


@router.post("", response_model=FinancialAnalysis)
async def analyze(request: AnalyzeRequest):
    """Run Claude analysis on uploaded financial data to build the driver model."""
    upload = get_upload_data(request.file_id)
    raw_text = upload["raw_text"]

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text content found in file")

    try:
        result_dict = await analyze_financial_data(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

    analysis_id = str(uuid.uuid4())
    result_dict["analysis_id"] = analysis_id

    try:
        analysis = FinancialAnalysis(**result_dict)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse AI response into financial model: {str(e)}"
        )

    _analysis_store[analysis_id] = analysis
    return analysis


@router.get("/{analysis_id}", response_model=FinancialAnalysis)
async def get_analysis_endpoint(analysis_id: str):
    """Retrieve a previously computed analysis."""
    return get_analysis(analysis_id)
