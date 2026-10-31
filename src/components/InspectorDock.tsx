import React, { useEffect, useRef, useState } from 'react';
import type { AsciiRegion, BaseCanvasSettings, CanvasCompositionMode, CurvePreset, GlyphFamily, MonoFontFamily, PhosphorColor, RadialLight2D, Recipe, RegionBlendMode, SourceWarpMode, StudioState, SubstrateMode, TextOverlaySettings } from '../engine/types';
import { CHARACTER_PRESETS, DEFAULT_BASE_CANVAS, GLYPH_RAMPS, PHOSPHOR_PALETTES } from '../engine/types';
import type { LayoutPresetId } from '../engine/recipes';
import { getEngineCapabilities } from '../engine/engineCapabilities';
import { getDisabledControls } from '../engine/controlAvailability';
import { RangeControl } from './RangeControl';
import { StudioButtonLabel } from './StudioButtonLabel';
import { StudioSwitch } from './controls/StudioSwitch';
import { StudioColorPicker } from './controls/StudioColorPicker';
import { StudioSelect } from './controls/StudioSelect';
import { PaletteSwatches, PresetChoices } from './PresetChoices';
import { getPaletteColors } from '../engine/renderContext';
import { ChevronDown, RotateCcw, Shuffle } from 'lucide-react';

export interface InspectorDockProps {
  state: StudioState; selectedRegionId: string | null; previewScale?: number;
  scope?: 'selected' | 'whole';
  focusRequest?: { section: string; id: number };
  editLayerRequest?: number;
  workspace?: 'image' | 'animate'; onWorkspaceChange?: (workspace: 'image' | 'animate') => void;
  image?: HTMLImageElement | null; soloRegionId?: string | null; onSoloChange?: (id: string | null) => void;
  onSelectRegion: (id: string | null) => void;
  onUpdateState: (patch: Partial<StudioState>, recordHistory?: boolean) => void;
  onUpdateRegions: (regions: AsciiRegion[]) => void;
  onRandomizeBlocks?: () => void; onApplyLayoutPreset?: (preset: LayoutPresetId) => void;
  showOriginalOnly?: boolean; onOriginalChange?: (show: boolean) => void;
  splitCompareActive?: boolean; onSplitCompareChange?: (active: boolean) => void;
  recipes?: Recipe[]; activeRecipeId?: string | null; lockLayoutOnRecipe?: boolean;
  onToggleLockLayout?: () => void; onApplyRecipe?: (recipe: Recipe) => void;
  onSaveCustomRecipe?: (name: string, tagline: string) => void; onDeleteCustomRecipe?: (id: string) => void; onExportRecipeJson?: () => void;
}
const STYLE_CHOICES = (Object.keys(GLYPH_RAMPS) as GlyphFamily[]).map(value => {
  const ramp = GLYPH_RAMPS[value];
  return {value, label:ramp.name, preview:ramp.preview, group:ramp.group, description:ramp.description};
});
const STYLE_GROUP_LABELS = {'Glyphs':'Glyphs','Dither':'Dither','Tiles & Halftone':'Tiles','Print & Etch':'Print'};
const SUBSTRATES: {value: SubstrateMode; label: string}[] = [{value:'knockout',label:'CRT Dark'},{value:'glass',label:'Frosted Glass'},{value:'source',label:'Photo Passthrough'},{value:'duotone',label:'Duotone'},{value:'solid',label:'Solid'},{value:'gradient',label:'Gradient'},{value:'transparent',label:'Transparent'}];
const CURVES: CurvePreset[] = ['linear','s-curve','high-contrast','faded-film','crushed-blacks','solarize','inverse'];
const WARPS: SourceWarpMode[] = ['off','ripple','wave','swirl','pinch','sphere','zigzag','shear','polar','fragment'];
const PALETTES = Object.keys(PHOSPHOR_PALETTES) as PhosphorColor[];
const words = (s: string) => s.replace(/-/g,' ').replace(/^./, c => c.toUpperCase());
const DEFAULT_LIGHTS: RadialLight2D[] = [
  {id:'light-1',enabled:false,x:.25,y:.28,radius:.55,intensity:65,color:'#00FF66'},
  {id:'light-2',enabled:false,x:.75,y:.68,radius:.5,intensity:60,color:'#FF3B7F'},
  {id:'light-3',enabled:false,x:.5,y:.2,radius:.45,intensity:50,color:'#38BDF8'},
];
const TEXT_DEFAULT: TextOverlaySettings = {enabled:false,text:'SGNL // 2026',subtext:'OPTICAL SYNTHESIS LAB',x:.5,y:.86,size:54,color:'#F4F4EC',layerOrder:'front',fontStyle:'editorial-mono'};

function Group({title,scope,active,initialOpen=false,section,focusRequest,children}: {title:string;scope?:string;active?:string;initialOpen?:boolean;section?:string;focusRequest?:InspectorDockProps['focusRequest'];children:React.ReactNode}) {
  const [open,setOpen] = useState(initialOpen);
  const groupRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const focusId = focusRequest?.id;
  const focusSection = focusRequest?.section;
  useEffect(()=>{
    if(!section || focusSection!==section || focusId===undefined)return;
    setOpen(true);
    const frame=requestAnimationFrame(()=>{
      const group = groupRef.current;
      const scroller = group?.closest<HTMLElement>('.inspector-content');
      if (group && scroller) {
        const top = group.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({top, behavior:'instant'});
      }
      summaryRef.current?.focus({preventScroll:true});
    });
    return ()=>cancelAnimationFrame(frame);
  },[focusId,focusSection,section]);
  return <details ref={groupRef} data-inspector-section={section} className="inspector-group" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary ref={summaryRef}><span><span className="inspector-heading"><StudioButtonLabel>{title}</StudioButtonLabel></span>{scope && <small>{scope}</small>}</span><span className="inspector-group-status">{active}<ChevronDown size={15} /></span></summary><div className="inspector-group-content">{children}</div></details>;
}
function Toggle({label,checked,onChange,description}: {label:string;checked:boolean;onChange:(value:boolean)=>void;description?:string}) {
  return <div className="inspector-toggle-row"><span><span>{label}</span>{description && <small>{description}</small>}</span><StudioSwitch label={label} checked={checked} onCheckedChange={onChange}/></div>;
}
function Choices<T extends string>({label,values,value,onChange,disabledOptions=[]}: {label:string;values:T[];value:T;onChange:(value:T)=>void;disabledOptions?:T[]}) {
  return <div className="studio-choice-grid" role="group" aria-label={label}>{values.map(option => <button type="button" key={option} aria-pressed={value===option} disabled={disabledOptions.includes(option)} onClick={()=>onChange(option)}><StudioButtonLabel>{words(option)}</StudioButtonLabel></button>)}</div>;
}

export const InspectorDock: React.FC<InspectorDockProps> = ({state,selectedRegionId,previewScale,scope='selected',focusRequest,onSoloChange,onSelectRegion,onUpdateState,onUpdateRegions,onRandomizeBlocks,onApplyLayoutPreset}) => {
  const [textMode,setTextMode] = useState<'ramp'|'repeat'|null>(null);
  const [fontStatus,setFontStatus] = useState('');
  const [activePreset,setActivePreset] = useState<'style'|'palette'|null>(null);
  const fontsReady=useRef<Promise<void>>(Promise.resolve());
  const fontRequest=useRef(0);
  useEffect(()=>()=>{fontRequest.current += 1;},[]);
  const current=useRef({state,selectedRegionId}); current.current={state,selectedRegionId};
  const base: BaseCanvasSettings = {...DEFAULT_BASE_CANVAS,...state.baseCanvas};
  const selected = state.regions.find(r=>r.id===selectedRegionId) ?? null;
  const source = selected ?? base;
  const target = selected ? 'layer' : 'base';
  const caps = getEngineCapabilities(source.glyphFamily,source.color);
  const disabled = getDisabledControls({state,baseCanvas:base,source,target,selectedRegion:selected,previewScale});
  const invisible = selected ? base.mode==='full' || selected.hidden : base.mode==='blocks';
  const targetName = selected?.label ?? 'Base';
  const actualTextMode = textMode ?? (source.wordmarkText?.trim() ? 'repeat' : 'ramp');
  useEffect(()=>setTextMode(null),[selectedRegionId]);
  useEffect(()=>{
    let link=document.getElementById('studio-glyph-fonts') as HTMLLinkElement | null;
    if (!link) {
      link=document.createElement('link');link.id='studio-glyph-fonts';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Fira+Code:wght@600&family=Space+Mono:wght@400;700&display=swap';
      const sheet=link;
      fontsReady.current=new Promise<void>((resolve,reject)=>{sheet.onload=()=>resolve();sheet.onerror=()=>reject(new Error('Font stylesheet unavailable'));});
      void fontsReady.current.catch(()=>{});
      document.head.appendChild(link);
    } else if (!link.sheet) {
      const sheet=link;
      fontsReady.current=new Promise<void>((resolve,reject)=>{sheet.addEventListener('load',()=>resolve(),{once:true});sheet.addEventListener('error',()=>reject(new Error('Font stylesheet unavailable')),{once:true});});
      void fontsReady.current.catch(()=>{});
    }
  },[]);
  const setBase = (patch: Partial<BaseCanvasSettings>)=>onUpdateState({baseCanvas:{...base,...patch}});
  const setSource = (patch: Partial<AsciiRegion> & Partial<BaseCanvasSettings>)=> {
    if (invisible) return;
    if (selected) onUpdateRegions(state.regions.map(r=>r.id===selected.id?{...r,...patch}:r));
    else setBase(patch);
  };
  const setGrading = (patch: Partial<StudioState['grading']>)=>onUpdateState({grading:{...state.grading,...patch}});
  const setCrt = (patch: Partial<StudioState['crt']>)=>onUpdateState({crt:{...state.crt,...patch}});
  const setTracking = (patch: Partial<StudioState['tracking']>)=>onUpdateState({tracking:{...state.tracking,...patch}});
  const setGlitch = (patch: Partial<StudioState['glitch']>)=>onUpdateState({glitch:{...state.glitch,...patch}});
  const lights = DEFAULT_LIGHTS.map((fallback,i)=>state.crt.lights?.[i] ?? fallback);
  const setLight = (idx:number,patch:Partial<RadialLight2D>)=>setCrt({lights:lights.map((l,i)=>i===idx?{...l,...patch}:l)});
  const text = {...TEXT_DEFAULT,...state.crt.textOverlay};
  const setText = (patch:Partial<TextOverlaySettings>)=>setCrt({textOverlay:{...text,...patch}});
  const range = (id:string,label:string,value:number,min:number,max:number,onChange:(v:number)=>void,unit='%',dial=false)=> <RangeControl key={id} id={id} label={label} value={value} min={min} max={max} unit={unit} variant={dial?'dial':'fader'} disabledReason={disabled[id]} onChange={onChange}/>;
  const chooseFont = async (font:MonoFontFamily)=>{
    const requestedTarget=selectedRegionId;
    const request=++fontRequest.current;
    setFontStatus(`Loading ${font}…`);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          if(font!=='JetBrains Mono') await fontsReady.current;
          await document.fonts.load(`600 16px "${font}"`);
        })(),
        new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Font loading timed out')),5000);}),
      ]);
      if(request!==fontRequest.current)return;
      const latest=current.current;
      if(latest.selectedRegionId!==requestedTarget) {setFontStatus('');return;}
      const layer=latest.state.regions.find(r=>r.id===requestedTarget);
      if(layer) {
        if(!layer.hidden && latest.state.baseCanvas?.mode!=='full') onUpdateState({regions:latest.state.regions.map(r=>r.id===layer.id?{...r,fontFamily:font}:r)});
      } else if(latest.state.baseCanvas?.mode!=='blocks') onUpdateState({baseCanvas:{...DEFAULT_BASE_CANVAS,...latest.state.baseCanvas,fontFamily:font}});
      setFontStatus('');
    } catch {if(request===fontRequest.current)setFontStatus('Font unavailable. Try another font.');}
    finally {if(deadline)clearTimeout(deadline);}
  };
  const applyStyle = ()=>{const keys=['cellSize','glyphFamily','color','customColorHex','secondaryColorHex','paletteModified','knockoutOpacity','contrast','substrateMode','invert','customChars','wordmarkText','fontFamily','tileGap','tileRoundness','printAngle','printWeight','printRoughness','printRegistration'] as const;const patch=Object.fromEntries(keys.map(k=>[k,source[k]]));onUpdateRegions(state.regions.map(r=>({...r,...patch})));};
  const applyPalette = ()=>onUpdateRegions(state.regions.map(r=>({...r,color:source.color,customColorHex:source.customColorHex,secondaryColorHex:source.secondaryColorHex,paletteModified:source.paletteModified})));
  const curveChanged = [(state.grading.curvePreset??'linear')!=='linear',state.grading.brightness??0,(state.grading.contrast??100)-100,(state.grading.saturation??100)-100,state.grading.blackPoint,100-state.grading.whitePoint,state.grading.gamma-1,state.grading.shadows??0,state.grading.highlights??0,state.grading.edgeBoost,state.grading.sharpen??0,state.grading.denoise??0].filter(Boolean).length;
  const crtChanged = ['phosphorGlow','wholeBloom','prismAberration','scanlines','apertureMask','barrelCurve','vignette'].filter(k=>(state.crt[k as keyof StudioState['crt']] as number??0)>0).length;
  const anyGlass = (base.mode!=='blocks'&&base.substrateMode==='glass') || (base.mode!=='full'&&state.regions.some(r=>!r.hidden&&r.substrateMode==='glass'));
  const anyGradient = base.substrateMode==='gradient'||state.regions.some(r=>r.substrateMode==='gradient');
  const hasGlyph = (base.mode!=='blocks'&&GLYPH_RAMPS[base.glyphFamily].group==='Glyphs') || (base.mode!=='full'&&state.regions.some(r=>!r.hidden&&GLYPH_RAMPS[r.glyphFamily].group==='Glyphs'));
  const palette=PHOSPHOR_PALETTES[source.color];
  const paletteSwatches = (value:PhosphorColor,modified=false) => {
    const preset=PHOSPHOR_PALETTES[value];
    if(value==='sampled') return ['#FF6558','#F5B83D','#5EC483','#60A5FA','#C084FC'];
    if(value==='grayscale') return ['#08080A','#57575B','#A4A4AA','#E4E4E7'];
    const colors=getPaletteColors({color:value,customColorHex:source.customColorHex,secondaryColorHex:source.secondaryColorHex,paletteModified:modified},preset);
    return [preset.substrateHex,colors.primary,...(colors.secondary?[colors.secondary]:[])];
  };
  const paletteChoices=PALETTES.map(value=>({value,label:PHOSPHOR_PALETTES[value].shortName,preview:<PaletteSwatches colors={paletteSwatches(value)}/>}));
  const localPalette = <section className="inspector-section inspector-palette" aria-label="Palette">
    {!caps.primaryInk?<p className="studio-context-note">CMYK uses fixed process inks sampled from the photo.</p>:<>
      <PresetChoices title="Palette" value={source.color} options={paletteChoices} open={activePreset==='palette'} onOpenChange={open=>setActivePreset(open?'palette':null)} onChange={color=>setSource({color,paletteModified:false})} modified={source.paletteModified} selectedPreview={<PaletteSwatches colors={paletteSwatches(source.color,source.paletteModified)}/>}/>
      {source.paletteModified && <p className="studio-context-note">Custom ink overrides are preserved. Choosing a preset replaces them.</p>}
      {source.color==='custom'&&<div className="studio-custom-inks"><StudioColorPicker label="Primary ink" value={source.customColorHex??palette.hex} onChange={customColorHex=>setSource({customColorHex})}/>{caps.secondaryInk?<StudioColorPicker label="Secondary ink" value={source.secondaryColorHex??'#FF3B7F'} onChange={secondaryColorHex=>setSource({secondaryColorHex})}/>:<p className="studio-context-note">This engine uses one Custom ink.</p>}</div>}
      {state.regions.length>1&&<button type="button" className="inspector-text-action" onClick={applyPalette}><StudioButtonLabel>Apply palette to all layers</StudioButtonLabel></button>}
    </>}
  </section>;
  return <aside aria-label="Appearance properties" className="studio-inspector studio-appearance-inspector flex h-full w-full min-w-0 shrink-0 flex-col border-l border-studio-line">
    <header className="studio-properties-header"><strong>{scope==='whole'?'Composition':targetName}</strong><span>{scope==='whole'?'Global':selected?'Layer':'Full canvas'}</span></header>
    <div className="inspector-content custom-scrollbar" key={scope==='whole'?'composition':selectedRegionId??'base'}>
      {scope==='selected'?<>
        {invisible&&<div className="inspector-recovery" role="status"><p>{selected?`${targetName} is hidden.`:'Base canvas is hidden in Layered.'} Show it to edit its appearance.</p><button type="button" onClick={()=>selected?onUpdateState({baseCanvas:{...base,mode:base.mode==='full'?'hybrid':base.mode},regions:state.regions.map(r=>r.id===selected.id?{...r,hidden:false}:r)}):setBase({mode:'hybrid'})}><StudioButtonLabel>Show & edit</StudioButtonLabel></button></div>}
        <fieldset className="inspector-target-fields" disabled={Boolean(invisible)}>
          <div className="inspector-section"><PresetChoices title="Style" value={source.glyphFamily} options={STYLE_CHOICES} groupLabels={STYLE_GROUP_LABELS} open={activePreset==='style'} onOpenChange={open=>setActivePreset(open?'style':null)} onChange={glyphFamily=>setSource({glyphFamily})}/>
          {range('style-cell-size','Cell size',source.cellSize,4,40,v=>setSource({cellSize:v}),'px')}
          {range('style-local-contrast','Local contrast',Math.round(source.contrast*100),50,220,v=>setSource({contrast:v/100}))}
          </div>
          {localPalette}
          <Group title="Style options"><p className="studio-context-note">{GLYPH_RAMPS[source.glyphFamily].description}</p><Toggle label="Invert local tones" checked={Boolean(source.invert)} onChange={invert=>setSource({invert})}/>{state.regions.length>1&&<button type="button" className="inspector-text-action" onClick={applyStyle}><StudioButtonLabel>Apply this style to all layers</StudioButtonLabel></button>}</Group>
          {caps.typography&&<Group title="Typography">
            <StudioSelect label="Glyph font" value={source.fontFamily??'JetBrains Mono'} options={['JetBrains Mono','Space Mono','Fira Code'].map(value=>({value,label:value}))} onValueChange={v=>void chooseFont(v as MonoFontFamily)}/>{fontStatus&&<p role="status" className="studio-context-note">{fontStatus}</p>}
            <div className="studio-scope-tabs" role="group" aria-label="Glyph content"><button type="button" aria-pressed={actualTextMode==='ramp'} onClick={()=>{setTextMode('ramp');setSource({wordmarkText:''});}}><StudioButtonLabel>Character ramp</StudioButtonLabel></button><button type="button" aria-pressed={actualTextMode==='repeat'} onClick={()=>{setTextMode('repeat');setSource({wordmarkText:source.wordmarkText||'SGNL'});}}><StudioButtonLabel>Repeated text</StudioButtonLabel></button></div>
            {actualTextMode==='ramp'?<><StudioSelect label="Character ramp preset" value={CHARACTER_PRESETS.find(p=>p.chars===source.customChars)?.id??'engine'} options={[{value:'engine',label:'Engine default'},...CHARACTER_PRESETS.map(p=>({value:p.id,label:p.label}))]} onValueChange={v=>setSource({customChars:CHARACTER_PRESETS.find(p=>p.id===v)?.chars??'',wordmarkText:''})}/><label className="inspector-input-label">Characters · dark to light<input value={source.customChars??''} onChange={e=>setSource({customChars:e.target.value,wordmarkText:''})} placeholder=" .:-=+*#%@"/></label></>:<label className="inspector-input-label">Repeated text<input value={source.wordmarkText??''} onChange={e=>setSource({wordmarkText:e.target.value})} placeholder="SGNL"/><small>This replaces the character ramp while text is present.</small></label>}
          </Group>}
          {(caps.printWeight||caps.printRegistration)&&<Group title="Print parameters">
            {caps.printAngle&&range('print-angle','Stroke angle',source.printAngle??-35,-180,180,v=>setSource({printAngle:v}),'°',true)}
            {caps.printWeight&&range('print-weight','Ink weight',Math.round((source.printWeight??1)*100),25,200,v=>setSource({printWeight:v/100}))}
            {caps.printRoughness&&range('print-roughness','Paper grain',Math.round((source.printRoughness??.3)*100),0,100,v=>setSource({printRoughness:v/100}))}
            {caps.printRegistration&&range('print-registration','Registration offset',Math.round((source.printRegistration??.25)*100),0,100,v=>setSource({printRegistration:v/100}))}
          </Group>}
          {caps.tileGap&&<Group title="Tile geometry">{range('tile-gap','Tile gap',Math.round((source.tileGap??.15)*100),0,50,v=>setSource({tileGap:v/100}))}{caps.tileRoundness&&range('tile-roundness','Corner radius',Math.round((source.tileRoundness??.25)*100),0,100,v=>setSource({tileRoundness:v/100}))}</Group>}
          <Group title="Substrate"><StudioSelect label="Substrate" value={source.substrateMode??'knockout'} options={SUBSTRATES} onValueChange={v=>setSource({substrateMode:v as SubstrateMode})}/>{source.substrateMode!=='transparent'&&range('canvas-knockout-opacity','Substrate opacity',Math.round(source.knockoutOpacity*100),0,100,v=>setSource({knockoutOpacity:v/100}))}<p className="studio-context-note">Shared background colors and glass blur are in Composition.</p></Group>
          {selected&&<Group title="Shape & blend"><Choices label="Layer shape" values={['rect','ellipse']} value={selected.shape??'rect'} onChange={shape=>setSource({shape})}/><StudioSelect label="Layer blend mode" value={selected.blendMode??'source-over'} options={['source-over','screen','multiply','overlay','difference'].map(value=>({value,label:value==='source-over'?'Normal':words(value)}))} onValueChange={v=>setSource({blendMode:v as RegionBlendMode})}/></Group>}
        </fieldset>
      </>:<>
        <div className="inspector-section studio-composition"><label className="inspector-field-label">Composition mode</label><StudioSelect label="Composition mode" value={base.mode} options={[{value:'full',label:'Full Frame · base only'},{value:'blocks',label:'Layered · original + layers'},{value:'hybrid',label:'Hybrid · styled base + layers'}]} onValueChange={value=>setBase({mode:value as CanvasCompositionMode})}/></div>
        <Group title="Tone & color" active={curveChanged?`${curveChanged} changed`:undefined} initialOpen>
          <StudioSelect label="Tone curve" value={state.grading.curvePreset??'linear'} options={CURVES.map(value=>({value,label:words(value)}))} onValueChange={v=>setGrading({curvePreset:v as CurvePreset})}/>
          <div className="studio-dial-bank">{range('grade-brightness','Exposure',state.grading.brightness??0,-50,50,v=>setGrading({brightness:v}),'',true)}{range('grade-contrast','Global contrast',state.grading.contrast??100,50,200,v=>setGrading({contrast:v}),'%',true)}{range('grade-saturation','Saturation',state.grading.saturation??100,0,200,v=>setGrading({saturation:v}),'%',true)}</div>
          {range('grade-black','Black point',state.grading.blackPoint,0,45,v=>setGrading({blackPoint:v}))}{range('grade-white','White point',state.grading.whitePoint,55,100,v=>setGrading({whitePoint:v}))}{range('grade-gamma','Gamma',Math.round(state.grading.gamma*100),25,300,v=>setGrading({gamma:v/100}))}{range('grade-shadows','Shadows',state.grading.shadows??0,-100,100,v=>setGrading({shadows:v}))}{range('grade-highlights','Highlights',state.grading.highlights??0,-100,100,v=>setGrading({highlights:v}))}{range('grade-edge','Edge emphasis',state.grading.edgeBoost,0,100,v=>setGrading({edgeBoost:v}))}{range('grade-sharpen','Sharpen',state.grading.sharpen??0,0,100,v=>setGrading({sharpen:v}))}{range('grade-denoise','Denoise',state.grading.denoise??0,0,100,v=>setGrading({denoise:v}))}
        </Group>
        <Group title="Source framing"><p className="studio-context-note">Original aspect ratio. Export keeps this photo's orientation.</p>{range('frame-zoom','Source zoom',Math.round((base.zoom??1)*100),100,300,v=>setBase({zoom:v/100}))}{range('frame-pan-x','Source position X',Math.round((base.panX??0)*100),-50,50,v=>setBase({panX:v/100}))}{range('frame-pan-y','Source position Y',Math.round((base.panY??0)*100),-50,50,v=>setBase({panY:v/100}))}<Toggle label="Flip horizontally" checked={Boolean(base.flipX)} onChange={flipX=>setBase({flipX})}/><Toggle label="Flip vertically" checked={Boolean(base.flipY)} onChange={flipY=>setBase({flipY})}/><button type="button" className="inspector-text-action" onClick={()=>setBase({zoom:1,panX:0,panY:0,flipX:false,flipY:false,aspectRatio:'original'})}><RotateCcw size={14}/><StudioButtonLabel>Reset framing</StudioButtonLabel></button></Group>
        <Group title="Shared background"><StudioColorPicker label="Background color" value={base.backdropColor??'#050708'} onChange={backdropColor=>setBase({backdropColor})}/>{anyGradient&&<StudioColorPicker label="Gradient end" value={base.backdropColor2??'#131824'} onChange={backdropColor2=>setBase({backdropColor2})}/>}<p className="studio-context-note">Used by Solid, Gradient, Duotone and Glass substrates.</p>{anyGlass&&range('canvas-','Global glass blur',base.backdropBlur??12,0,32,v=>setBase({backdropBlur:v}),'px')}</Group>
        <Group title="Deformation" section="deformation" focusRequest={focusRequest} active={(state.grading.warpMode??'off')!=='off'?words(state.grading.warpMode!):undefined}><StudioSelect label="Deformation mode" value={state.grading.warpMode??'off'} options={WARPS.map(value=>({value,label:words(value)}))} onValueChange={v=>setGrading({warpMode:v as SourceWarpMode,warpIntensity:v==='off'?state.grading.warpIntensity:state.grading.warpIntensity||35})}/>{(state.grading.warpMode??'off')!=='off'&&<>{range('warp-intensity','Deformation amount',state.grading.warpIntensity??35,-100,100,v=>setGrading({warpIntensity:v}))}{['swirl','pinch','sphere','polar'].includes(state.grading.warpMode!)&&range('warp-radius','Field radius',Math.round((state.grading.warpRadius??.75)*100),10,150,v=>setGrading({warpRadius:v/100}))}{['ripple','wave','zigzag','fragment'].includes(state.grading.warpMode!)&&range('warp-frequency','Pattern frequency',state.grading.warpFrequency??6,1,20,v=>setGrading({warpFrequency:v}),'')}{['wave','zigzag','shear','polar'].includes(state.grading.warpMode!)&&range('warp-angle','Field angle',state.grading.warpAngle??0,-180,180,v=>setGrading({warpAngle:v}),'°',true)}</>}</Group>
        <Group title="Pixel Sort" active={state.glitch.enabled&&state.glitch.pixelSortEnabled?'ON':undefined}><Toggle label="Pixel sorting" checked={state.glitch.enabled&&state.glitch.pixelSortEnabled} onChange={pixelSortEnabled=>setGlitch({pixelSortEnabled,...(pixelSortEnabled?{enabled:true}:{})})}/>{state.glitch.enabled&&state.glitch.pixelSortEnabled&&<><Choices label="Sort direction" values={['columns','rows']} value={state.glitch.pixelSortDirection} onChange={pixelSortDirection=>setGlitch({pixelSortDirection})}/>{range('ps-strength','Streak length',state.glitch.pixelSortStrength,0,100,v=>setGlitch({pixelSortStrength:v}))}{range('ps-min','Minimum luminance',state.glitch.pixelSortMin,0,Math.max(0,state.glitch.pixelSortMax-5),v=>setGlitch({pixelSortMin:Math.min(v,state.glitch.pixelSortMax-5)}))}{range('ps-max','Maximum luminance',state.glitch.pixelSortMax,Math.min(100,state.glitch.pixelSortMin+5),100,v=>setGlitch({pixelSortMax:Math.max(v,state.glitch.pixelSortMin+5)}))}<p className="studio-context-note">Only luminance between these endpoints is sorted. Endpoints cannot cross.</p></>}</Group>
        <Group title="VHS appearance" section="tracking" focusRequest={focusRequest} active={state.tracking.enabled?'ON':undefined}><Toggle label="VHS appearance" checked={state.tracking.enabled} onChange={enabled=>setTracking({enabled})}/>{state.tracking.enabled&&<>{range('trk-intensity','Tracking intensity',state.tracking.intensity,0,100,v=>setTracking({intensity:v}))}{range('trk-band-height','Band height',state.tracking.bandHeight,4,35,v=>setTracking({bandHeight:v}))}{range('trk-pos','Band position',state.tracking.position,0,100,v=>setTracking({position:v}))}{range('trk-bleed','Color offset',state.tracking.chromaBleed,0,100,v=>setTracking({chromaBleed:v}))}</>}</Group>
        <Group title="Glitch appearance" section="glitch" focusRequest={focusRequest} active={state.glitch.enabled?'ON':undefined}><Toggle label="Digital glitch" checked={state.glitch.enabled} onChange={enabled=>setGlitch({enabled})}/>{state.glitch.enabled&&<>{range('gl-freq','Slice density',state.glitch.sliceFrequency,0,100,v=>setGlitch({sliceFrequency:v}))}{range('gl-disp','Horizontal displacement',state.glitch.maxDisplacement,0,100,v=>setGlitch({maxDisplacement:v}))}{range('gl-rgb','Image offset ghost',state.glitch.rgbSplit,0,100,v=>setGlitch({rgbSplit:v}))}{range('gl-databend','Corrupted blocks',state.glitch.databendChunks,0,100,v=>setGlitch({databendChunks:v}))}<button type="button" className="inspector-text-action" onClick={()=>setGlitch({seed:Math.floor(Math.random()*99999)})}><Shuffle size={14}/><StudioButtonLabel>Re-roll pattern</StudioButtonLabel></button></>}</Group>
        <Group title="Surface textures" section="textures" focusRequest={focusRequest} active={(state.crt.filmGrain??0)>0||(state.crt.dustSpec??0)>0?'ON':undefined}>{range('crt-grain','Film grain',state.crt.filmGrain,0,100,v=>setCrt({filmGrain:v}))}{range('crt-dust','Dust & scratches',state.crt.dustSpec??0,0,100,v=>setCrt({dustSpec:v}))}</Group>
        <Group title="Poster text" active={text.enabled?'ON':undefined}><Toggle label="Poster text" checked={text.enabled} onChange={enabled=>setText({enabled})}/>{text.enabled&&<><label className="inspector-input-label">Title<input value={text.text} onChange={e=>setText({text:e.target.value})}/></label><label className="inspector-input-label">Subtitle<input value={text.subtext??''} onChange={e=>setText({subtext:e.target.value})}/></label><StudioSelect label="Poster typography" value={text.fontStyle} options={['editorial-mono','ascii-banner','minimal-sans'].map(value=>({value,label:words(value)}))} onValueChange={v=>setText({fontStyle:v as TextOverlaySettings['fontStyle']})}/><StudioSelect label="Text layer order" value={text.layerOrder} options={[{value:'front',label:'Above rendering'},{value:'behind-glyphs',label:'Behind rendering'}]} onValueChange={v=>setText({layerOrder:v as TextOverlaySettings['layerOrder']})}/><StudioColorPicker label="Text color" value={text.color} onChange={color=>setText({color})}/>{range('txt-size','Text size',text.size,20,160,v=>setText({size:v}),'px')}{range('txt-x','Text position X',Math.round(text.x*100),0,100,v=>setText({x:v/100}))}{range('txt-y','Text position Y',Math.round(text.y*100),0,100,v=>setText({y:v/100}))}<p className="studio-context-note">Wraps and fits inside the image. Title and subtitle can be used independently.</p></>}</Group>
        <Group title="Studio lights" active={`${lights.filter(l=>l.enabled).length}/3 active`}>{lights.map((light,idx)=><div className="inspector-light" key={light.id}><Toggle label={`Light ${idx+1}`} checked={light.enabled} onChange={enabled=>setLight(idx,{enabled})}/>{light.enabled&&<><StudioColorPicker label={`Light ${idx+1} color`} value={light.color} onChange={color=>setLight(idx,{color})}/>{range(`light-${idx}-intensity`,'Light intensity',light.intensity,0,100,v=>setLight(idx,{intensity:v}))}{range(`light-${idx}-radius`,'Light radius',Math.round(light.radius*100),10,120,v=>setLight(idx,{radius:v/100}))}{range(`light-${idx}-x`,'Light position X',Math.round(light.x*100),0,100,v=>setLight(idx,{x:v/100}))}{range(`light-${idx}-y`,'Light position Y',Math.round(light.y*100),0,100,v=>setLight(idx,{y:v/100}))}</>}</div>)}</Group>
        <Group title="Optical finish" active={crtChanged?`${crtChanged} active`:undefined}>
          {hasGlyph&&range('crt-glow','Character bloom',state.crt.phosphorGlow,0,100,v=>setCrt({phosphorGlow:v}))}{range('crt-whole-bloom','Whole image bloom',state.crt.wholeBloom??0,0,100,v=>setCrt({wholeBloom:v}))}{range('crt-prism','Optical image ghost',state.crt.prismAberration??0,0,100,v=>setCrt({prismAberration:v}))}{range('crt-scan','Scanlines',state.crt.scanlines,0,100,v=>setCrt({scanlines:v}))}{range('crt-mask','Aperture grille',state.crt.apertureMask,0,100,v=>setCrt({apertureMask:v}))}{range('crt-curve','Tube frame & glare',state.crt.barrelCurve,0,100,v=>setCrt({barrelCurve:v}))}{range('crt-vig','Vignette',state.crt.vignette,0,100,v=>setCrt({vignette:v}))}
        </Group>
        <Group title="Layer layouts" scope="Replaces the layer stack"><p className="studio-context-note">Applying a layout replaces existing layer positions. Undo restores the previous composition.</p><div className="studio-choice-grid">{(['split-left','split-right','split-dual','eyes-strip','center-portrait','cameo-ellipse','three-bands','full-frame'] as LayoutPresetId[]).map(preset=><button key={preset} type="button" disabled={!onApplyLayoutPreset} onClick={()=>onApplyLayoutPreset?.(preset)}><StudioButtonLabel>{words(preset)}</StudioButtonLabel></button>)}</div><button type="button" className="inspector-text-action" disabled={!onRandomizeBlocks} onClick={onRandomizeBlocks}><Shuffle size={14}/><StudioButtonLabel>Randomize layout</StudioButtonLabel></button><button type="button" className="inspector-text-action" disabled={!state.regions.length} onClick={()=>{onUpdateRegions([]);onSelectRegion(null);onSoloChange?.(null);}}><StudioButtonLabel>Clear all layers</StudioButtonLabel></button></Group>
      </>}
    </div>
  </aside>;
};
