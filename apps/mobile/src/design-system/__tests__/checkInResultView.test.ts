import { checkInResultView } from '..';
import { formatTime } from '../../lib/dates';

describe('checkInResultView', () => {
  it('fresh check-in: title, tone and welcome detail live in Status.tsx', () => {
    const v = checkInResultView({ result: 'checked_in', checked_in_at: '2026-12-01T07:30:00Z', holder_name: 'Ada Yılmaz' });
    expect(v).toMatchObject({ title: 'GİRİŞ ONAYLANDI', tone: 'moss', detail: 'Hoş geldin diyebilirsin.', name: 'Ada Yılmaz' });
  });
  it('repeat scan: shows the first check-in time and says nothing was recorded twice', () => {
    const at = '2026-12-01T07:30:00Z';
    const v = checkInResultView({ result: 'already_checked_in', checked_in_at: at, holder_name: null });
    expect(v).toMatchObject({ title: 'DAHA ÖNCE GİRİŞ YAPILMIŞ', tone: 'apricot', name: 'Katılımcı' });
    expect(v.detail).toBe(`İlk giriş saati: ${formatTime(at)}. Aynı kodla ikinci giriş kaydedilmedi.`);
  });
});
