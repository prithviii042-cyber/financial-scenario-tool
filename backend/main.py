from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, analysis, scenarios, external_data

app = FastAPI(
    title="CFO Financial Scenario Analysis Tool",
    description="Upload financial data, get AI-generated driver trees, run scenario analysis with macro indicators.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(scenarios.router)
app.include_router(external_data.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
