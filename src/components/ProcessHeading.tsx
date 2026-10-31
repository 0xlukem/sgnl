import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { GlitchText } from './GlitchText';

const FLOW_CELLS = [
  ['▚', 5, 1], ['▚', 6, 2], ['▐', 7, 3], ['▞', 6, 4], ['▞', 5, 5],
  ['░', 1, 3], ['▒', 2, 3], ['▓', 4, 3], ['█', 5, 3],
] as const;

function SignalFlowGlyph({ offset = 0 }: { offset?: number }) {
  return <span className="signal-flow-glyph" aria-hidden="true">{FLOW_CELLS.map(([glyph, column, row], index) =>
    <span key={index} className="signal-reveal-character signal-flow-cell" style={{ gridColumn: column, gridRow: row }}><GlitchText text={glyph} offset={offset + index * .2} glitchAt={index === 1 || index === 7 ? [0] : []} cycle={4.2} /></span>
  )}</span>;
}

/** One heading: the treatment changes inside a fixed-width slot, keeping the sentence on one line. */
export function ProcessHeading({ motionEnabled }: { motionEnabled: boolean }) {
  const root = useRef<HTMLElement>(null);
  useGSAP((_, contextSafe) => {
    const section = root.current;
    if (!section || !motionEnabled || !contextSafe || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const characters = section.querySelectorAll('.signal-reveal-character');
    const modes = section.querySelectorAll('.signal-process-mode > span');
    let entrance: gsap.core.Timeline | undefined;
    let cycle: gsap.core.Timeline | undefined;
    let started = false;
    let inView = false;
    section.dataset.processReveal = 'waiting';
    gsap.set(characters, { opacity: 0 });
    const syncPlayback = () => {
      const active = inView && !document.hidden;
      section.dataset.processActive = String(active);
      if (!started) return;
      if (entrance && entrance.progress() < 1) active ? entrance.resume() : entrance.pause();
      else if (cycle) active ? cycle.resume() : cycle.pause();
    };
    const reveal = contextSafe(() => {
      section.dataset.processReveal = 'running';
      section.dataset.processTreatment = 'ascii';
      const characterReveal = { opacity: 1, duration: .14, stagger: .065, ease: 'none', clearProps: 'opacity' };
      cycle = gsap.timeline({ repeat: -1, paused: true });
      cycle.set(modes, { autoAlpha: 0, immediateRender: false }, 0)
        .set(modes[0], { autoAlpha: 1, immediateRender: false }, 0)
        .set(modes[0].querySelectorAll('.signal-reveal-character'), { opacity: 1, immediateRender: false }, 0);
      // Include GLITCH -> ASCII in the repeating sequence, with one shared switch event.
      for (const index of [1, 2, 0]) {
        const at = cycle.duration() + 1.75;
        cycle.call(() => {
          section.dataset.processTreatment = modes[index].getAttribute('data-treatment') ?? '';
          section.dataset.processSwitch = 'on';
        }, [], at)
          .set(modes, { autoAlpha: 0 }, at)
          .set(modes[index], { autoAlpha: 1 }, at)
          .set(modes[index].querySelectorAll('.signal-reveal-character'), { opacity: 0 }, at)
          .to(modes[index].querySelectorAll('.signal-reveal-character'), { ...characterReveal, duration: .1, stagger: .06 }, at)
          .call(() => { delete section.dataset.processSwitch; }, [], at + .48);
      }
      entrance = gsap.timeline({ onComplete: () => {
        section.dataset.processReveal = 'looping';
        syncPlayback();
      } });
      entrance.to(section.querySelectorAll('.signal-process-in .signal-reveal-character'), characterReveal)
        .to(section.querySelectorAll('.signal-process-arrow-in .signal-reveal-character'), { ...characterReveal, stagger: .04 }, '-=.08')
        .to(modes[0].querySelectorAll('.signal-reveal-character'), characterReveal, '-=.10')
        .to(section.querySelectorAll('.signal-process-arrow-out .signal-reveal-character'), { ...characterReveal, stagger: .04 }, '-=.08')
        .to(section.querySelectorAll('.signal-process-out .signal-reveal-character'), characterReveal, '-=.10');
    });
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!started && inView && entry.intersectionRatio >= .7) {
        started = true;
        reveal();
      }
      syncPlayback();
    }, { root: section.closest('.signal-home'), threshold: [0, .7], rootMargin: '0px 0px -40px 0px' });
    observer.observe(section);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      delete section.dataset.processReveal;
      delete section.dataset.processTreatment;
      delete section.dataset.processSwitch;
      delete section.dataset.processActive;
    };
  }, { scope: root, dependencies: [motionEnabled], revertOnUpdate: true });

  return <section ref={root} className="signal-process" aria-labelledby="signal-process-title">
    <h2 id="signal-process-title" aria-label="Image in to ASCII, dither and glitch to art out">
      <span className="signal-process-in"><GlitchText text="IMAGE IN" revealCharacters glitchAt={[2]} cycle={4.2} /></span>
      <span className="signal-process-arrow signal-process-arrow-in"><SignalFlowGlyph /></span>
      <span className="signal-process-mode">
        {['ASCII', 'DITHER', 'GLITCH'].map((mode, index) => <span key={mode} data-treatment={mode.toLowerCase()}><GlitchText text={mode} offset={index + .4} revealCharacters glitchAt={[1]} cycle={3.8} /></span>)}
      </span>
      <span className="signal-process-arrow signal-process-arrow-out"><SignalFlowGlyph offset={1.4} /></span>
      <span className="signal-process-out"><GlitchText text="ART OUT" offset={1.8} revealCharacters glitchAt={[4]} cycle={4.6} /></span>
    </h2>
  </section>;
}
