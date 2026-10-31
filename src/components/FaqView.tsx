import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, Plus, Search, X } from 'lucide-react';
import './faq.css';

const TOPICS = [
  { id: 'all', label: 'All answers' },
  { id: 'start', label: 'Getting started' },
  { id: 'editing', label: 'Editing' },
  { id: 'saving', label: 'Recipes & saving' },
  { id: 'export', label: 'Export & motion' },
] as const;

type Topic = typeof TOPICS[number]['id'];
interface Answer {
  id: string;
  topic: Exclude<Topic, 'all'>;
  question: string;
  location: string;
  paragraphs: string[];
  steps?: string[];
  reference?: { term: string; explanation: string }[];
  note?: string;
  related?: string[];
  keywords: string;
}

const ANSWERS: Answer[] = [
  {
    id: 'first-image', topic: 'start', question: 'How do I turn my photo into a finished image?', location: 'Studio → Layers → Base or a layer → Properties',
    paragraphs: [
      'Open Studio from the main navigation. A sample is already loaded, so you can test a look before choosing a file. Upload Photo replaces the source with a JPEG, PNG or WebP from your device; the photo menu lets you switch between the built-in samples. Uploads are limited to 30 MB. A file with another format, such as HEIC, must be converted before the studio can read it.',
      'The image is built from a source photograph, a composition mode and a set of treatments. Start with one engine and adjust its cell size before adding signal effects. This makes it easier to tell whether a change is improving the image or simply adding noise.',
    ],
    steps: [
      'Select Composition beneath the layer list, then choose Full Frame in Composition mode to apply a base treatment across the photograph. On a small screen, open Layers from the bottom bar first.',
      'Select Base in Layers. In Appearance on the right, open Style and choose a button such as Classic ASCII, Bayer 4×4 or Linear Engraving, then adjust Cell size until the subject has the detail you want. The style gallery closes after a choice and keeps its selected name and preview visible.',
      'Select a layer or Base to edit its appearance. Select Composition for shared framing, tone, lighting and finish. Use the Motion tab beside Appearance at the top of the right properties panel for time-based changes. On a small screen, both tabs are inside Properties.',
      'Open Export and choose Photo to save the static composition as PNG or WebP at 1× or 2×. To save an animated instant, pause or scrub in Motion and choose Capture frame. Save a recipe separately to reuse the setup.',
    ],
    note: 'If a valid-looking file will not open, try opening it in an image editor and exporting a fresh JPEG, PNG or WebP. Renaming the file extension does not convert the image.',
    related: ['composition', 'resolution', 'save-session'], keywords: 'upload import file format jpeg jpg png webp heic 30mb start tutorial photograph sample invalid file',
  },
  {
    id: 'composition', topic: 'editing', question: 'What changes between Full Frame, Layered and Hybrid?', location: 'Studio → Layers → Composition → Composition mode',
    paragraphs: [
      'Composition mode controls where the renderer applies a treatment. It does not select the engine itself. Select Composition beneath the layer list to find the mode selector and global adjustments. Select Base or a layer to return to its appearance controls. Changing modes keeps your existing layer data, so you can compare a full treatment with a layered version without rebuilding the layout.',
    ],
    reference: [
      { term: 'Full Frame', explanation: 'The base canvas treatment covers the entire photograph and layer handles are hidden. Select Base in the layer list to edit that treatment. Existing layers remain stored but are not rendered in this mode.' },
      { term: 'Layered', explanation: 'The original photograph remains underneath separate treatment regions. Draw a region on an uncovered part of the photo, then move or resize it. Each region can have its own engine, cell size, color and blend settings.' },
      { term: 'Hybrid', explanation: 'The base canvas is treated first, then the separate regions are rendered over it. Use this when you want a full-image texture with a different treatment over a face, object or other selected area.' },
    ],
    note: 'Return to Layered or Hybrid to see and edit layers hidden by Full Frame. A recipe can replace the layer layout; switching composition mode by itself does not.',
    related: ['edit-target', 'draw-layer', 'keep-layers'], keywords: 'full frame layered blocks hybrid mode composition whole entire original background regions',
  },
  {
    id: 'panels', topic: 'start', question: 'Where do I find a particular control?', location: 'Studio → Layers / Properties → Appearance or Motion; View',
    paragraphs: [
      'On desktop, Layers stays on the left, the canvas is in the center and Properties stays on the right. Appearance and Motion share the tabs at the top of Properties. Selecting a layer or Base opens its Appearance controls while the layer list remains visible; selecting Composition opens global adjustments. View beside the canvas heading opens inspection helpers. On small screens, the bottom bar opens Layers or Properties in a drawer. The same Appearance and Motion tabs are inside Properties.',
    ],
    reference: [
      { term: 'Style', explanation: 'Select a layer or Base in Appearance, then open Style to see engine buttons with mark previews, grouped into Glyphs, Dither, Tiles and Print. Choosing a style closes the gallery and keeps the selected name and preview visible. Cell size and local contrast are below it. Style options contains inversion and engine details; typography, print and tile settings appear for compatible engines.' },
      { term: 'Substrate and composition', explanation: 'The selected layer or Base owns its substrate and opacity. Composition owns framing, shared background, glass blur and poster text. Crop ratios are not implemented; the source keeps its original ratio.' },
      { term: 'Palette', explanation: 'Open Palette to see buttons with their color swatches. Choosing one closes the gallery while its name and colors stay visible. Style and Palette galleries open one at a time. Custom ink pickers stay visible below the closed gallery when Custom is selected and the engine supports them. Apply palette to all layers copies colors without replacing each layer’s engine. Composition owns source grading, which affects every rendered layer.' },
      { term: 'Composition', explanation: 'Select this row beneath the layer list for composition mode, source tone and framing, shared background, static effects, lighting and optical finish. These settings affect both the still composition and its animation.' },
      { term: 'Motion', explanation: 'The Motion tab at the top of Properties contains playback and temporal changes to the whole composition: image movement, deformation, VHS, glitch and textures. Adding a channel configures its appearance prerequisites and keeps you in Motion. Use a channel’s explicit appearance link to switch to Appearance and open the matching static settings. Opening or configuring Motion never starts Play automatically; scrubbing pauses on the chosen frame.' },
      { term: 'View', explanation: 'The popover beside the canvas heading contains original-photo comparison, split comparison and cursor effects. Zoom and Fit sit on the canvas. Solo in the layer list temporarily isolates a layer without changing saved visibility. These helpers are not included in exports.' },
    ],
    note: 'Some controls appear only for a compatible engine. Typography settings do not change a tile or print engine that does not use characters.',
    related: ['edit-target', 'detail', 'shortcuts'], keywords: 'inspector controls panel drawer mobile sliders style canvas color signal typography font text wordmark curve warp',
  },
  {
    id: 'detail', topic: 'editing', question: 'How do I keep the subject readable instead of getting a wall of noise?', location: 'Studio → layer or Base → Cell size; Composition → Tone & color',
    paragraphs: [
      'Cell size controls the sampling grid: smaller cells produce more marks and finer detail, while larger cells turn the photograph into a coarser pattern. It is different from the zoom buttons on the stage, which only change how closely you inspect the preview. A very small cell size can also make an already busy photograph harder to read.',
      'If the subject disappears, correct the tones before adding more effects. Glyph and dither engines turn brightness into marks, so a photo with very similar tones across the subject and background gives them little separation to work with. Local contrast changes the treatment; Composition → Tone & color changes the image being sampled.',
    ],
    steps: [
      'Pause playback and reduce strong tracking, glitch, glow or grain while judging the base image.',
      'Select a layer or Base, choose one Style and adjust Cell size. Look at the main silhouette and facial or object details rather than the individual marks.',
      'Select Composition and open Tone & color. Adjust exposure, contrast, black point or white point until the subject separates from the background. Make one adjustment at a time.',
      'Reintroduce signal effects gradually. If you want coarse marks on only part of the photo, use Layered or Hybrid rather than sacrificing detail everywhere.',
    ],
    related: ['composition', 'performance'], keywords: 'density cells detail readable noisy noise contrast dark bright black white grain blurry pixelated sampling',
  },
  {
    id: 'edit-target', topic: 'editing', question: 'Why am I changing the background instead of the layer I selected?', location: 'Studio → Layers → layer, Base or Composition',
    paragraphs: [
      'Style, Palette and Substrate edit the item selected in the layer list. Click a layer row or the region on the canvas to edit that region; choose Base to edit the full-canvas base treatment. The properties heading shows its name. Composition is a separate row for global adjustments, so its settings affect every layer. Rename and Duplicate are available in the layer menu. Solo is temporary inspection; leaving Solo restores the saved visibility. A hidden target explains how to show it before its appearance controls can be changed.',
    ],
    steps: [
      'Switch to Layered or Hybrid if you want to work on a region.',
      'Choose the layer in Layers and check its name at the top of Properties before editing. On a small screen, selecting the layer opens Properties directly. Choose Composition for a change intended to affect the complete image.',
      'Change a visible setting such as cell size or palette to confirm that only the intended region is being restyled.',
    ],
    note: 'Apply this style to all layers copies the active treatment across the layers; Apply palette to all layers copies only its colors. Source grading, lighting and motion affect the composition globally.',
    related: ['panels', 'composition'], keywords: 'selected layer base canvas target wrong background all apply palette selection engine style color',
  },
  {
    id: 'draw-layer', topic: 'editing', question: 'I can’t draw, move or resize a layer. What should I check?', location: 'Studio → Layers; Composition → Composition mode',
    paragraphs: [
      'A normal drag has different jobs depending on where it starts. Dragging an uncovered part of the photograph creates a region; dragging an existing region moves it; dragging a resize handle changes its bounds. Dragging the stage outside the photograph pans the view. These gestures are disabled or redirected by Full Frame, Split A/B, a layer lock or a held pan modifier.',
    ],
    steps: [
      'Choose Layered or Hybrid. Full Frame hides the region controls and does not let you draw new ones.',
      'Turn off Split A/B if it is active. The comparison slider takes precedence over layer editing.',
      'Release Space and use the primary pointer button. Holding Space or using the middle button switches the gesture to panning.',
      'Use Add layer in the Layers heading, or begin dragging on an uncovered part of the photo. For an existing region, check its visibility and Lock geometry action in the layer menu. Unlock it before moving or resizing.',
      'If the photograph is off-screen after panning or zooming, use Fit at the bottom of the stage to reset the view. This does not reset your treatments.',
    ],
    related: ['composition', 'edit-target', 'shortcuts'], keywords: 'draw create move resize layer locked hidden invisible handles drag pan space split comparison fit stuck cannot',
  },
  {
    id: 'transparency', topic: 'export', question: 'How do I export glyphs with a transparent background?', location: 'Studio → layer or Base → Properties → Substrate → Transparent',
    paragraphs: [
      'A transparent substrate clears the background within the treated region before drawing its marks. In Full Frame this can clear the whole base treatment; in Layered mode it clears only the region’s bounds, so the rest of the photograph remains. Selecting PNG preserves transparent pixels in the resulting file, but choosing PNG alone does not remove the photo or an opaque substrate.',
    ],
    steps: [
      'Use Full Frame if you want the base treatment across the entire image to have a transparent substrate.',
      'Select the layer or Base, open Substrate in Properties and choose Transparent.',
      'Check the result with your finishing and animation effects enabled. Full-image light, scanline, grain or other optical passes can still put visible marks into otherwise clear areas; reduce those effects if you need a cleaner cutout.',
      'Choose PNG in the export controls and export the still. Check it against a different background in the application where you intend to use it.',
    ],
    note: 'Transparent substrate removes the treatment’s background; it is not a subject-segmentation or background-removal tool. The studio does not automatically cut a person or object out of a photograph.',
    related: ['composition', 'resolution'], keywords: 'transparent transparency png alpha remove background cutout substrate knockout clear',
  },
  {
    id: 'save-session', topic: 'saving', question: 'What do I need to save before closing or refreshing the tab?', location: 'Recipes → Save recipe → Save to Local Browser',
    paragraphs: [
      'The live editing session is not automatically saved. Switching between Studio, Recipes and Manual keeps the current session open, but refreshing or closing the page does not preserve it. Save recipe stores the current configuration, including the layer layout, under a name in this browser profile. It does not store the uploaded photograph, undo history or an editable project file containing both the image and settings.',
    ],
    steps: [
      'Open Recipes and choose Save recipe. Enter a name; the description is optional.',
      'Choose Save to Local Browser and check for the Recipe Saved message. If Storage Full appears instead, the configuration was not persisted to browser storage.',
      'Export the finished PNG or WebP separately and keep the original photograph on your device.',
      'To reuse the setup later, upload the photograph again, open Recipes, choose My Recipes and apply the saved configuration.',
    ],
    note: 'Recipes belong to this browser profile and site. They do not sync to another device or browser, and clearing site data can delete them. An exported image keeps the appearance, but its layers cannot be edited separately.',
    related: ['json', 'keep-layers'], keywords: 'save saved saving autosave auto save refresh reload close session storage local browser persist project sync cloud lost work',
  },
  {
    id: 'keep-layers', topic: 'saving', question: 'Can I try a recipe without replacing my layer layout?', location: 'Recipes → Keep my layers',
    paragraphs: [
      'By default, applying a recipe replaces the current studio configuration, including its regions and composition mode. Enable Keep my layers before choosing another recipe to preserve the positions and sizes of your existing regions. The control changes to Layers stay in place while it is enabled. It only preserves a layout when there are already regions to keep.',
      'This is a layout lock, not a lock on every setting. The new recipe still supplies its source grading, tracking, glitch and optical settings, and restyles the existing regions with its engine, cell size, palette, contrast, substrate and inversion. The current composition mode is retained. If the recipe has several region treatments, the studio cycles through those treatments across your existing regions.',
    ],
    steps: [
      'Finish positioning your regions in Studio, then open Recipes.',
      'Enable Keep my layers before applying the new look. Check the result back in Studio.',
      'If you applied a recipe with the option off, use Undo while the session is still open, enable the option and try again.',
    ],
    related: ['save-session', 'edit-target'], keywords: 'keep my layers layout lock recipe preset preserve positions geometry moved replaced undo',
  },
  {
    id: 'json', topic: 'saving', question: 'What is Export JSON for? Can I import it again?', location: 'Recipes → Export JSON',
    paragraphs: [
      'Export JSON downloads a readable copy of the current studio configuration: base settings, regions, source grading, tracking, glitch and CRT settings. It also includes an export name and timestamp. The source photograph is not embedded in it, so it is not a complete image project.',
      'There is currently no JSON import control in the interface. You cannot reopen the file as a project or drag it into Studio to restore an editing session. Use Save recipe when you want a setup you can apply again through the interface in this browser, and keep the original photo separately. The JSON can still serve as a settings reference, but it should not be your only way of keeping finished work.',
    ],
    note: 'Exporting JSON does not create a custom recipe in the browser. Saving a recipe and downloading JSON are separate actions.',
    related: ['save-session'], keywords: 'json import export configuration backup restore project reopen file settings download',
  },
  {
    id: 'resolution', topic: 'export', question: 'What image size and quality can I export?', location: 'Studio → Export → Photo; Motion → Capture frame',
    paragraphs: [
      'Still exports use the source photograph’s pixel dimensions. The 1× option keeps that width and height; 2× doubles both. The export panel shows the exact dimensions. A 1200 × 800 source exports at 1200 × 800 with 1×, or 2400 × 1600 with 2×. Doubling dimensions does not reconstruct detail missing from the source.',
      'Export → Photo renders the static composition, independently of whether Motion is open or playing. Capture frame in Motion pauses and captures the selected animation time instead. Stage zoom and panning are inspection controls and do not determine the file dimensions. Composition → Source framing has separate zoom and pan settings that alter the photograph used by the renderer.',
    ],
    reference: [
      { term: 'PNG', explanation: 'Use for a lossless still and when the composition contains transparent areas you need to preserve. The format itself does not create transparency.' },
      { term: 'WebP', explanation: 'Choose Compact (75%), Balanced (90%) or High (98%). Higher quality generally retains more detail and creates a larger file. Actual size depends on the image and treatment.' },
      { term: '2×', explanation: 'Doubling each dimension creates four times as many output pixels. This can increase rendering time and browser memory use substantially on a large source.' },
    ],
    related: ['transparency', 'performance', 'hover-export'], keywords: '4k 4 k 2x 1x resolution width height size pixels native aspect ratio upscale export png webp zoom pan still',
  },
  {
    id: 'video', topic: 'export', question: 'How do I add motion, and can I choose video quality?', location: 'Studio → Properties → Motion; Export → Video clip',
    paragraphs: [
      'Video clip records your animated photo as a silent clip of about three seconds, from 0 to 3 seconds on the timeline. It records up to 30 frames per second; complex effects and browser performance can reduce that rate. Choose a maximum long edge of 720, 1080 or 1440 pixels. Small sources are not enlarged, and the panel shows the actual output dimensions. These settings are separate from Photo export.',
      'SGNL records directly in your browser. It offers WebM with VP9 when supported, otherwise WebM, and offers MP4 when the browser can encode it. The format selector shows the available choices. Video quality selects a target bitrate: Compact (4 Mbps), Balanced (8 Mbps) or High (16 Mbps). The encoder may adjust that bitrate. The clip is a consecutive section of the signal, so the end may not match the start and playback can jump at the join.',
    ],
    steps: [
      'Prepare the layer styles and Composition adjustments, then choose Motion beside Appearance at the top of Properties. On a small screen, open Properties from the bottom bar first. Add or select a channel and press Play to preview it. Adding a channel configures the appearance it needs without leaving Motion; its appearance link switches to Appearance and opens the matching static controls. All motion affects the composition rather than an individual layer.',
      'Open Export → Video clip to record the full 3-second timeline. Choose format, size and quality, then download. Use Capture frame instead to save one chosen instant as an image. Keep the tab visible while recording.',
      'If Video Unsupported or Format Unsupported appears, that browser cannot record the required canvas stream or codec. Try another browser with MediaRecorder support, or export a still instead.',
    ],
    note: 'Opening Motion, applying a recipe and changing an effect never starts playback automatically. Switching to Appearance keeps the motion configuration, current time and playback state; choose Motion again to reach its controls. Choose Photo or Video clip in Export independently of which tab is open. The clip is not guaranteed to join seamlessly.',
    related: ['hover-export', 'performance', 'shortcuts'], keywords: 'video loop seamless join animation animate play pause motion 3s 30fps 90 frame webm vp9 mp4 codec recorder unsupported format',
  },
  {
    id: 'hover-export', topic: 'export', question: 'Why doesn’t the export include the effect under my cursor?', location: 'Studio → View beside the canvas heading',
    paragraphs: [
      'Cursor effects respond to the pointer while you inspect the canvas. The still and video exporters render without a pointer position, so an interactive reveal, loupe, water, vortex or similar hover treatment is not recorded at the cursor’s current location. A paused preview with the mouse over it can therefore look different from the exported frame.',
      'Layer handles, floating controls, stage zoom, original-photo comparison and split comparison are inspection tools. Export renders the treated composition without those overlays. For a persistent treatment over a specific area, use a layer; use Motion for time-based effects.',
    ],
    related: ['composition', 'video', 'resolution'], keywords: 'cursor mouse hover reveal loupe water vortex magnetic interaction missing different preview screenshot split original compare handles',
  },
  {
    id: 'performance', topic: 'editing', question: 'The preview is slow or export fails. What can I change?', location: 'Studio → layer or Base → Cell size; Motion; Export → size',
    paragraphs: [
      'The browser renders the marks and finishing effects locally. A large source, dense cell grid and multiple optical passes all increase the work per frame. Video repeats that work throughout the recording, while a 2× still has four times the pixel count of a 1× still. The 30 MB upload limit is a file-size limit, not a guarantee that every image below it will be inexpensive to render.',
    ],
    steps: [
      'Pause the signal so the browser is not continuously drawing while you adjust the setup.',
      'Select the layer or Base and increase Cell size in Properties. Fewer cells reduce the number of glyphs or marks drawn across the image.',
      'Reduce glow, bloom and blur, and temporarily disable tracking or glitch passes to identify which setting is making the composition expensive.',
      'Try a 1× still, or choose 720 px for video. If it still fails, save your recipe, resize the original photograph in an image editor and upload the smaller source.',
    ],
    note: 'Save the recipe before refreshing to recover browser memory: the current editing session is not autosaved. If the error says Storage Full, that is a recipe-storage problem, so check the saving answer instead.',
    related: ['save-session', 'resolution', 'video'], keywords: 'slow lag laggy freeze frozen crash performance memory failed export error canvas unsupported storage browser large image blur bloom glow',
  },
  {
    id: 'privacy', topic: 'start', question: 'Is my uploaded photograph sent to a server or saved in an account?', location: 'Upload, rendering and export',
    paragraphs: [
      'The upload control reads the selected photograph in this browser, and the canvas renderer processes it on your device. Still and video exports are generated in the browser too; the studio does not send your photograph to a server for rendering. The interface does not have an account-based photo library or cloud project storage.',
      'Custom recipes are saved in local browser storage and contain settings and region geometry, not the source photograph. Keep the original image and any exported artwork as ordinary files on your device. This describes photo processing and recipe storage; it does not mean the website is fully offline, because the page can still load its own fonts and assets over the network.',
    ],
    related: ['save-session', 'json'], keywords: 'privacy private security local device server cloud upload internet offline account network photos storage',
  },
  {
    id: 'shortcuts', topic: 'editing', question: 'Which keyboard and pointer shortcuts are available?', location: 'Studio → stage and playback controls',
    paragraphs: [
      'Use these while working in Studio, outside text inputs, selects and editable fields. On Mac, ⌘ is Command and Option is the Alt modifier; on Windows or Linux use Ctrl and Alt. Pointer shortcuts act on the photograph or a region, so make sure you are in Layered or Hybrid when editing layers.',
    ],
    note: 'Space is reserved for panning while held during a drag; release it before drawing a region. After opening Motion, K controls playback. The Fit button resets the inspection view without deleting your layers or treatments.',
    related: ['draw-layer', 'video'], keywords: 'shortcuts keyboard keys command cmd ctrl control option alt delete backspace undo redo space arrow compare backslash fit pan duplicate',
  },
];

const SHORTCUTS = [
  ['Drag on an uncovered part of the photo', 'Create a layer'],
  ['Drag an unlocked layer / its handles', 'Move / resize the layer'],
  ['Alt / Option + drag a layer', 'Duplicate the layer'],
  ['Delete or Backspace on the canvas', 'Delete the selected layer; numeric and text controls are protected'],
  ['⌘ / Ctrl + Z', 'Undo the last recorded edit'],
  ['⌘ / Ctrl + Shift + Z', 'Redo'],
  ['K', 'Play or pause after opening Motion'],
  ['Arrow keys / Shift + arrow', 'Move a focused layer by 1 / 10 source pixels; use transport for frame stepping'],
  ['Hold \\', 'Show the original photograph'],
  ['Hold Space + drag / middle-button drag', 'Pan the stage view'],
];

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[‘’'“”"]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const SEARCH_TEXT = new Map(ANSWERS.map(answer => [answer.id, normalize([
  answer.question, answer.location, answer.keywords, ...answer.paragraphs, ...(answer.steps ?? []),
  ...(answer.reference ?? []).map(item => `${item.term} ${item.explanation}`), answer.note ?? '', ...(answer.id === 'shortcuts' ? SHORTCUTS.flat() : []),
].join(' '))]));

export const FaqView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['first-image']));
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const toolsOrigin = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const normalizedQuery = normalize(query.trim());
  const visible = useMemo(() => {
    const words = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = ANSWERS.filter(answer => (topic === 'all' || answer.topic === topic) && words.every(word => SEARCH_TEXT.get(answer.id)?.includes(word)));
    if (!words.length) return matches;
    const relevance = (answer: Answer) => words.reduce((score, word) => score
      + (normalize(answer.question).includes(word) ? 12 : 0)
      + (normalize(answer.location).includes(word) ? 5 : 0)
      + (normalize(answer.keywords).includes(word) ? 3 : 0), 0);
    return matches.sort((left, right) => relevance(right) - relevance(left));
  }, [normalizedQuery, topic]);

  useEffect(() => {
    if (normalizedQuery) setExpanded(new Set(visible.map(answer => answer.id)));
  }, [normalizedQuery, visible]);

  useEffect(() => {
    if (!pendingAnswer) return;
    const summary = root.current?.querySelector<HTMLElement>(`#manual-${pendingAnswer} > summary`);
    const scrollRoot = root.current;
    if (!summary || !scrollRoot) return;
    scrollRoot.scrollTo({ top: scrollRoot.scrollTop + summary.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top - (tools.current?.offsetHeight ?? 0) - 18 });
    summary.focus({ preventScroll: true });
    setPendingAnswer(null);
  }, [pendingAnswer, visible]);

  const revealAnswer = (id: string) => {
    setQuery('');
    setTopic('all');
    setExpanded(current => new Set([...current, id]));
    setPendingAnswer(id);
  };
  const showSearch = () => toolsOrigin.current?.scrollIntoView({ block: 'start' });
  const reset = () => { setQuery(''); setTopic('all'); showSearch(); searchInput.current?.focus({ preventScroll: true }); };
  const allVisibleExpanded = visible.length > 0 && visible.every(answer => expanded.has(answer.id));

  return <main ref={root} className="page-scroll custom-scrollbar sgnl-help" aria-labelledby="manual-title">
    <div className="sgnl-help-page">
      <header className="sgnl-help-header">
        <h1 id="manual-title">MANUAL.</h1>
        <p>SGNL turns a photo into glyphs, dither, tiles or print, across the full frame or inside editable layers. Find the controls, follow a workflow, or fix a problem below—including what saving and export can actually do.</p>
      </header>

      <div ref={toolsOrigin} className="sgnl-help-tools-origin" />
      <div ref={tools} className="sgnl-help-tools">
        <div className="sgnl-help-search-row">
          <div className="sgnl-help-search"><Search size={20} aria-hidden="true" /><label className="sgnl-help-sr-only" htmlFor="manual-search">Search the manual</label>
            <input ref={searchInput} id="manual-search" type="search" value={query} placeholder="Search the manual…" autoComplete="off" spellCheck={false} aria-controls="manual-answers" onChange={event => { setQuery(event.target.value); showSearch(); }} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />
            {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
          </div>
          <span className="sgnl-help-search-hint">TRY “QUALITY”, “LAYERS” OR “SAVE”</span>
        </div>
        <nav className="sgnl-help-topics" aria-label="Filter manual by topic">{TOPICS.map(item => <button type="button" key={item.id} aria-pressed={topic === item.id} onClick={() => { setTopic(item.id); showSearch(); }}>
          {item.label}<span>{item.id === 'all' ? ANSWERS.length : ANSWERS.filter(answer => answer.topic === item.id).length}</span>
        </button>)}</nav>
      </div>

      <div className="sgnl-help-result-bar">
        <p role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'answer' : 'answers'}{query.trim() && <> for <strong>“{query.trim()}”</strong></>}{topic !== 'all' && <> in {TOPICS.find(item => item.id === topic)?.label}</>}</p>
        <button type="button" disabled={!visible.length} onClick={() => setExpanded(current => {
          const next = new Set(current);
          visible.forEach(answer => { if (allVisibleExpanded) next.delete(answer.id); else next.add(answer.id); });
          return next;
        })}>{allVisibleExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}<Plus size={14} aria-hidden="true" data-expanded={allVisibleExpanded} /></button>
      </div>

      <div id="manual-answers" className="sgnl-help-answers">
        {visible.map(answer => <details key={answer.id} id={`manual-${answer.id}`} open={expanded.has(answer.id)} onToggle={event => {
          const isOpen = event.currentTarget.open;
          setExpanded(current => {
            if (current.has(answer.id) === isOpen) return current;
            const next = new Set(current);
            if (isOpen) next.add(answer.id); else next.delete(answer.id);
            return next;
          });
        }}>
          <summary><span className="sgnl-help-answer-number" aria-hidden="true">{String(ANSWERS.indexOf(answer) + 1).padStart(2, '0')}</span><div><h2>{answer.question}</h2><span className="sgnl-help-location">{answer.location}</span></div><span className="sgnl-help-toggle" aria-hidden="true"><Plus size={23} /></span></summary>
          <div className="sgnl-help-answer-body">
            {answer.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {answer.reference && <dl>{answer.reference.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.explanation}</dd></div>)}</dl>}
            {answer.steps && <ol>{answer.steps.map(step => <li key={step}>{step}</li>)}</ol>}
            {answer.id === 'shortcuts' && <dl className="sgnl-help-shortcuts">{SHORTCUTS.map(([keys, action]) => <div key={keys}><dt>{action}</dt><dd><kbd>{keys}</kbd></dd></div>)}</dl>}
            {answer.note && <aside><p>{answer.note}</p></aside>}
            {answer.related && <div className="sgnl-help-related"><span>RELATED ANSWERS</span>{answer.related.map(id => <button type="button" key={id} onClick={() => revealAnswer(id)}>{ANSWERS.find(item => item.id === id)?.question}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>}
          </div>
        </details>)}
        {!visible.length && <div className="sgnl-help-empty"><h2>No matching answer.</h2><p>Try the name of a control shown in Studio, or clear the search and topic filter to browse the full manual.</p><button type="button" onClick={reset}>RESET SEARCH <ArrowUpRight size={17} aria-hidden="true" /></button></div>}
      </div>

      <footer className="sgnl-help-footer"><span>SGNL / MANUAL</span><button type="button" onClick={() => { showSearch(); searchInput.current?.focus({ preventScroll: true }); }}>BACK TO SEARCH <ArrowUp size={16} aria-hidden="true" /></button></footer>
    </div>
  </main>;
};

export default FaqView;
