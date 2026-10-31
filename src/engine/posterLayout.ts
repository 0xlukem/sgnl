/** Wrap both normal prose and unbroken ASCII strings; explicit line breaks are preserved. */
export function wrapPosterLines(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  if (!text.trim()) return [];
  const result: string[] = [];
  for (const paragraph of text.trim().split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line} ${word}`) <= maxWidth) {
        line += ` ${word}`;
        continue;
      }
      if (line) result.push(line);
      line = '';
      for (const char of Array.from(word)) {
        if (line && measure(line + char) > maxWidth) {
          result.push(line);
          line = '';
        }
        line += char;
      }
    }
    result.push(line);
  }
  return result;
}
