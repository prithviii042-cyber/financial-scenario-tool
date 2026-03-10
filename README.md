# CFO Financial Scenario Analysis Tool

AI-powered financial modelling tool for CFOs. Upload a P&L, Balance Sheet, or any financial dataset — Claude automatically understands the structure, builds a driver tree, and enables instant scenario analysis with external macro indicators.

## Features

- **Universal file upload**: Excel (.xlsx/.xls), CSV, and PDF support
- **AI financial understanding**: Claude Opus 4.6 identifies statement type, line items, and key drivers
- **Driver tree generation**: Hierarchical value driver decomposition (revenue drivers, cost drivers, margins)
- **Instant scenario engine**: Adjust sliders for any driver and instantly see cascading P&L impact
- **External macro indicators**: FRED (US), World Bank (global), Yahoo Finance (markets) — link to drivers with elasticity
- **Professional charts**: McKinsey-style waterfall bridge, base vs scenario comparison, tornado sensitivity chart
- **AI narrative**: Claude generates an executive summary of each scenario

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python |
| AI | Claude Opus 4.6 (adaptive thinking) |
| Frontend | React + TypeScript + Vite |
| Charts | Recharts |
| Styling | Tailwind CSS |
| File parsing | pandas, pdfplumber |
| External data | FRED API, World Bank API, yfinance |

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Anthropic API key

### Backend Setup

```bash
cd financial-scenario-tool/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (required)
# Optionally add FRED_API_KEY for US macro indicators (free at fred.stlouisfed.org)

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd financial-scenario-tool/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Workflow

```
1. Upload     → Drop your Excel/CSV/PDF financial file
2. Review     → Verify AI-extracted line items and periods
3. Driver Tree → Explore the AI-generated value driver hierarchy
4. Scenario   → Adjust driver sliders + link macro indicators
5. Results    → View waterfall bridge, charts, and AI narrative
```

## API Keys

| Service | Required | Where to get |
|---------|----------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | [console.anthropic.com](https://console.anthropic.com) |
| `FRED_API_KEY` | Optional | [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) — free |
| World Bank | Not needed | Public API, no key required |
| Yahoo Finance | Not needed | Via yfinance library, no key required |

## Example Files

The tool works with any financial data, including:
- Standard P&L with Revenue / COGS / Gross Profit / SG&A / EBITDA
- Multi-year Balance Sheets
- Quarterly KPI dashboards
- Custom management accounts

## Architecture

```
backend/
├── main.py                        # FastAPI app + CORS
├── models/schemas.py              # Pydantic data models
├── services/
│   ├── claude_service.py          # Claude Opus 4.6 analysis + scenario narration
│   ├── file_parser.py             # Excel/CSV/PDF parsing
│   ├── scenario_engine.py         # Driver formula evaluation (simpleeval)
│   └── external_data_service.py   # FRED / World Bank / yfinance
└── routers/
    ├── upload.py                  # POST /api/upload
    ├── analysis.py                # POST /api/analysis
    ├── scenarios.py               # POST /api/scenarios/compute
    └── external_data.py           # GET /api/external/indicators

frontend/src/
├── App.tsx                        # 5-step workflow navigation
├── components/
│   ├── FileUpload.tsx             # Drag-and-drop uploader with AI progress
│   ├── FinancialTable.tsx         # Parsed financial data review
│   ├── DriverTree.tsx             # Hierarchical driver visualization
│   ├── ScenarioBuilder.tsx        # Driver sliders + scenario inputs
│   ├── ExternalIndicators.tsx     # Macro indicator fetching + driver mapping
│   └── ScenarioCharts.tsx         # Waterfall, comparison, tornado charts
```

## Scenario Engine

Claude analyzes the uploaded data and returns:
1. **Line items** with historical values per period
2. **Drivers** with base values and type (volume/price/margin/growth_rate/absolute)
3. **Formulas** for computing each line item from drivers (safe arithmetic)
4. **Driver tree** showing hierarchical relationships

The Python scenario engine then:
- Evaluates formulas using `simpleeval` (safe, sandboxed arithmetic)
- Computes isolated impact of each driver change for the waterfall bridge
- Applies external macro factors via elasticity coefficients

## Extending

- **Add new external sources**: Add to `external_data_service.py`
- **Multiple scenarios**: The backend supports unlimited scenario runs — extend the frontend to save/compare
- **Export to Excel**: Add `openpyxl` export endpoint for scenario output
- **Database persistence**: Replace in-memory dicts in routers with SQLAlchemy models
