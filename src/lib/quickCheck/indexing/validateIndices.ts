import type {
  IndexValidationIssue,
  IndexValidationResult,
  SectionTree,
  TableIndex,
} from "@/lib/quickCheck/indexing/types";

function makeResult(errors: IndexValidationIssue[], warnings: IndexValidationIssue[]): IndexValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateSectionTree(sectionTree: SectionTree): IndexValidationResult {
  const errors: IndexValidationIssue[] = [];
  const warnings: IndexValidationIssue[] = [];
  const seenNodeIds = new Set<string>();

  for (const nodeId of sectionTree.orderedNodeIds) {
    if (seenNodeIds.has(nodeId)) {
      errors.push({
        code: "duplicate_node_id",
        message: `Section tree orderedNodeIds contains duplicate node id "${nodeId}".`,
        affectedId: nodeId,
      });
      continue;
    }
    seenNodeIds.add(nodeId);
  }

  for (const [nodeId, node] of Object.entries(sectionTree.nodesById)) {
    if (node.parentId && !sectionTree.nodesById[node.parentId]) {
      errors.push({
        code: "orphan_parent_id",
        message: `Section node "${nodeId}" points to missing parent "${node.parentId}".`,
        affectedId: nodeId,
        affectedPath: node.sectionPath,
      });
    }
    if (!node.heading.trim()) {
      errors.push({
        code: "missing_heading",
        message: `Section node "${nodeId}" has an empty heading.`,
        affectedId: nodeId,
        affectedPath: node.sectionPath,
      });
    }
    if (node.evidenceSpanIds.length === 0) {
      errors.push({
        code: "missing_evidence_span_ids",
        message: `Section node "${nodeId}" has no evidence span ids.`,
        affectedId: nodeId,
        affectedPath: node.sectionPath,
      });
    }
    if (node.pageNumbers.length === 0) {
      warnings.push({
        code: "missing_page_provenance",
        message: `Section node "${nodeId}" has no page provenance.`,
        affectedId: nodeId,
        affectedPath: node.sectionPath,
      });
    }
  }

  return makeResult(errors, warnings);
}

export function validateTableIndex(tableIndex: TableIndex): IndexValidationResult {
  const errors: IndexValidationIssue[] = [];
  const warnings: IndexValidationIssue[] = [];
  const tableIds = new Map<string, string[]>();

  for (const table of tableIndex.tables) {
    if (table.tableId) {
      tableIds.set(table.tableId, [...(tableIds.get(table.tableId) ?? []), table.evidenceSpanId]);
    }

    if (!table.limitedProvenance && table.pageNumbers.length === 0) {
      warnings.push({
        code: "missing_table_provenance",
        message: `Table "${table.tableId ?? table.evidenceSpanId}" is missing page provenance.`,
        affectedId: table.tableId ?? table.evidenceSpanId,
        affectedPath: table.sectionPath,
      });
    }

    for (const cell of table.cells) {
      if (!Number.isInteger(cell.rowIndex) || !Number.isInteger(cell.columnIndex)) {
        errors.push({
          code: "missing_cell_coordinates",
          message: `Table cell in "${table.tableId ?? table.evidenceSpanId}" is missing rowIndex or columnIndex.`,
          affectedId: table.tableId ?? table.evidenceSpanId,
          affectedPath: cell.sectionPath,
        });
      }
      if (!tableIndex.byEvidenceSpanId[cell.evidenceSpanId]) {
        errors.push({
          code: "missing_cell_span_reference",
          message: `Table cell in "${table.tableId ?? table.evidenceSpanId}" points to missing evidence span "${cell.evidenceSpanId}".`,
          affectedId: table.tableId ?? table.evidenceSpanId,
          affectedPath: cell.sectionPath,
        });
      }
      if (!cell.limitedProvenance && (cell.pageNumber == null || (!cell.sourceBlockId && !cell.sourceTableId))) {
        warnings.push({
          code: "missing_cell_provenance",
          message: `Table cell in "${table.tableId ?? table.evidenceSpanId}" is missing page or source provenance.`,
          affectedId: table.tableId ?? table.evidenceSpanId,
          affectedPath: cell.sectionPath,
        });
      }
    }
  }

  for (const [tableId, evidenceSpanIds] of tableIds.entries()) {
    if (evidenceSpanIds.length > 1) {
      errors.push({
        code: "duplicate_table_id",
        message: `Table id "${tableId}" is duplicated across evidence spans: ${evidenceSpanIds.join(", ")}.`,
        affectedId: tableId,
      });
    }
  }

  return makeResult(errors, warnings);
}
