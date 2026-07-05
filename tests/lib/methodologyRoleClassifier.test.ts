import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { classifyMethodologyRoles, type MethodologyEntry } from "@/lib/chat/methodologyRoleClassifier";

function primary(result: ReturnType<typeof classifyMethodologyRoles>): MethodologyEntry | null {
  return result.primaryMethodology;
}

function monitoring(result: ReturnType<typeof classifyMethodologyRoles>): MethodologyEntry | null {
  return result.monitoringMethodology;
}

function referenced(result: ReturnType<typeof classifyMethodologyRoles>): MethodologyEntry[] {
  return result.referencedMethods;
}

describe("methodologyRoleClassifier", () => {
  describe("primary methodology detection", () => {
    it("classifies VM0007 under section-numbered 'B.1 Title and reference of approved baseline methodology applied'", () => {
      const text = [
        "B.1 Title and reference of approved baseline methodology applied",
        "VM0007 Version 1.0",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(primary(result)?.confidence).toBe("high");
      expect(primary(result)?.version).toBe("v1.0");
    });

    it("classifies VM0007 under 'Title and Reference of Methodology' as primary", () => {
      const text = [
        "Title and Reference of Methodology",
        "VM0007 Version 1.0",
        "This project applies the above methodology.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(primary(result)?.confidence).toBe("high");
      expect(primary(result)?.version).toBe("v1.0");
    });

    it("classifies VM0009 under 'Title and reference of the VCS methodology applied' as primary", () => {
      const text = [
        "Project Description Document",
        "Title and reference of the VCS methodology applied",
        "VM0009",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0009");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(primary(result)?.confidence).toBe("high");
    });

    it("classifies VM0004 under 'Applied methodology' heading as primary", () => {
      const text = [
        "Project Description Document",
        "Applied methodology",
        "VM0004",
        "Supporting references cite VM0007 and AM0001 as unrelated examples.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0004");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
    });

    it("classifies ACM0010 under 'Applied methodology:' as primary", () => {
      const text = [
        "Monitoring Report",
        "Applied methodology: ACM0010 Version 03.0",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("ACM0010");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(primary(result)?.version).toBe("v3.0");
    });

    it("classifies VM0009 from Kariba-style PDD fixture", () => {
      const text = fs.readFileSync(
        path.join(process.cwd(), "tests/fixtures/quick-check/kariba-primary-method.txt"),
        "utf-8",
      );

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0009");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(primary(result)?.confidence).toBe("high");
    });

    it("classifies VM0004 from Rimba Raya-style PDD fixture", () => {
      const text = fs.readFileSync(
        path.join(process.cwd(), "tests/fixtures/quick-check/rimba-raya-primary-method.txt"),
        "utf-8",
      );

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0004");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
    });

    it("classifies VM0009 from Kasigau-style PDD fixture", () => {
      const text = fs.readFileSync(
        path.join(process.cwd(), "tests/fixtures/quick-check/kasigau-primary-method.txt"),
        "utf-8",
      );

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0009");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
    });
  });

  describe("monitoring methodology detection", () => {
    it("classifies methodology under monitoring methodology heading", () => {
      const text = [
        "Name and reference of approved monitoring methodology applied",
        "AMS-III.AU",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(monitoring(result)?.id).toBe("AMS-III.AU");
      expect(monitoring(result)?.role).toBe("MONITORING_METHODOLOGY");
    });

    it("classifies under section-numbered 'D.1 Name and reference of approved monitoring methodology applied'", () => {
      const text = [
        "D.1 Name and reference of approved monitoring methodology applied",
        "ACM0002",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(monitoring(result)?.id).toBe("ACM0002");
      expect(monitoring(result)?.role).toBe("MONITORING_METHODOLOGY");
      expect(monitoring(result)?.confidence).toBe("high");
    });

    it("keeps the declaration-section methodology primary in CDM/PDD text with later calculation references", () => {
      const text = [
        "B.1. Title and reference of the approved baseline methodology applied to the small-scale project activity:",
        "“AMS-II.E – Energy efficiency and fuel switching measures for buildings” (version 8).",
        "For the calculation of the baseline emission coefficient of the electricity displaced “AMS-II.E” remits to",
        "“AMS-I.D – Grid connected renewable electricity generation” (version 10), which ultimately remits to",
        "“ACM0002 – Consolidated baseline methodology for grid connected electricity generation from renewable sources” (version 6).",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("AMS-II.E");
      expect(primary(result)?.version).toBe("v8.0");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");

      const acm = referenced(result).find((entry) => entry.id === "ACM0002");
      expect(acm?.role).toBe("REFERENCED_CALCULATION_METHOD");
      expect(acm?.version).toBe("v6.0");
    });

    it("classifies wrapped CDM monitoring methodology without inventing a primary methodology", () => {
      const text = [
        "D.1 Name and reference of approved monitoring methodology applied",
        "",
        "ACM0002 Version 02.0",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)).toBeNull();
      expect(monitoring(result)?.id).toBe("ACM0002");
      expect(monitoring(result)?.version).toBe("v2.0");
      expect(monitoring(result)?.role).toBe("MONITORING_METHODOLOGY");
    });

    it("distinguishes monitoring from primary when both are present", () => {
      const text = [
        "Applied methodology",
        "VM0007",
        "",
        "Name and reference of approved monitoring methodology applied",
        "VM0007",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(monitoring(result)?.role).toBe("MONITORING_METHODOLOGY");
    });
  });

  describe("background mention handling", () => {
    it("classifies footnoted methods as BACKGROUND_MENTION", () => {
      const text = [
        "Title and reference of methodology",
        "VM0007",
        "Footnote 1: Sample-size guidance also cites AM0001.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      const am0001 = referenced(result).find((e) => e.id === "AM0001");
      expect(am0001?.role).toBe("BACKGROUND_MENTION");
    });

    it("classifies 'other approved methodologies' references as BACKGROUND_MENTION", () => {
      const text = [
        "Applied methodology",
        "VM0004",
        "Supporting-document references mention AM0001 and AM0003 as examples of other approved methodologies.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      const am0001 = referenced(result).find((e) => e.id === "AM0001");
      const am0003 = referenced(result).find((e) => e.id === "AM0003");
      expect(am0001?.role).toBe("BACKGROUND_MENTION");
      expect(am0003?.role).toBe("BACKGROUND_MENTION");
    });
  });

  describe("tool and dependency detection", () => {
    it("classifies VMD modules as TOOL_OR_DEPENDENCY", () => {
      const text = [
        "The project uses VMD0001, VMD0006, and APD modules.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      const vmd1 = referenced(result).find((e) => e.id === "VMD0001");
      const apd = referenced(result).find((e) => e.id === "APD");
      expect(vmd1?.role).toBe("TOOL_OR_DEPENDENCY");
      expect(apd?.role).toBe("TOOL_OR_DEPENDENCY");
    });

    it("classifies VMR codes as TOOL_OR_DEPENDENCY", () => {
      const text = "VMR001 methodology reference";

      const result = classifyMethodologyRoles(text);
      const vmr = referenced(result).find((e) => e.id === "VMR001");
      expect(vmr?.role).toBe("TOOL_OR_DEPENDENCY");
    });
  });

  describe("calculation method references", () => {
    it("classifies methods in calculation context as REFERENCED_CALCULATION_METHOD", () => {
      const text = [
        "Baseline emissions are calculated using ACM0002 methodology.",
        "The parameter values follow the guidance in ACM0002.",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      const acm = referenced(result).find((e) => e.id === "ACM0002");
      expect(acm?.role).toBe("REFERENCED_CALCULATION_METHOD");
    });
  });

  describe("section-numbered CDM-style PDD headings", () => {
    it("classifies primary and monitoring from section-numbered headings in one document", () => {
      const text = [
        "B.1 Title and reference of approved baseline methodology applied",
        "VM0007 Version 1.0",
        "",
        "D.1 Name and reference of approved monitoring methodology applied",
        "ACM0002 Version 02.0",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
      expect(primary(result)?.version).toBe("v1.0");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
      expect(monitoring(result)?.id).toBe("ACM0002");
      expect(monitoring(result)?.version).toBe("v2.0");
      expect(monitoring(result)?.role).toBe("MONITORING_METHODOLOGY");
    });

    it("classifies GS methodology under section-numbered heading", () => {
      const text = [
        "B.1 Title and reference of approved baseline methodology applied",
        "GS-VER1 Version 2.0",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("GS-VER1");
      expect(primary(result)?.role).toBe("PRIMARY_PROJECT_METHODOLOGY");
    });
  });

  describe("complex PDDs with mixed references", () => {
    it("correctly classifies all entries in Kariba-style fixture", () => {
      const text = fs.readFileSync(
        path.join(process.cwd(), "tests/fixtures/quick-check/kariba-primary-method.txt"),
        "utf-8",
      );

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0009");

      const backgroundMethods = referenced(result).filter((e) => e.role === "BACKGROUND_MENTION");
      expect(backgroundMethods.length).toBeGreaterThanOrEqual(1);

      const am0001 = referenced(result).find((e) => e.id === "AM0001");
      expect(am0001?.role).toBe("BACKGROUND_MENTION");
    });

    it("handles the PD_REDD fixture with version", () => {
      const text = fs.readFileSync(
        path.join(process.cwd(), "tests/fixtures/quick-check/pd_redd_v1_130-extracted.txt"),
        "utf-8",
      );

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
    });
  });

  describe("edge cases", () => {
    it("returns no primary for empty text", () => {
      const result = classifyMethodologyRoles("");
      expect(primary(result)).toBeNull();
      expect(monitoring(result)).toBeNull();
      expect(referenced(result)).toEqual([]);
    });

    it("returns no primary when only modules are mentioned", () => {
      const text = "APD ARR VMD0001 VMD0006";
      const result = classifyMethodologyRoles(text);
      expect(primary(result)).toBeNull();
      expect(referenced(result).every((e) => e.role === "TOOL_OR_DEPENDENCY")).toBe(true);
    });

    it("handles standalone VM codes on their own line", () => {
      const text = [
        "Project Description Document",
        "VM0007 Version 4.2",
      ].join("\n");

      const result = classifyMethodologyRoles(text);
      expect(primary(result)?.id).toBe("VM0007");
    });
  });
});
