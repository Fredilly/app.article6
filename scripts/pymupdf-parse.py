"""PyMuPDF + pdfplumber PDF parser helper for Quick Check parser adapter.

Usage:
  python3 scripts/pymupdf-parse.py <pdf_path>

Outputs JSON to stdout with extracted document structure.
"""

import json
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional


def parse_pdf_with_pymupdf(pdf_path: str) -> Dict[str, Any]:
    warnings: List[str] = []

    try:
        import fitz
    except ImportError as exc:
        return {
            "error": "pymupdf_not_installed",
            "message": "PyMuPDF is not installed. Install it with: pip install pymupdf",
            "detail": str(exc),
        }

    try:
        import pdfplumber
    except ImportError:
        pdfplumber = None
        warnings.append("pdfplumber not installed — table extraction disabled. Install with: pip install pdfplumber")

    doc = fitz.open(pdf_path)
    pages_raw: List[Dict[str, Any]] = []
    headings: List[Dict[str, Any]] = []
    all_tables: List[Dict[str, Any]] = []
    markdown_lines: List[str] = []
    heading_counter = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text("text")
        page_blocks: List[Dict[str, Any]] = []

        blocks = page.get_text("dict")["blocks"]
        page_heading_counter = 0

        for block in blocks:
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
                        block_font_sizes.append(span.get("size", 12))

            block_text = block_text.strip()
            if not block_text:
                continue

            page_blocks.append({
                "text": block_text,
                "bbox": list(block_bbox) if block_bbox else None,
            })

            avg_font_size = sum(block_font_sizes) / len(block_font_sizes) if block_font_sizes else 12
            body_font_size = _estimate_body_font_size(doc, page_num)

            if avg_font_size > body_font_size * 1.15 and len(block_text) < 200:
                heading_counter += 1
                page_heading_counter += 1

                level = 1
                if avg_font_size <= body_font_size * 1.3:
                    level = 2
                elif avg_font_size <= body_font_size * 1.6:
                    level = 3
                elif avg_font_size <= body_font_size * 2.0:
                    level = 4

                headings.append({
                    "text": block_text,
                    "level": level,
                    "page_number": page_num + 1,
                })

                heading_mark = "#" * level
                markdown_lines.append(f"{heading_mark} {block_text}")
                markdown_lines.append("")
            else:
                markdown_lines.append(block_text)
                markdown_lines.append("")

        if not page_text.strip():
            warnings.append(f"Page {page_num + 1} has no extractable text — may be scanned or image-only.")

        pages_raw.append({
            "page_number": page_num + 1,
            "text": page_text,
            "blocks": page_blocks,
        })

    doc.close()

    if pdfplumber is not None:
        try:
            all_tables = _extract_tables_with_pdfplumber(pdf_path)
        except Exception as e:
            warnings.append(f"pdfplumber table extraction failed: {str(e)}")
            all_tables = []
    else:
        all_tables = []

    raw_text = "\f".join(
        p.get("text", "") for p in pages_raw
    )
    markdown = "\n".join(markdown_lines)

    if not raw_text.strip():
        warnings.append("No usable text extracted from the document.")

    return {
        "engine": "pymupdf",
        "parser_version": _get_version(),
        "raw_text": raw_text,
        "markdown": markdown,
        "pages": pages_raw,
        "headings": headings,
        "tables": all_tables,
        "warnings": warnings,
    }


def _estimate_body_font_size(doc, current_page_num: int) -> float:
    sizes: List[float] = []
    for i in range(min(3, len(doc))):
        page = doc[i]
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if len(text) > 30:
                        sizes.append(span.get("size", 12))

    if not sizes:
        return 12.0
    return sum(sorted(sizes)[:max(1, len(sizes) // 2)]) / max(1, len(sizes) // 2)


def _extract_tables_with_pdfplumber(pdf_path: str) -> List[Dict[str, Any]]:
    import pdfplumber as plumber

    tables_list: List[Dict[str, Any]] = []

    with plumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
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
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_argument", "message": "Usage: python3 scripts/pymupdf-parse.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(json.dumps({"error": "file_not_found", "message": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)

    try:
        result = parse_pdf_with_pymupdf(pdf_path)
    except Exception:
        result = {
            "error": "parse_failed",
            "message": "PyMuPDF parsing failed with an unexpected error.",
            "traceback": traceback.format_exc(),
        }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
