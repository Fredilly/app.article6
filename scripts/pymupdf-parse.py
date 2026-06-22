"""PyMuPDF + pdfplumber PDF parser helper for Quick Check parser adapter.

Usage:
  python3 scripts/pymupdf-parse.py <pdf_path> [--no-tables]

Outputs JSON to stdout with extracted document structure and phase diagnostics.
"""

import json
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_FONT_SIZE = 12.0
DICT_SAMPLE_PAGES = 5
TABLE_EXTRACT_PAGES = 10


def parse_pdf_with_pymupdf(
    pdf_path: str,
    skip_tables: bool = False,
) -> Dict[str, Any]:
    warnings: List[str] = []
    diagnostics: Dict[str, Any] = {}
    phases: Dict[str, float] = {}

    t0 = time.monotonic()

    # Phase: import check
    t1 = time.monotonic()
    try:
        import fitz
    except ImportError as exc:
        return {
            "error": "pymupdf_not_installed",
            "message": "PyMuPDF is not installed. Install it with: pip install pymupdf",
            "detail": str(exc),
        }
    phases["import_check"] = round(time.monotonic() - t1, 3)

    # Phase: optional pdfplumber
    pdfplumber = None
    if not skip_tables:
        try:
            import pdfplumber as plumber_mod
            pdfplumber = plumber_mod
        except ImportError:
            warnings.append(
                "pdfplumber not installed — table extraction disabled. "
                "Install with: pip install pdfplumber"
            )

    # Phase: open PDF
    t2 = time.monotonic()
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    phases["open_pdf"] = round(time.monotonic() - t2, 3)
    diagnostics["total_pages"] = total_pages

    pages_raw: List[Dict[str, Any]] = []
    headings: List[Dict[str, Any]] = []
    all_tables: List[Dict[str, Any]] = []
    markdown_lines: List[str] = []
    dict_pages_requested = 0
    dict_pages_succeeded = 0

    # Phase: estimate body font size once from a small sample
    t3 = time.monotonic()
    body_font_size, font_pages_sampled = _estimate_body_font_size_fast(doc)
    phases["estimate_body_font_size"] = round(time.monotonic() - t3, 3)
    diagnostics["body_font_size"] = round(body_font_size, 1)
    diagnostics["font_pages_sampled"] = font_pages_sampled

    # Phase: text extraction per page
    t4 = time.monotonic()
    for page_num in range(total_pages):
        page = doc[page_num]
        page_text = page.get_text("text")
        page_blocks: List[Dict[str, Any]] = []

        # Only use dict extraction on the first N pages for block structure.
        if page_num < DICT_SAMPLE_PAGES:
            dict_pages_requested += 1
            try:
                blocks_dict = page.get_text("dict")
                page_blocks, page_headings = _extract_blocks_and_headings(
                    blocks_dict, body_font_size, page_num,
                )
                dict_pages_succeeded += 1
            except Exception as e:
                warnings.append(
                    f"Page {page_num + 1} dict extraction failed, using text-only: {e}"
                )
        else:
            page_blocks = []

        if not page_text.strip():
            warnings.append(
                f"Page {page_num + 1} has no extractable text — may be scanned or image-only."
            )

        # Build markdown from blocks or fall back to page text.
        if page_blocks:
            for block in page_blocks:
                if block.get("is_heading"):
                    headings.append({
                        "text": block["text"],
                        "level": block.get("level", 2),
                        "page_number": page_num + 1,
                    })
                    heading_mark = "#" * block.get("level", 2)
                    markdown_lines.append(f"{heading_mark} {block['text']}")
                    markdown_lines.append("")
                else:
                    markdown_lines.append(block["text"])
                    markdown_lines.append("")
        else:
            markdown_lines.append(page_text.strip())
            markdown_lines.append("")

        pages_raw.append({
            "page_number": page_num + 1,
            "text": page_text,
            "blocks": page_blocks,
        })

    phases["text_extract"] = round(time.monotonic() - t4, 3)
    diagnostics["dict_pages_requested"] = dict_pages_requested
    diagnostics["dict_pages_succeeded"] = dict_pages_succeeded

    doc.close()

    # Phase: table extraction (separate file open, page-limited)
    t5 = time.monotonic()
    table_fallback_reason: Optional[str] = None
    if pdfplumber is not None and not skip_tables:
        try:
            all_tables = _extract_tables_with_pdfplumber(
                pdf_path, max(1, min(TABLE_EXTRACT_PAGES, total_pages))
            )
        except Exception as e:
            table_fallback_reason = str(e)
            warnings.append(f"pdfplumber table extraction failed: {table_fallback_reason}")
            all_tables = []
    else:
        if skip_tables:
            table_fallback_reason = "table extraction disabled via --no-tables"
        else:
            table_fallback_reason = "pdfplumber not installed"
    phases["table_extract"] = round(time.monotonic() - t5, 3)
    diagnostics["tables_extracted"] = len(all_tables)
    if table_fallback_reason:
        diagnostics["table_fallback"] = table_fallback_reason

    raw_text = "\f".join(p.get("text", "") for p in pages_raw)
    markdown = "\n".join(markdown_lines)

    if not raw_text.strip():
        warnings.append("No usable text extracted from the document.")

    # Phase: serialize
    t6 = time.monotonic()
    result = {
        "engine": "pymupdf",
        "parser_version": _get_version(),
        "raw_text": raw_text,
        "markdown": markdown,
        "pages": pages_raw,
        "headings": headings,
        "tables": all_tables,
        "warnings": warnings,
        "diagnostics": {
            **diagnostics,
            "phases": phases,
        },
    }
    phases["serialize_json"] = round(time.monotonic() - t6, 3)
    result["diagnostics"]["phases"] = phases
    result["diagnostics"]["total_time_s"] = round(time.monotonic() - t0, 3)

    return result


def _estimate_body_font_size_fast(doc) -> Tuple[float, int]:
    """Estimate body font size from a small sample with a fallback default."""
    sizes: List[float] = []
    sample_limit = min(3, len(doc))
    pages_sampled = 0

    for i in range(sample_limit):
        try:
            blocks = doc[i].get_text("dict")["blocks"]
        except Exception:
            continue

        pages_sampled += 1
        span_count = 0
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if len(text) > 30:
                        sizes.append(span.get("size", DEFAULT_FONT_SIZE))
                        span_count += 1
                        if span_count >= 50:
                            break
                if span_count >= 50:
                    break
            if span_count >= 50:
                break

    if not sizes:
        return DEFAULT_FONT_SIZE, pages_sampled

    sorted_sizes = sorted(sizes)
    lower_half = sorted_sizes[: max(1, len(sorted_sizes) // 2)]
    return sum(lower_half) / len(lower_half), pages_sampled


def _extract_blocks_and_headings(
    page_dict: Dict[str, Any],
    body_font_size: float,
    page_num: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Extract text blocks and heading hints from a page dict."""
    blocks_output: List[Dict[str, Any]] = []
    headings: List[Dict[str, Any]] = []

    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue

        block_text = ""
        block_font_sizes: List[float] = []
        block_bbox = block.get("bbox")

        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "").strip()
                if text:
                    block_text += text + " "
                    block_font_sizes.append(span.get("size", DEFAULT_FONT_SIZE))

        block_text = block_text.strip()
        if not block_text:
            continue

        avg_font_size = (
            sum(block_font_sizes) / len(block_font_sizes)
            if block_font_sizes
            else DEFAULT_FONT_SIZE
        )

        is_heading = bool(
            avg_font_size > body_font_size * 1.15 and len(block_text) < 200
        )

        level = 1
        if is_heading:
            if avg_font_size <= body_font_size * 1.3:
                level = 2
            elif avg_font_size <= body_font_size * 1.6:
                level = 3
            elif avg_font_size <= body_font_size * 2.0:
                level = 4

        blocks_output.append({
            "text": block_text,
            "bbox": list(block_bbox) if block_bbox else None,
            "is_heading": is_heading,
            "level": level,
            "avg_font_size": round(avg_font_size, 1),
        })

        if is_heading:
            headings.append({
                "text": block_text,
                "level": level,
                "page_number": page_num + 1,
            })

    return blocks_output, headings


def _extract_tables_with_pdfplumber(
    pdf_path: str,
    page_limit: int,
) -> List[Dict[str, Any]]:
    import pdfplumber as plumber

    tables_list: List[Dict[str, Any]] = []

    with plumber.open(pdf_path) as pdf:
        pages_to_scan = min(page_limit, len(pdf.pages))
        for page_num in range(pages_to_scan):
            page = pdf.pages[page_num]
            page_tables = page.extract_tables()
            for table_idx, table in enumerate(page_tables):
                cells: List[Dict[str, Any]] = []
                row_count = 0
                col_count = 0

                if table:
                    row_count = len(table)
                    col_count = max(len(row) for row in table) if table else 0

                    for row_idx, row in enumerate(table):
                        for col_idx, cell in enumerate(row):
                            cell_text = ""
                            if isinstance(cell, str):
                                cell_text = cell
                            elif isinstance(cell, (list, tuple)):
                                cell_text = " ".join(
                                    str(c) for c in cell if c is not None
                                ).strip()
                            elif cell is not None:
                                cell_text = str(cell)

                            if cell_text:
                                cells.append({
                                    "row": row_idx,
                                    "col": col_idx,
                                    "text": cell_text,
                                })

                table_id = f"table:pymupdf:{len(tables_list)}"
                tables_list.append({
                    "id": table_id,
                    "page_number": page_num + 1,
                    "row_count": row_count,
                    "column_count": col_count,
                    "cells": cells,
                })

    return tables_list


def _get_version() -> str:
    try:
        import importlib.metadata
        return importlib.metadata.version("pymupdf")
    except Exception:
        return "unknown"


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--version":
        try:
            import fitz
            ver = fitz.version
        except ImportError:
            ver = ("unknown",)
        print(ver[0] if isinstance(ver, tuple) else str(ver))
        sys.exit(0)

    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "missing_argument",
            "message": "Usage: python3 scripts/pymupdf-parse.py <pdf_path> [--no-tables]",
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(json.dumps({
            "error": "file_not_found",
            "message": f"PDF file not found: {pdf_path}",
        }))
        sys.exit(1)

    skip_tables = "--no-tables" in sys.argv

    try:
        result = parse_pdf_with_pymupdf(pdf_path, skip_tables=skip_tables)
    except Exception:
        result = {
            "error": "parse_failed",
            "message": "PyMuPDF parsing failed with an unexpected error.",
            "traceback": traceback.format_exc(),
        }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
