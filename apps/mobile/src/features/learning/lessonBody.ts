/**
 * Lesson text is plain text: paragraphs are separated by blank lines (any mix of LF, CRLF, CR; whitespace-only lines
 * count as blank). Markdown and HTML are NOT interpreted (product decision): what an editor typed is what is shown.
 * A single line break inside a paragraph is kept.
 */
export function splitLessonBody(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*(?:\n[ \t]*)+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
