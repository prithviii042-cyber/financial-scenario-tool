import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import UploadResponse
from services.file_parser import process_uploaded_file

router = APIRouter(prefix="/api/upload", tags=["upload"])

# In-memory store for uploaded raw data (use Redis/DB in production)
_upload_store: dict = {}


def get_upload_data(file_id: str) -> dict:
    if file_id not in _upload_store:
        raise HTTPException(status_code=404, detail=f"File {file_id} not found")
    return _upload_store[file_id]


@router.post("", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """Accept a financial file (Excel, CSV, PDF) and return parsed preview."""
    allowed_types = {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "application/pdf",
        "application/octet-stream",
    }
    filename = file.filename or "upload"

    # Check extension as fallback
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in ("xlsx", "xls", "csv", "pdf"):
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Upload Excel (.xlsx/.xls), CSV, or PDF."
            )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    try:
        result = process_uploaded_file(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")

    file_id = str(uuid.uuid4())
    _upload_store[file_id] = {
        "raw_text": result["raw_text"],
        "filename": filename,
        "detected_format": result["detected_format"],
    }

    return UploadResponse(
        file_id=file_id,
        filename=filename,
        raw_preview=result["preview"],
        columns=result["columns"],
        rows=result["rows"],
        detected_format=result["detected_format"],
    )
