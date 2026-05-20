import { describe, expect, it } from '@jest/globals';
import { extractFacts } from '@/lib/evidence/extraction/factExtractor';
import { generateCandidateLinks } from '@/lib/evidence/extraction/candidateLinker';
import {
  computeInputFingerprint,
  computeFragmentSetFingerprint,
  computeFactSetFingerprint,
  computeLinkSetFingerprint,
} from '@/lib/evidence/extraction/provenance';
import type { DocumentFragment, ExtractedFact, ExtractionInputFingerprint } from '@/lib/evidence/extraction/types';

function makeFragment(index: number, text: string): DocumentFragment {
  return {
    fragmentId: `frag_${index}`,
    documentId: 'doc_1',
    kind: 'pdd',
    index,
    label: `Fragment ${index}`,
    text,
    contentSha256: '',
    pageStart: index + 1,
    pageEnd: index + 1,
  };
}

describe('Extraction Pipeline Determinism', () => {
  it('produces identical facts for same fragment input', async () => {
    const fragments = [
      makeFragment(0, 'Baseline Scenario: continuation of current land use practices. Total emissions 45,000 tCO2e annually.'),
      makeFragment(1, 'Carbon stocks estimated at 12.5 tC/ha. Methodology VM0047 v1.0.'),
    ];

    const facts1 = await extractFacts(fragments);
    const facts2 = await extractFacts(fragments);

    expect(facts1.length).toBe(facts2.length);
    expect(facts1.map((f) => f.contentSha256)).toEqual(facts2.map((f) => f.contentSha256));
    expect(facts1.map((f) => f.factType)).toEqual(facts2.map((f) => f.factType));

    const fp1 = await computeFactSetFingerprint(facts1);
    const fp2 = await computeFactSetFingerprint(facts2);
    expect(fp1).toBe(fp2);
  });

  it('produces different fingerprints for different inputs', async () => {
    const fragments1 = [makeFragment(0, 'Project A: 10,000 tCO2e')];
    const fragments2 = [makeFragment(0, 'Project B: 20,000 tCO2e')];

    const facts1 = await extractFacts(fragments1);
    const facts2 = await extractFacts(fragments2);

    const fp1 = await computeFactSetFingerprint(facts1);
    const fp2 = await computeFactSetFingerprint(facts2);

    expect(fp1).not.toBe(fp2);
  });

  it('produces identical fingerprints for identical inputs', async () => {
    const fragments = [makeFragment(0, 'Project A: 10,000 tCO2e')];
    const facts1 = await extractFacts(fragments);
    const facts2 = await extractFacts(fragments);
    const fp1 = await computeFactSetFingerprint(facts1);
    const fp2 = await computeFactSetFingerprint(facts2);
    expect(fp1).toBe(fp2);
  });

  it('extracts facts from PDD-style text', async () => {
    const fragments = [
      makeFragment(0, `Baseline Scenario: The baseline scenario is the continuation of current land use practices.
The project area consists of 1,250 hectares of degraded grassland.`),
      makeFragment(1, `Emission Reductions: The project will reduce emissions by 45,000 tCO2e annually.`),
      makeFragment(2, `Methodology: This project follows VM0047 v1.0. Discount rate 8.5%.`),
      makeFragment(3, `Location: Latitude 12.345, Longitude 98.765, Country: Exampleland`),
      makeFragment(4, `Monitoring Period: January 2025 to December 2025. Start Date: 01 January 2025.`),
    ];

    const facts = await extractFacts(fragments);
    const types = facts.map((f) => f.factType);

    expect(types).toContain('project-description');
    expect(types).toContain('methodology-reference');
    expect(types).toContain('quantity');
    expect(types).toContain('location');
    expect(types).toContain('date');
    expect(types).toContain('monitoring-period');
  });

  it('produces stable provenance hashes', async () => {
    const input: ExtractionInputFingerprint = {
      documents: [{ id: 'doc_1', contentSha256: 'abc123' }],
      methodCode: 'VM0047',
      methodVersion: 'v1-0',
    };

    const fragments = [makeFragment(0, 'Test evidence fragment content')];
    const facts = await extractFacts(fragments);

    const inputFp = await computeInputFingerprint(input);
    const fragmentFp = await computeFragmentSetFingerprint(fragments);
    const factFp = await computeFactSetFingerprint(facts);

    expect(inputFp).toMatch(/^[a-f0-9]{64}$/);
    expect(fragmentFp).toMatch(/^[a-f0-9]{64}$/);
    expect(factFp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates candidate links from facts to rules', async () => {
    const facts: ExtractedFact[] = [
      {
        factId: 'fact_1',
        fragmentId: 'frag_0',
        documentId: 'doc_1',
        factType: 'quantity',
        value: '12.5 tC/ha carbon stock',
        context: 'Carbon stocks estimated at 12.5 tC/ha',
        contentSha256: 'hash1',
      },
    ];

    const rules = [
      {
        ruleId: 'R1',
        ruleTitle: 'Carbon Stock Estimation',
        sectionId: 'S1',
        evidenceLabels: ['Carbon stock data', 'Biomass estimates'],
        evidenceIds: ['ES1', 'ES2'],
      },
    ];

    const links = await generateCandidateLinks(facts, rules);

    expect(links.length).toBeGreaterThan(0);
    expect(links[0].ruleId).toBe('R1');
    expect(links[0].confidence).toBeGreaterThan(0);
    expect(links[0].contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic: re-running produces identical candidate links', async () => {
    const facts: ExtractedFact[] = [
      {
        factId: 'fact_1',
        fragmentId: 'frag_0',
        documentId: 'doc_1',
        factType: 'quantity',
        value: '45,000 tCO2e',
        context: 'emission reductions of 45,000 tCO2e annually',
        contentSha256: 'hash_a',
      },
    ];

    const rules = [
      {
        ruleId: 'R1',
        ruleTitle: 'Emission Reductions',
        sectionId: 'S1',
        evidenceLabels: ['Emission reduction data', 'GHG reductions'],
        evidenceIds: ['ER1'],
      },
    ];

    const links1 = await generateCandidateLinks(facts, rules);
    const links2 = await generateCandidateLinks(facts, rules);

    expect(links1).toEqual(links2);
    const fp1 = await computeLinkSetFingerprint(links1);
    const fp2 = await computeLinkSetFingerprint(links2);
    expect(fp1).toBe(fp2);
  });
});
