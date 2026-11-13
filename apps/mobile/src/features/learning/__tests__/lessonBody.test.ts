import { splitLessonBody } from '../lessonBody';

describe('splitLessonBody', () => {
  it('splits on blank lines', () => {
    expect(splitLessonBody('Bir.\n\nİki.\n\nÜç.')).toEqual(['Bir.', 'İki.', 'Üç.']);
  });
  it('is CRLF- and CR-safe', () => {
    expect(splitLessonBody('Bir.\r\n\r\nİki.\r\n\r\n\r\nÜç.')).toEqual(['Bir.', 'İki.', 'Üç.']);
    expect(splitLessonBody('Bir.\r\rİki.')).toEqual(['Bir.', 'İki.']);
  });
  it('collapses several blank lines and whitespace-only lines, trims, drops empties', () => {
    expect(splitLessonBody('\n\n  Bir.  \n \t \n\n\n\nİki.\n\n')).toEqual(['Bir.', 'İki.']);
  });
  it('keeps a single line break inside a paragraph', () => {
    expect(splitLessonBody('Satır bir\nSatır iki\n\nSon')).toEqual(['Satır bir\nSatır iki', 'Son']);
  });
  it('does not interpret markdown or HTML: the text stays as written', () => {
    expect(splitLessonBody('# Başlık\n\n**kalın** <b>x</b> [bağlantı](https://example.com)')).toEqual(['# Başlık', '**kalın** <b>x</b> [bağlantı](https://example.com)']);
  });
  it('empty or blank body gives no paragraphs', () => {
    expect(splitLessonBody('')).toEqual([]);
    expect(splitLessonBody(' \n\r\n ')).toEqual([]);
  });
});
