import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import type { CanvasCompositionMode, GlyphFamily, Recipe, StyleGroup } from '../engine/types';
import { GLYPH_RAMPS } from '../engine/types';
import { BUILTIN_RECIPES } from '../engine/recipes';
import { drawSignalSource } from '../engine/signalEntity';
import { renderStudioFrame } from '../engine/renderer';
import { SignalHero } from './SignalHero';
import { GlitchText } from './GlitchText';
import { SignalGlitchGlyph } from './SignalGlitchGlyph';
import { ProcessHeading } from './ProcessHeading';
import './home.css';

interface HomeViewProps {
  onOpenEditorWithMode: (mode: CanvasCompositionMode) => void;
  onOpenEditorWithStyle: (glyphFamily: GlyphFamily) => void;
  onOpenRecipes: () => void;
  onOpenEditorWithRecipe: (recipe: Recipe, source?: HTMLImageElement) => void;
}

const ENGINES = Object.entries(GLYPH_RAMPS) as [GlyphFamily, (typeof GLYPH_RAMPS)[GlyphFamily]][];
const CATEGORIES: { group: StyleGroup; title: string }[] = [
  { group: 'Glyphs', title: 'ASCII / Glyphs' }, { group: 'Dither', title: 'Dither' },
  { group: 'Tiles & Halftone', title: 'Halftone / Tiles' }, { group: 'Print & Etch', title: 'Print / Etch' },
];
const STUDIES = [
  { recipe: 'full-terminal-override', title: 'RECODE EVERY PIXEL.', description: 'Reconstruct an image in ASCII, dots or print. A different material, all the way through.', label: '01 / FULL FRAME', variant: 0 },
  { recipe: 'scattered-signal', title: 'BREAK THE FRAME.', description: 'Keep the source. Cut into it with graphic layers, displaced fragments and broken signals.', label: '02 / PHOTO + LAYERS', variant: 1 },
  { recipe: 'hybrid-etch-braille-core', title: 'MAKE WORLDS COLLIDE.', description: 'Fine dither underneath. Braille glyphs on top. Stack different treatments into something harder to define.', label: '03 / HYBRID COMPOSITION', variant: 2 },
];

function RecipeStudy({ study, onOpen, motionEnabled }: { study: typeof STUDIES[number]; onOpen: HomeViewProps['onOpenEditorWithRecipe']; motionEnabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const replay = useRef<() => void>(() => {});
  const recipe = BUILTIN_RECIPES.find(item => item.id === study.recipe) ?? BUILTIN_RECIPES[0];
  useEffect(() => {
    const surface = canvas.current;
    const target = button.current;
    const ctx = surface?.getContext('2d');
    if (!surface || !ctx || !target) return;
    let frame = 0;
    let visible = false;
    let disposed = false;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    const original = document.createElement('canvas');
    original.width = 900; original.height = 760;
    drawSignalSource(original.getContext('2d')!, 900, 760, study.variant, 2.3);
    surface.width = 520; surface.height = 440;
    const paint = (time: number, original = 0) => renderStudioFrame(ctx, image, recipe.state, {
      time, scale: 0.52, showOriginalOnly: original === 1, splitWipeX: original > 0 && original < 1 ? original : null,
    });
    const animate = () => {
      cancelAnimationFrame(frame);
      if (!source.current) return;
      if (!motionEnabled || preference.matches || document.hidden || !visible) { paint(2.3); return; }
      const start = performance.now();
      let previous = 0;
      const tick = (now: number) => {
        if (disposed || !visible || document.hidden) return;
        if (now - previous > 1000 / 15) {
          const seconds = (now - start) / 1000;
          const reveal = Math.max(0, Math.min(1, (seconds - 0.25) / 2.1));
          const eased = reveal < 0.5 ? 4 * reveal ** 3 : 1 - (-2 * reveal + 2) ** 3 / 2;
          paint(2.3 + seconds, 1 - eased);
          previous = now;
        }
        if (now - start < 4000) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    replay.current = animate;
    image.onload = () => { if (disposed) return; source.current = image; paint(2.3); if (visible) animate(); };
    image.src = original.toDataURL('image/png');
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !visible) { visible = true; animate(); }
      else if (!entry.isIntersecting) { visible = false; cancelAnimationFrame(frame); }
    }, { threshold: 0.18 });
    observer.observe(target);
    const stop = () => { cancelAnimationFrame(frame); if (source.current) paint(2.3); };
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    preference.addEventListener('change', stop);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); preference.removeEventListener('change', stop); };
  }, [recipe, study.variant, motionEnabled]);
  return <button ref={button} type="button" className={`signal-study signal-study-${study.variant}`} onPointerEnter={() => replay.current()} onFocus={() => replay.current()} onClick={() => onOpen(recipe, source.current ?? undefined)}>
    <div className="signal-study-image"><canvas ref={canvas} role="img" aria-label={`${recipe.name} applied to an abstract ${['woven sculpture', 'brutalist structure', 'topographic membrane'][study.variant]}`} /><span className="signal-study-index" aria-hidden="true">0{study.variant + 1}</span><span className="signal-study-open">OPEN RECIPE <ArrowUpRight size={15} /></span></div>
    <div className="signal-study-copy"><span>{study.label}</span><h3>{study.title}<ArrowUpRight size={22} /></h3><p>{study.description}</p></div>
  </button>;
}

export function HomeView({ onOpenEditorWithMode, onOpenEditorWithStyle, onOpenRecipes, onOpenEditorWithRecipe }: HomeViewProps) {
  const root = useRef<HTMLElement>(null);
  const [group, setGroup] = useState<StyleGroup>('Glyphs');
  const [motionEnabled, setMotionEnabled] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => { if (preference.matches) setMotionEnabled(false); };
    preference.addEventListener('change', onChange);
    return () => preference.removeEventListener('change', onChange);
  }, []);
  useGSAP((_, contextSafe) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!motionEnabled || reduced.matches || !contextSafe) return;
    const reveal = contextSafe((element: Element) => {
      return gsap.fromTo(element, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.inOut', clearProps: 'clipPath' });
    });
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target.matches('.signal-closing h2')) entry.target.closest('.signal-closing')?.classList.add('is-visible');
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.10 });
    root.current?.querySelectorAll('.signal-section-title, .signal-study-image, .signal-closing h2').forEach(element => observer.observe(element));
    const onPreference = () => {
      if (!reduced.matches) return;
      observer.disconnect();
      const targets = root.current?.querySelectorAll('.signal-section-title, .signal-study-image, .signal-closing h2, .signal-reveal-character');
      if (targets) { gsap.killTweensOf(targets); gsap.set(targets, { clearProps: 'clipPath,opacity' }); }
    };
    reduced.addEventListener('change', onPreference);
    return () => { observer.disconnect(); reduced.removeEventListener('change', onPreference); };
  }, { scope: root, dependencies: [motionEnabled], revertOnUpdate: true });
  return <main ref={root} className="page-scroll custom-scrollbar signal-home" data-motion={motionEnabled ? 'on' : 'off'} aria-label="SGNL image studio">
    <SignalHero onOpenStudio={() => onOpenEditorWithMode('blocks')} playing={motionEnabled} onToggleMotion={() => setMotionEnabled(value => !value)} />
    <ProcessHeading motionEnabled={motionEnabled} />
    <section className="signal-studies" aria-labelledby="signal-studies-title">
      <div className="signal-section-intro"><h2 id="signal-studies-title" className="signal-section-title">NICE PHOTO.<br />NOW CORRUPT IT.</h2><p>Start with an image.<br />End somewhere unexpected.</p></div>
      <div className="signal-study-grid">{STUDIES.map(study => <RecipeStudy key={study.variant} study={study} onOpen={onOpenEditorWithRecipe} motionEnabled={motionEnabled} />)}</div>
    </section>
    <section className="signal-engines" aria-labelledby="signal-engines-title">
      <div className="signal-section-intro"><h2 id="signal-engines-title" className="signal-section-title">{ENGINES.length} WAYS TO<br />MISBEHAVE.</h2><div><p>Console characters. Print imperfections.<br />Textures with a mind of their own.</p><button type="button" className="signal-link" onClick={onOpenRecipes}>ALL RECIPES <ArrowUpRight size={17} /></button></div></div>
      <div className="signal-category-tabs" aria-label="Rendering engine categories">{CATEGORIES.map(category => <button type="button" key={category.group} aria-pressed={group === category.group} onClick={() => setGroup(category.group)}>{category.title}<span>{ENGINES.filter(([, style]) => style.group === category.group).length}</span></button>)}</div>
      <div className="signal-engine-list">{ENGINES.filter(([, style]) => style.group === group).map(([id, style]) => <button type="button" key={id} className="signal-engine" onClick={() => onOpenEditorWithStyle(id)}><SignalGlitchGlyph className="signal-engine-glyph" text={style.shortLabel} /><span><strong>{style.name}</strong><span>{style.description}</span></span><ArrowUpRight size={17} /></button>)}</div>
    </section>
    <section className="signal-closing"><div className="signal-closing-symbol" aria-hidden="true">[↯]</div><div className="signal-terminal-break" aria-hidden="true" /><h2 aria-label="Good images. Bad influence."><GlitchText text="GOOD IMAGES." offset={1.2} /><GlitchText text="BAD INFLUENCE." offset={3.7} /></h2><div className="signal-closing-action"><p>Bring your own pixels.<br />Make something that refuses to behave.</p><button type="button" className="signal-hero-action" onClick={() => onOpenEditorWithMode('blocks')}>OPEN STUDIO <ArrowUpRight size={22} /></button></div></section>
    <footer className="signal-footer"><span className="signal-footer-logo"><img className="brand-mark" src="/brand/sgnl-ascii-moth-72.png" srcSet="/brand/sgnl-ascii-moth-144.png 2x, /brand/sgnl-ascii-moth-216.png 3x" width="72" height="72" alt="" aria-hidden="true" />SGNL</span><span>YOUR IMAGE. YOUR RULES.</span></footer>
  </main>;
}
