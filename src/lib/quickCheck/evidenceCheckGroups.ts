/**
 * Evidence Check groups per document purpose.
 *
 * Each document purpose defines which checks are relevant.
 * Checks not in the group for the detected purpose are hidden
 * or marked Not Applicable.
 */

import type { DocumentPurpose } from "@/lib/documentClassification/classifyDocumentPurpose";
import type { EvidenceCheckId } from "@/lib/quickCheck/evidenceChecks";

export type CheckGroup = {
  label: string;
  checks: EvidenceCheckId[];
};

export function getCheckGroupsForPurpose(purpose: DocumentPurpose, methodologyId?: string): CheckGroup[] {
  const groups: CheckGroup[] = [];

  switch (purpose) {
    case "project_description_pdd": {
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "crediting_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      const sections: EvidenceCheckId[] = [
        "baseline_scenario", "additionality", "leakage",
      ];
      groups.push({ label: "Core Sections", checks: sections });

      if (methodologyId) {
        const mChecks = getMethodologySpecificIds(methodologyId);
        if (mChecks.length > 0) {
          groups.push({ label: `${methodologyId} Specific`, checks: mChecks });
        }
      }

      const supporting: EvidenceCheckId[] = [
        "environmental_impacts", "safeguards", "stakeholder_consultation",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }

    case "verification_report": {
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "monitoring_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      const sections: EvidenceCheckId[] = [
        "baseline_scenario", "additionality", "leakage",
      ];
      groups.push({ label: "Core Sections", checks: sections });

      if (methodologyId) {
        const mChecks = getMethodologySpecificIds(methodologyId);
        if (mChecks.length > 0) {
          groups.push({ label: `${methodologyId} Specific`, checks: mChecks });
        }
      }

      const supporting: EvidenceCheckId[] = [
        "stakeholder_consultation", "environmental_impacts",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }

    case "validation_report": {
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "crediting_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      const sections: EvidenceCheckId[] = [
        "baseline_scenario", "additionality", "leakage",
      ];
      groups.push({ label: "Core Sections", checks: sections });

      if (methodologyId) {
        const mChecks = getMethodologySpecificIds(methodologyId);
        if (mChecks.length > 0) {
          groups.push({ label: `${methodologyId} Specific`, checks: mChecks });
        }
      }

      const supporting: EvidenceCheckId[] = [
        "stakeholder_consultation", "environmental_impacts",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }

    case "validation_verification_report": {
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "crediting_period", "monitoring_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      const sections: EvidenceCheckId[] = [
        "baseline_scenario", "additionality", "leakage",
      ];
      groups.push({ label: "Core Sections", checks: sections });

      if (methodologyId) {
        const mChecks = getMethodologySpecificIds(methodologyId);
        if (mChecks.length > 0) {
          groups.push({ label: `${methodologyId} Specific`, checks: mChecks });
        }
      }

      const supporting: EvidenceCheckId[] = [
        "stakeholder_consultation", "environmental_impacts",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }

    case "monitoring_report": {
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "monitoring_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      if (methodologyId) {
        const mChecks = getMethodologySpecificIds(methodologyId);
        if (mChecks.length > 0) {
          groups.push({ label: `${methodologyId} Specific`, checks: mChecks });
        }
      }

      const supporting: EvidenceCheckId[] = [
        "leakage",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }

    default: {
      // unknown / methodology / risk / supporting — run universal identity
      const identity: EvidenceCheckId[] = [
        "project_activity", "host_country", "project_location",
        "methodology", "crediting_period",
      ];
      groups.push({ label: "Project Identity", checks: identity });

      const sections: EvidenceCheckId[] = [
        "baseline_scenario", "additionality", "leakage",
      ];
      groups.push({ label: "Core Sections", checks: sections });

      const supporting: EvidenceCheckId[] = [
        "stakeholder_consultation", "environmental_impacts",
      ];
      groups.push({ label: "Supporting Topics", checks: supporting });
      break;
    }
  }

  return groups;
}

function getMethodologySpecificIds(methodologyId: string): EvidenceCheckId[] {
  const normalized = methodologyId.trim().toUpperCase();
  if (normalized === "VM0007") {
    return ["vm0007_boundary", "vm0007_leakage_belt", "vm0007_reference_region", "vm0007_baseline_deforestation", "vm0007_carbon_pools", "vm0007_monitoring_plan"];
  }
  if (normalized === "AR-ACM0003") {
    return ["ar_acm0003_arr_activity", "ar_acm0003_boundary", "ar_acm0003_carbon_pools", "ar_acm0003_monitoring_plan"];
  }
  return [];
}

export function getEnabledCheckIds(purpose: DocumentPurpose, methodologyId?: string): Set<EvidenceCheckId> {
  const ids = new Set<EvidenceCheckId>();
  for (const group of getCheckGroupsForPurpose(purpose, methodologyId)) {
    for (const id of group.checks) {
      ids.add(id);
    }
  }
  return ids;
}
