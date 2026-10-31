import type { CSSProperties } from 'react';

/** Only a few characters break; the complete accessible label stays on the heading. */
export function GlitchText({ text, offset = 0, revealCharacters = false, glitchAt, cycle }: { text: string; offset?: number; revealCharacters?: boolean; glitchAt?: number[]; cycle?: number }) {
  const positions = new Set(glitchAt ?? (text.length < 5 ? [1] : [2, text.length - 2]));
  return <span className="signal-glitch-word" aria-hidden="true">{[...text].map((character, index) => {
    const glyph = positions.has(index) && character !== ' '
      ? <span key={index} className="signal-crt-character" data-character={character} style={{
        '--glitch-delay': `${-(offset + index * 0.71)}s`,
        '--glitch-cycle': `${cycle ?? 7.6 + offset * 0.4}s`,
      } as CSSProperties}>{character}</span>
      : character;
    return revealCharacters ? <span key={index} className="signal-reveal-character">{glyph}</span> : glyph;
  })}</span>;
}
