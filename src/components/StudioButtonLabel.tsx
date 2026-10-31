import { SignalGlitchGlyph } from './SignalGlitchGlyph';

interface StudioButtonLabelProps {
  children: string;
  className?: string;
}

/** Accessible text stays intact while the visual copy uses the home's glitch. */
export function StudioButtonLabel({ children, className = '' }: StudioButtonLabelProps) {
  return (
    <span className={`studio-button-label ${className}`}>
      <span className="sr-only">{children}</span>
      <SignalGlitchGlyph text={children} />
    </span>
  );
}
