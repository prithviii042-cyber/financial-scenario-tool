import pandas as pd
import io
import json
from typing import Dict, Any, List, Tuple
try:
    import pdfplumber
    _PDF_SUPPORT = True
except Exception:
    _PDF_SUPPORT = False


def parse_excel(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, str]:
    """Parse Excel file, try each sheet and find the most data-rich one."""
    xlsx = pd.ExcelFile(io.BytesIO(file_bytes))
    best_df = None
    best_sheet = None
    best_score = 0

    for sheet in xlsx.sheet_names:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet, header=None)
            # Score = non-null cells * columns
            score = df.notna().sum().sum()
            if score > best_score:
                best_score = score
                best_df = df
                best_sheet = sheet
        except Exception:
            continue

    if best_df is None:
        raise ValueError("Could not parse any sheet from the Excel file")

    # Try to find the header row (first row with multiple non-null string values)
    header_row = 0
    for i in range(min(10, len(best_df))):
        row = best_df.iloc[i]
        str_count = sum(1 for v in row if isinstance(v, str) and len(str(v).strip()) > 0)
        if str_count >= 2:
            header_row = i
            break

    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=best_sheet, header=header_row)
    df = df.dropna(how="all").dropna(axis=1, how="all")
    return df, f"Excel sheet: {best_sheet}"


def parse_csv(file_bytes: bytes) -> Tuple[pd.DataFrame, str]:
    """Parse CSV file with encoding detection."""
    for encoding in ["utf-8", "latin-1", "cp1252"]:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
            df = df.dropna(how="all").dropna(axis=1, how="all")
            return df, "CSV"
        except Exception:
            continue
    raise ValueError("Could not parse CSV file")


def parse_pdf(file_bytes: bytes) -> Tuple[str, str]:
    """Extract text from PDF using pdfplumber."""
    if not _PDF_SUPPORT:
        raise ValueError("PDF support not available. Please upload Excel or CSV.")
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            # Try to extract tables first
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        if row:
                            cleaned = [str(cell).strip() if cell else "" for cell in row]
                            text_parts.append(" | ".join(cleaned))
            else:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

    return "\n".join(text_parts), "PDF"


def dataframe_to_dict_list(df: pd.DataFrame, max_rows: int = 100) -> List[Dict[str, Any]]:
    """Convert DataFrame to list of dicts, handling NaN and special values."""
    df_clean = df.head(max_rows).copy()
    # Replace NaN with None for JSON serialization
    df_clean = df_clean.where(pd.notna(df_clean), None)
    # Convert all columns to string-safe types
    for col in df_clean.columns:
        df_clean[col] = df_clean[col].apply(
            lambda x: float(x) if isinstance(x, (int, float)) and x is not None else
                      str(x) if x is not None else None
        )
    return df_clean.to_dict(orient="records")


def dataframe_to_text(df: pd.DataFrame) -> str:
    """Convert DataFrame to a text representation for Claude."""
    lines = []
    # Header
    lines.append(" | ".join(str(col) for col in df.columns))
    lines.append("-" * 80)
    # Rows
    for _, row in df.iterrows():
        lines.append(" | ".join(
            f"{v:,.2f}" if isinstance(v, float) else str(v)
            for v in row
        ))
    return "\n".join(lines)


def process_uploaded_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Main entry point: process any supported file type."""
    filename_lower = filename.lower()

    if filename_lower.endswith((".xlsx", ".xls")):
        df, format_info = parse_excel(file_bytes, filename)
        raw_text = dataframe_to_text(df)
        preview = dataframe_to_dict_list(df, max_rows=50)
        columns = [str(c) for c in df.columns.tolist()]
        rows = len(df)
        detected_format = "Excel"

    elif filename_lower.endswith(".csv"):
        df, format_info = parse_csv(file_bytes)
        raw_text = dataframe_to_text(df)
        preview = dataframe_to_dict_list(df, max_rows=50)
        columns = [str(c) for c in df.columns.tolist()]
        rows = len(df)
        detected_format = "CSV"

    elif filename_lower.endswith(".pdf"):
        raw_text, format_info = parse_pdf(file_bytes)
        # For PDF, create a simple preview
        lines = raw_text.split("\n")[:50]
        preview = [{"line": i + 1, "content": line} for i, line in enumerate(lines)]
        columns = ["line", "content"]
        rows = len(raw_text.split("\n"))
        detected_format = "PDF"

    else:
        raise ValueError(f"Unsupported file format: {filename}")

    return {
        "raw_text": raw_text,
        "preview": preview,
        "columns": columns,
        "rows": rows,
        "detected_format": detected_format,
    }
