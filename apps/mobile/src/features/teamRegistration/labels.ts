import type { RosterProblem } from './logic';

/** Team size window as the event states it, e.g. "2–4 kişi", "en az 2 kişi". */
export function teamSizeLabel(min: number, max: number | null): string {
  if (max === null) return `en az ${min} kişi`;
  return min === max ? `${min} kişi` : `${min}–${max} kişi`;
}

export const ROSTER_PROBLEM_TITLE = 'Kadro etkinliğin istediği büyüklükte değil';

export function rosterProblemLabel(problem: RosterProblem, min: number, max: number | null): string {
  return problem === 'too_few' ? `En az ${min} kişi seçmelisin.` : `En fazla ${max ?? 0} kişi seçebilirsin.`;
}

/** Hold sentence: the date itself comes from the server (hold_expires_at). */
export const holdLabel = (formattedDate: string): string => `${formattedDate} tarihine kadar tamamlanmalı`;

export const TEAM_STATUS_HEADLINE = {
  pending_members: { title: 'Üyelerin yanıtı bekleniyor.', body: 'Kadrodaki herkes katılımını onayladığında takımın hazır olur. Süre dolmadan tamamlanması gerekiyor.' },
  pending_review: { title: 'Takımın değerlendirmede.', body: 'Üyelerin hazır. Düzenleyen ekip takımları inceliyor; sonucu burada göreceksin.' },
  confirmed: { title: 'Takımın hazır.', body: 'Takım kaydın onaylandı. Üyelerin katılım kartları etkinlik gününe hazır.' },
  waitlisted: { title: 'Takımın bekleme listesinde.', body: 'Takım yeri açıldığında sıradaki takım otomatik olarak kayda geçer ve haber veririz.' },
  cancelled: { title: 'Bu takım kaydı iptal edildi.', body: 'Kayıtlar açıkken takımını yeniden kaydedebilirsin.' },
  rejected: { title: 'Bu sefer olmadı.', body: 'Takımın bu etkinlik için uygun bulunmadı.' },
  expired: { title: 'Takım kaydının süresi doldu.', body: 'Kadro zamanında tamamlanmadığı için takım yeri serbest bırakıldı. Kayıtlar açıksa yeniden deneyebilirsin.' },
} as const;
