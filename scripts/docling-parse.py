"""Docling PDF parser helper for Quick Check parser adapter.

Usage:
  python3 scripts/docling-parse.py <pdf_path> [--output json|markdown]

Outputs JSON to stdout with extracted document structure.
"""

import json
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional


def parse_pdf_with_docling(pdf_path: str) -> Dict[str, Any]:
    """Parse a PDF file using Docling and return structured output."""
    try:
        from docling.document_converter import DocumentConverter
    except ImportError as exc:
        return {
            "error": "docling_not_installed",
            "message": (
                "Docling is not installed. Install it with: pip install docling"
            ),
            "detail": str(exc),
        }

    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    document = result.document

    markdown_text = document.export_to_markdown() if hasattr(document, "export_to_markdown") else ""
    pages = _extract_pages(document)
    headings = _extract_headings(document)
    tables = _extract_tables(document)
    raw_text = _build_raw_text(pages)

    return {
        "engine": "docling",
        "parser_version": _get_docling_version(),
        "raw_text": raw_text,
        "markdown": markdown_text,
        "pages": pages,
        "headings": headings,
        "tables": tables,
    }


def _get_docling_version() -> str:
    try:
        import importlib.metadata
        return importlib.metadata.version("docling")
    except Exception:
        return "unknown"


def _extract_pages(document: Any) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    try:
        for item in document.iterate_items():
            if hasattr(item, "prov"):
                page_no = item.prov[0].page_no if item.prov and len(item.prov) > 0 else 1
            elif hasattr(item, "page_no"):
                page_no = item.page_no
            else:
                page_no = 1

            text = ""
            if hasattr(item, "export_to_markdown"):
                text = item.export_to_markdown()
            elif hasattr(item, "text"):
                text = item.text
            elif hasattr(item, "label"):
                text = item.label

            pages.append({
                "page_number": page_no,
                "text": text if isinstance(text, str) else str(text),
            })
    except Exception:
        pass
    return pages


def _extract_headings(document: Any) -> List[Dict[str, Any]]:
    headings: List[Dict[str, Any]] = []
    try:
        for item in document.iterate_items():
            if hasattr(item, "label") and hasattr(item, "level"):
                page_no = 1
                if hasattr(item, "prov") and item.prov:
                    page_no = item.prov[0].page_no

                headings.append({
                    "text": str(item.label) if item.label else "",
                    "level": item.level if item.level else 1,
                    "page_number": page_no,
                })
    except Exception:
        pass
    return headings


def _extract_tables(document: Any) -> List[Dict[str, Any]]:
    tables_list: List[Dict[str, Any]] = []
    try:
        for item in document.iterate_items():
            if hasattr(item, "label") and str(item.label).lower() == "table":
                page_no = 1
                if hasattr(item, "prov") and item.prov:
                    page_no = item.prov[0].page_no

                cells: List[Dict[str, Any]] = []
                if hasattr(item, "cells"):
                    for cell in item.cells:
                        cells.append({
                            "row": cell.row if hasattr(cell, "row") else 0,
                            "col": cell.col if hasattr(cell, "col") else 0,
                            "text": cell.text if hasattr(cell, "text") else "",
                        })

                tables_list.append({
                    "id": f"table:docling:{len(tables_list)}",
                    "page_number": page_no,
                    "row_count": len(set(c["row"] for c in cells)) if cells else 0,
                    "column_count": len(set(c["col"] for c in cells)) if cells else 0,
                    "cells": cells,
                })
    except Exception:
        pass
    return tables_list


def _build_raw_text(pages: List[Dict[str, Any]]) -> str:
    return "\f".join(page.get("text", "") for page in pages)


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_argument", "message": "Usage: python3 scripts/docling-parse.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(json.dumps({"error": "file_not_found", "message": f"PDF file not found: {pdf_path}"}))
        sys.exit(1)

    try:
        result = parse_pdf_with_docling(pdf_path)
    except Exception:
        result = {
            "error": "parse_failed",
            "message": "Docling parsing failed with an unexpected error.",
            "traceback": traceback.format_exc(),
        }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
