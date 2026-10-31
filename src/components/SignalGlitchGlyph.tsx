import './signal-glitch.css';

/** The same sliced glyph used by the home engine buttons and studio controls. */
export function SignalGlitchGlyph({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`signal-glitch-glyph ${className}`} data-glyph={text} aria-hidden="true">{text}</span>;
}
