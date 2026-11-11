/**
 * Worst-case content for the card family (break-ui). Dev and tests only: nothing under src/features imports this.
 * Task 3 seeds the same shapes into the local stack and renders them on the design preview route.
 */
export const WORST_CASE_MARKER = 'techapp-worst-case-fixture';

const longDescription = (() => {
  const sentence = 'Takımlar sahada üç gün boyunca otonom robotlarını sınar, jüri her turdan sonra geri bildirim verir. ';
  return sentence.repeat(Math.ceil(6000 / sentence.length)).slice(0, 6000);
})();

export const worstCase = {
  names: {
    long: 'Şehit Öğretmen Ayşe Gülşen Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik Takımı',
    singleLetter: 'A',
    unbreakable: 'Mühendislikbilimleriuygulamaları',
    emoji: '🤖 Robo Kızlar 🚀 Takımı ✨',
  },
  organization: 'Türkiye Bilimsel ve Teknolojik Araştırma Kurumu Bilim ve Toplum Destek Programları Başkanlığı',
  city: 'Kahramanmaraş · Afşin · Yüz yüze',
  counts: [0, 1, 999, 12000] as const,
  cover: {
    none: { path: null, blurhash: null },
    broken: { path: 'https://example.invalid/covers/missing-404.jpg', blurhash: null },
  },
  description: { empty: '', long: longDescription },
} as const;

/** Every title variant, for parameterised tests. */
export const worstCaseTitles = Object.values(worstCase.names);
