import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Pause, Play } from 'lucide-react';
import { ARCHITECTURE_DURATION, architecturePhase, createGlyphArchitecture, drawArchitectureFallback, prepareArchitecture } from '../engine/colosseumScene';
import type { ArchitectureAssets, ArchitectureRenderer } from '../engine/colosseumScene';
import { GlitchText } from './GlitchText';

gsap.registerPlugin(useGSAP);

interface SignalHeroProps {
  onOpenStudio: () => void;
  playing: boolean;
  onToggleMotion: () => void;
}

export function SignalHero({ onOpenStudio, playing, onToggleMotion }: SignalHeroProps) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fallback = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ time: 0 });
  const playingRef = useRef(playing);
  const syncPlayback = useRef<() => void>(() => {});

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.signal-title-line > span', { x: -24, skewX: -6, opacity: 0.7, duration: 0.48, stagger: 0.07, ease: 'steps(4)', clearProps: 'transform,opacity' });
    }, root);
    return () => mm.revert();
  }, { scope: root });

  useEffect(() => {
    const surface = canvas.current;
    const section = root.current;
    if (!surface || !section) return;
    clock.current.time = playingRef.current ? 0 : 2.4;
    let renderer: ArchitectureRenderer | null = null;
    let plates: ArchitectureAssets | null = null;
    let disposed = false;
    const fallbackCanvas = fallback.current;
    const ctx = fallbackCanvas?.getContext('2d');
    const draw = () => {
      const time = clock.current.time;
      const phase = architecturePhase(time);
      if (surface.dataset.signalPhase !== phase) surface.dataset.signalPhase = phase;
      renderer?.draw(time);
      if (!renderer && plates && ctx && fallbackCanvas) drawArchitectureFallback(ctx, plates, time);
    };
    const resize = () => {
      const bounds = surface.parentElement!.getBoundingClientRect();
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1.25), 1.5);
      const budget = Math.min(1, Math.sqrt(2200000 / (bounds.width * bounds.height * ratio * ratio)));
      const width = Math.max(1, bounds.width * ratio * budget);
      const height = Math.max(1, bounds.height * ratio * budget);
      renderer?.resize(width, height, width / bounds.width);
      if (fallbackCanvas) { fallbackCanvas.width = width; fallbackCanvas.height = height; }
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface.parentElement!);
    let frame = 0;
    let previous = 0;
    let inView = true;
    const tick = (now: number) => {
      if (previous) clock.current.time = (clock.current.time + (now - previous) / 1000) % ARCHITECTURE_DURATION;
      previous = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (plates && playingRef.current && inView && !document.hidden) frame = requestAnimationFrame(tick);
    };
    syncPlayback.current = sync;
    const intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.05 });
    intersection.observe(section);
    document.addEventListener('visibilitychange', sync);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      renderer?.dispose();
      renderer = null;
      surface.dataset.signalRenderer = 'canvas';
      surface.hidden = true;
      if (fallbackCanvas) fallbackCanvas.hidden = false;
      draw();
    };
    surface.addEventListener('webglcontextlost', onContextLost);
    prepareArchitecture().then(result => {
      if (disposed) return;
      plates = result;
      renderer = createGlyphArchitecture(surface, plates);
      surface.dataset.signalRenderer = renderer ? 'webgl' : 'canvas';
      surface.hidden = !renderer;
      if (fallbackCanvas) fallbackCanvas.hidden = !!renderer;
      resize(); sync();
    }).catch(() => { if (!disposed) surface.dataset.signalRenderer = 'unavailable'; });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      surface.removeEventListener('webglcontextlost', onContextLost);
      document.removeEventListener('visibilitychange', sync);
      renderer?.dispose();
      syncPlayback.current = () => {};
    };
  }, []);

  useEffect(() => {
    playingRef.current = playing;
    syncPlayback.current();
  }, [playing]);

  return <section className="signal-hero" ref={root} aria-labelledby="signal-title">
    <div className="signal-art" role="img" aria-label="A rotating 3D Colosseum transforms into ASCII, dither and Braille with broken signal cuts. Its upper storeys lift and settle above a connected foundation, arena and lower arcade.">
      <canvas ref={canvas} aria-hidden="true" />
      <canvas ref={fallback} aria-hidden="true" hidden />
    </div>
    <div className="signal-hero-copy">
      <h1 id="signal-title" aria-label="Corrupt the ordinary.">
        <span className="signal-title-line"><GlitchText text="CORRUPT" offset={0} /></span>
        <span className="signal-title-line"><GlitchText text="THE" offset={1.3} /></span>
        <span className="signal-title-line"><GlitchText text="ORDINARY." offset={3.1} /></span>
      </h1>
      <p className="signal-hero-description">Your photos. Rewired.<br />ASCII, broken signals and strange new textures.<br className="desktop-break" /> An image studio for going off script.</p>
      <button type="button" className="signal-hero-action" onClick={onOpenStudio}><span>OPEN STUDIO</span><ArrowUpRight size={22} /></button>
    </div>
    <button type="button" className="signal-motion-toggle" aria-label={playing ? 'Pause animations' : 'Play animations'} title={playing ? 'Pause animations' : 'Play animations'} onClick={onToggleMotion}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
  </section>;
}
