/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import { groupMethodsByRegistry } from '@/components/projects/NewProjectForm';

type MethodOption = {
  code: string;
  program: string;
  version: string;
  ruleCount: number;
};

function method(partial: Partial<MethodOption>): MethodOption {
  return {
    code: partial.code ?? 'UNKNOWN',
    program: partial.program ?? 'UNFCCC/Forestry',
    version: partial.version ?? 'v01-0',
    ruleCount: partial.ruleCount ?? 10,
  };
}

describe('groupMethodsByRegistry', () => {
  it('groups UNFCCC methods under UNFCCC', () => {
    const methods = [
      method({ code: 'AR-ACM0003', program: 'UNFCCC/Forestry' }),
      method({ code: 'AM0001', program: 'UNFCCC/Energy' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].registry).toBe('UNFCCC');
    expect(groups[0].methods).toHaveLength(2);
  });

  it('groups Verra methods under Verra', () => {
    const methods = [
      method({ code: 'VM0007', program: 'Verra/Forestry' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].registry).toBe('Verra');
  });

  it('groups Gold Standard methods under Gold Standard', () => {
    const methods = [
      method({ code: 'GS-VER1', program: 'Gold Standard/Energy' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].registry).toBe('Gold Standard');
  });

  it('groups GoldStandard (no space) methods under Gold Standard', () => {
    const methods = [
      method({ code: 'GS-VER1', program: 'GoldStandard/Energy' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].registry).toBe('Gold Standard');
  });

  it('places UNFCCC first, then Verra, then Gold Standard, then Unknown', () => {
    const methods = [
      method({ code: 'GS-VER1', program: 'Gold Standard/Energy' }),
      method({ code: 'UNKNOWN', program: 'SomeRegistry/Other' }),
      method({ code: 'VM0007', program: 'Verra/Forestry' }),
      method({ code: 'AR-ACM0003', program: 'UNFCCC/Forestry' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(4);
    expect(groups[0].registry).toBe('UNFCCC');
    expect(groups[1].registry).toBe('Verra');
    expect(groups[2].registry).toBe('Gold Standard');
    expect(groups[3].registry).toBe('Unknown');
  });

  it('sorts methods alphabetically by code within each group', () => {
    const methods = [
      method({ code: 'VM0042', program: 'Verra/Forestry' }),
      method({ code: 'VM0007', program: 'Verra/Forestry' }),
      method({ code: 'VMR001', program: 'Verra/Forestry' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].methods.map((m) => m.code)).toEqual(['VM0007', 'VM0042', 'VMR001']);
  });

  it('returns empty array for no methods', () => {
    expect(groupMethodsByRegistry([])).toEqual([]);
  });

  it('handles Unknown program gracefully', () => {
    const methods = [
      method({ code: 'FOO', program: 'Unknown' }),
    ];
    const groups = groupMethodsByRegistry(methods);
    expect(groups).toHaveLength(1);
    expect(groups[0].registry).toBe('Unknown');
  });
});
