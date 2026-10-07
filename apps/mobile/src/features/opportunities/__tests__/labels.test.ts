import { formatSharedValue, opportunityIneligibility } from '../labels';

describe('formatSharedValue', () => {
  it('shows Turkish labels instead of raw enums', () => {
    expect(formatSharedValue('education_stage', 'high_school')).toBe('Lise');
    expect(formatSharedValue('education_stage', 'university')).toBe('Üniversite');
  });
  it('lists experiences by title and never dumps objects', () => {
    expect(formatSharedValue('experiences', [{ title: 'Robot projesi', id: 'x' }, { title: 'Hackathon' }])).toBe('Robot projesi, Hackathon');
    expect(formatSharedValue('city', { nested: true })).toBe('—');
  });
  it('shows a dash for empty values', () => {
    for (const v of [null, undefined, '', []]) expect(formatSharedValue('city', v)).toBe('—');
  });
});

describe('opportunityIneligibility (UX hint; the server decides)', () => {
  const o = (min_age: number | null, max_age: number | null, guardian_required_under: number | null) => ({ min_age, max_age, guardian_required_under });
  it('warns a minor about adults-only opportunities', () => {
    expect(opportunityIneligibility(o(18, null, null), true)).toMatch(/18 yaş/);
    expect(opportunityIneligibility(o(null, null, 18), true)).toMatch(/18 yaş/); // guardian consent is not available for applications yet
  });
  it('warns an adult about under-18 opportunities', () => {
    expect(opportunityIneligibility(o(null, 17, null), false)).toMatch(/18 yaş altı/);
  });
  it('stays silent when unsure', () => {
    expect(opportunityIneligibility(o(15, null, null), true)).toBeNull(); // a minor may be 15+
    expect(opportunityIneligibility(o(18, null, 18), null)).toBeNull(); // signed out / unknown
    expect(opportunityIneligibility(o(null, null, null), true)).toBeNull();
  });
});
