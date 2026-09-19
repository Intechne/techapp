import { isHttpsUrl } from '../links';

describe('isHttpsUrl', () => {
  it('accepts real https addresses', () => {
    expect(isHttpsUrl('https://techapp.intechne.com.tr/x')).toBe(true);
    expect(isHttpsUrl('  https://a.co  ')).toBe(true);
  });
  it('rejects every scheme the OS could act on, and junk', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'http://a.co', 'file:///etc', 'tel:123', 'https://nodot', '', null, undefined]) {
      expect(isHttpsUrl(v)).toBe(false);
    }
  });
});
