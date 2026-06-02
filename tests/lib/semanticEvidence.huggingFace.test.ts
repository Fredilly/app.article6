import { describe, expect, it } from "@jest/globals";
import {
  selectSemanticEvidenceBlocks,
  suggestSemanticEvidenceCandidates,
} from "@/lib/quickCheck/semanticEvidence/huggingFace";
import { buildArticle6DocumentModel } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";

const RAW_PDD_TEXT = [
  "4.3  Monitoring Plan",
  "The monitoring plan describes annual monitoring activities and plot remeasurement.",
  "",
  "4.3.1  Monitoring Frequency",
  "Monitoring occurs every 12 months with documented field checks.",
  "",
  "6  Stakeholder Comments",
  "Stakeholder comments are recorded in community meeting summaries.",
].join("\n");

describe("suggestSemanticEvidenceCandidates", () => {
  it("selects canonical blocks, calls Hugging Face, and returns only validated candidates", async () => {
    const model = buildArticle6DocumentModel({ parsedDocument: parseDocumentText({ rawText: RAW_PDD_TEXT }) });
    const blocks = selectSemanticEvidenceBlocks(model, "Does this PDD describe the monitoring plan?");
    const monitoringBlock = blocks.find((block) => block.text.includes("annual monitoring activities"));
    expect(monitoringBlock).toBeDefined();

    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_input)).toBe("https://api-inference.huggingface.co/models/openbmb/MiniCPM5-1B");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)?.authorization).toBe("Bearer test-key");
      const body = JSON.parse(String(init?.body));
      expect(body.inputs).toContain(`\"block_id\":\"${monitoringBlock?.blockId}\"`);
      return {
        ok: true,
        json: async () => ([{
          generated_text: JSON.stringify([{
            block_id: monitoringBlock?.blockId,
            page: monitoringBlock?.page,
            exact_quote: "The monitoring plan describes annual monitoring activities and plot remeasurement.",
            reason: "This block explicitly describes the monitoring plan content.",
            confidence: 0.92,
          }]),
        }]),
      } as Response;
    });

    const result = await suggestSemanticEvidenceCandidates(
      {
        claimText: "Does this PDD describe the monitoring plan?",
        rawPddText: RAW_PDD_TEXT,
        methodologyId: "VM0007",
        methodologyVersion: "1.0",
      },
      {
        apiKey: "test-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(result.status).toBe("available");
    expect(result.candidates).toEqual([
      expect.objectContaining({
        blockId: monitoringBlock?.blockId,
        page: monitoringBlock?.page,
        heading: "Monitoring Plan",
        quote: "The monitoring plan describes annual monitoring activities and plot remeasurement.",
        confidence: 0.92,
      }),
    ]);
  });

  it("drops candidates whose quote does not exist in the selected block", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ([{
        generated_text: JSON.stringify([{
          block_id: "block:body:4.3",
          page: 1,
          exact_quote: "This quote does not exist.",
          reason: "Invalid candidate.",
          confidence: 0.8,
        }]),
      }]),
    })) as unknown as typeof fetch;

    const result = await suggestSemanticEvidenceCandidates(
      {
        claimText: "Does this PDD describe the monitoring plan?",
        rawPddText: RAW_PDD_TEXT,
      },
      {
        apiKey: "test-key",
        fetchImpl: fetchMock,
      },
    );

    expect(result.status).toBe("available");
    expect(result.candidates).toEqual([]);
    expect(result.warning).toMatch(/no candidates passed deterministic quote\/block validation/i);
  });

  it("disables semantic evidence retrieval when HF_API_KEY is missing", async () => {
    const result = await suggestSemanticEvidenceCandidates({
      claimText: "Does this PDD describe the monitoring plan?",
      rawPddText: RAW_PDD_TEXT,
    });

    expect(result.status).toBe("disabled");
    expect(result.candidates).toEqual([]);
    expect(result.warning).toMatch(/HF_API_KEY/i);
  });
});
