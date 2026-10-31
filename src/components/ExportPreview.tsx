import { useEffect, useRef } from 'react';
import type { StudioState } from '../engine/types';
import { renderStudioFrame } from '../engine/renderer';
import { waitForRenderFonts } from '../engine/renderFonts';

export interface ExportSnapshot {
  state: StudioState;
  intent: 'image' | 'animate';
  time: number;
}

/** The preview deliberately excludes Solo, selection, cursor and comparison tools. */
export function ExportPreview({image,snapshot}:{image:HTMLImageElement|null;snapshot:ExportSnapshot|null}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let cancelled=false;
    const draw=()=>{
      if(cancelled || !image || !snapshot || !ref.current)return;
      const canvas=ref.current;
      const factor=Math.min(1,400/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
      const ctx=canvas.getContext('2d');
      if(ctx)renderStudioFrame(ctx,image,snapshot.state,{
        intent:snapshot.intent,time:snapshot.time,scale:canvas.width/1000,
        animationEnabled:snapshot.state.animation?.enabled,
        playbackSpeed:snapshot.state.animation?.playbackSpeed ?? 1,
      });
    };
    if(snapshot) void waitForRenderFonts(snapshot.state).then(draw,draw);
    return()=>{cancelled=true;};
  },[image,snapshot]);
  return image && snapshot ? <figure className="studio-export-preview">
    <canvas ref={ref} aria-label="Composition that will be exported" />
    <figcaption>{snapshot.intent==='image'?'Static composition':`Animation frame · ${snapshot.time.toFixed(2)} s`} · saved layer visibility · no view tools</figcaption>
  </figure> : null;
}
