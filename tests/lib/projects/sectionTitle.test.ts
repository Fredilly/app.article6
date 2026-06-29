import { describe, expect, it } from '@jest/globals';
import { sectionTitle } from '@/lib/projects/verificationReport';

describe('sectionTitle (VM0007 S-5 Quantification label)', () => {
  it('returns Quantification for Verra AFOLU S-5', () => {
    expect(sectionTitle('S-5', 'VM0007')).toBe('Quantification');
  });

  it('returns Permanence for non-Verra (default) S-5', () => {
    expect(sectionTitle('S-5')).toBe('Permanence');
  });

  it('returns Permanence for non-VM methodCode S-5', () => {
    expect(sectionTitle('S-5', 'ACM0001')).toBe('Permanence');
  });

  it('returns Permanence for Verra non-AFOLU S-5', () => {
    // VM prefix triggers Verra AFOLU path — this is the current heuristic
    expect(sectionTitle('S-5', 'VM0047')).toBe('Quantification');
  });

  it('returns S-6 as Permanence for Verra AFOLU', () => {
    expect(sectionTitle('S-6', 'VM0007')).toBe('Permanence');
  });

  it('returns unknown sectionId as-is', () => {
    expect(sectionTitle('S-99', 'VM0007')).toBe('S-99');
  });
});
