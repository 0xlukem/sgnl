import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

// Exercise the production rules with Node's test runner and the existing TypeScript compiler.
const build = mkdtempSync(join(tmpdir(), 'sgnl-controls-'));
after(() => rmSync(build, { recursive: true, force: true }));
for (const name of ['types', 'engineCapabilities', 'controlDefaults', 'controlAvailability']) {
  const source = readFileSync(new URL(`../src/engine/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(join(build, `${name}.js`), outputText);
}
const require = createRequire(import.meta.url);
const { getDisabledControls } = require(join(build, 'controlAvailability.js'));
const { DEFAULT_BASE_CANVAS, GLYPH_RAMPS } = require(join(build, 'types.js'));

function context(engine = 'density', color = 'green') {
  const baseCanvas = { ...DEFAULT_BASE_CANVAS, mode: 'full', glyphFamily: engine, color };
  return {
    state: {
      regions: [], baseCanvas, grading: { warpMode: 'off', warpIntensity: 35 },
      tracking: { enabled: true, intensity: 32 },
      glitch: { enabled: true, sliceFrequency: 18, pixelSortEnabled: true },
      crt: { cursorEffect: 'off', motionMode: 'glow', motionAmount: 60, lights: [] },
    },
    baseCanvas, source: baseCanvas, target: 'base', selectedRegion: null, previewScale: 1.28,
  };
}

test('Print and Tile controls match all 31 renderer engines, including dual-ink Glyphs', () => {
  for (const [engine, ramp] of Object.entries(GLYPH_RAMPS)) {
    for (const color of ['green', 'risograph', 'custom', 'sampled']) {
      const disabled = getDisabledControls(context(engine, color));
      const print = ramp.group === 'Print & Etch';
      const angle = ['engraving', 'crosshatch', 'risograph-print', 'pointillism'].includes(engine);
      const dual = ['risograph', 'custom'].includes(color);
      const registration = engine === 'risograph-print' || (dual && (
        ramp.group === 'Glyphs' || ['engraving', 'stipple', 'woodblock'].includes(engine)
      ));
      const label = `${engine}/${color}`;
      assert.equal(!disabled['print-weight'], print, label);
      assert.equal(!disabled['print-roughness'], print, label);
      assert.equal(!disabled['print-angle'], angle, label);
      assert.equal(!disabled['print-registration'], registration, label);
      assert.equal(!disabled['tile-gap'], ramp.group === 'Tiles & Halftone', label);
      assert.equal(!disabled['tile-roundness'], ['mosaic', 'lego'].includes(engine), label);
    }
  }
});

test('global controls consider visible rendered sources, not the edit target or hidden layers', () => {
  const ctx = context('mosaic');
  const layer = { ...ctx.baseCanvas, id: 'layer', hidden: false, glyphFamily: 'ascii', color: 'sampled', substrateMode: 'glass' };
  ctx.baseCanvas.mode = 'hybrid';
  ctx.state.regions = [layer];
  let disabled = getDisabledControls(ctx);
  for (const id of ['crt-glow', 'grade-saturation', 'canvas-']) assert.equal(disabled[id], undefined);
  layer.hidden = true;
  disabled = getDisabledControls(ctx);
  for (const id of ['crt-glow', 'grade-saturation', 'canvas-']) assert.ok(disabled[id], id);
  ctx.baseCanvas.mode = 'blocks';
  disabled = getDisabledControls(ctx);
  assert.match(disabled['style-cell-size'], /Base Canvas/);
  assert.ok(disabled['grade-brightness']);
  layer.hidden = false;
  disabled = getDisabledControls({ ...ctx, target: 'layer', source: layer, selectedRegion: layer });
  assert.equal(disabled['style-cell-size'], undefined);
  assert.equal(disabled['grade-brightness'], undefined);
});

test('Warp controls follow each mode and can be enabled again after zero intensity', () => {
  const ctx = context();
  const matrix = {
    ripple: ['warp-frequency'], wave: ['warp-frequency', 'warp-angle'],
    swirl: ['warp-radius'], pinch: ['warp-radius'], sphere: ['warp-radius'],
    zigzag: ['warp-frequency', 'warp-angle'], shear: ['warp-angle'],
    polar: ['warp-radius', 'warp-angle'], fragment: ['warp-frequency'],
  };
  for (const [mode, active] of Object.entries(matrix)) {
    ctx.state.grading.warpMode = mode;
    ctx.state.grading.warpIntensity = 35;
    const disabled = getDisabledControls(ctx);
    for (const id of ['warp-radius', 'warp-frequency', 'warp-angle']) {
      assert.equal(!disabled[id], active.includes(id), `${mode}/${id}`);
    }
  }
  ctx.state.grading.warpMode = 'swirl';
  ctx.state.grading.warpIntensity = 0;
  assert.ok(getDisabledControls(ctx)['warp-radius']);
  assert.equal(getDisabledControls(ctx)['warp-intensity'], undefined);
  ctx.state.grading.warpIntensity = -35;
  assert.equal(getDisabledControls(ctx)['warp-radius'], undefined);
  ctx.state.grading.warpIntensity = 0.05;
  assert.ok(getDisabledControls(ctx)['warp-radius']);
});

test('VHS, Glitch and Sort respect their parent switches without disabling their activation control', () => {
  const ctx = context();
  ctx.state.tracking.enabled = false;
  ctx.state.glitch.enabled = false;
  let disabled = getDisabledControls(ctx);
  for (const id of ['trk-intensity', 'trk-band-height', 'trk-pos', 'trk-bleed', 'trk-jitter', 'trk-dropouts', 'gl-freq', 'gl-disp', 'gl-rgb', 'gl-databend', 'ps-strength', 'ps-min', 'ps-max']) assert.ok(disabled[id], id);
  ctx.state.tracking.enabled = true;
  ctx.state.tracking.intensity = 0;
  ctx.state.glitch.enabled = true;
  ctx.state.glitch.sliceFrequency = 0;
  ctx.state.glitch.pixelSortEnabled = false;
  disabled = getDisabledControls(ctx);
  assert.equal(disabled['trk-intensity'], undefined);
  assert.equal(disabled['trk-bleed'], undefined);
  assert.ok(disabled['trk-band-height']);
  assert.ok(disabled['gl-disp']);
  assert.equal(disabled['gl-freq'], undefined);
  assert.ok(disabled['ps-strength']);
  ctx.state.glitch.sliceFrequency = 2;
  assert.ok(getDisabledControls(ctx)['gl-disp']);
  ctx.state.glitch.sliceFrequency = 3;
  assert.equal(getDisabledControls(ctx)['gl-disp'], undefined);
  ctx.state.glitch.pixelSortEnabled = true;
  assert.equal(getDisabledControls(ctx)['ps-strength'], undefined);
});

test('lights and Motion preserve an enabled intensity control at zero output', () => {
  const ctx = context();
  ctx.state.crt.motionAmount = 0;
  ctx.state.crt.lights = [0, 1, 2].map(() => ({ enabled: true, intensity: 0 }));
  let disabled = getDisabledControls(ctx);
  assert.ok(disabled['motion-speed']);
  assert.equal(disabled['motion-amount'], undefined);
  for (let i = 0; i < 3; i++) {
    assert.equal(disabled[`light-${i}-intensity`], undefined);
    for (const field of ['radius', 'x', 'y']) assert.ok(disabled[`light-${i}-${field}`]);
    ctx.state.crt.lights[i].intensity = 50;
  }
  disabled = getDisabledControls(ctx);
  for (let i = 0; i < 3; i++) for (const field of ['radius', 'x', 'y']) assert.equal(disabled[`light-${i}-${field}`], undefined);
});

test('shared animation speed works for temporal warps independently of Photo Animation', () => {
  const ctx = context();
  ctx.state.crt.motionMode = 'off';
  ctx.state.crt.motionAmount = 0;
  for (const mode of ['off', 'ripple', 'wave', 'swirl', 'pinch', 'sphere', 'zigzag', 'shear', 'polar', 'fragment']) {
    for (const intensity of [0, 0.05, 0.1, 0.11, 35, -35]) {
      ctx.state.grading.warpMode = mode;
      ctx.state.grading.warpIntensity = intensity;
      const disabled = getDisabledControls(ctx);
      const moves = ['ripple', 'wave', 'swirl'].includes(mode) && Math.abs(intensity) > 0.1;
      assert.equal(!disabled['motion-speed'], moves, `${mode}/${intensity}`);
      assert.ok(disabled['motion-amount'], `${mode} must not activate Photo Animation amplitude`);
      assert.equal(!disabled['warp-intensity'], mode !== 'off', `${mode} intensity remains usable at zero`);
    }
  }
  ctx.state.grading.warpMode = 'wave';
  ctx.state.grading.warpIntensity = 35;
  ctx.baseCanvas.mode = 'blocks';
  assert.match(getDisabledControls(ctx)['motion-speed'], /Add or show a layer/);
});

test('Cursor works across image scales and keeps Glyph-only Loupe magnification', () => {
  const ctx = context();
  for (const mode of ['reveal', 'trail']) {
    ctx.state.crt.cursorEffect = mode;
    ctx.previewScale = 1.28;
    assert.equal(getDisabledControls(ctx)['hover-strength'], undefined);
    ctx.previewScale = 1;
    assert.equal(getDisabledControls(ctx)['hover-strength'], undefined);
  }
  ctx.state.crt.cursorEffect = 'loupe';
  assert.equal(getDisabledControls(ctx)['hover-strength'], undefined);
  ctx.baseCanvas.glyphFamily = 'mosaic';
  assert.ok(getDisabledControls(ctx)['hover-strength']);
  assert.ok(getDisabledControls(ctx)['hover-radius']);
  assert.ok(getDisabledControls(ctx)['layer-feather']);
  ctx.baseCanvas.mode = 'blocks';
  ctx.state.regions = [];
  for (const mode of ['repel', 'dissolve', 'water', 'vortex', 'magnetic', 'scatter']) {
    ctx.state.crt.cursorEffect = mode;
    assert.ok(getDisabledControls(ctx)['hover-radius'], mode);
    assert.ok(getDisabledControls(ctx)['hover-strength'], mode);
  }
});

const { getControlResetValue } = require(join(build, 'controlDefaults.js'));
const { getEngineCapabilities } = require(join(build, 'engineCapabilities.js'));

test('reset targets are meaningful values rather than a range midpoint', () => {
  assert.equal(getControlResetValue('grade-gamma', 25, 300), 100);
  assert.equal(getControlResetValue('grade-brightness', -50, 50), 0);
  assert.equal(getControlResetValue('motion-amount', 0, 100), 50);
  assert.equal(getControlResetValue('hover-radius', 5, 50), 18);
  assert.equal(getControlResetValue('hover-strength', 0, 100), 65);
  assert.equal(getControlResetValue('ps-min', 0, 15), 0);
  assert.equal(getControlResetValue('ps-max', 85, 100), 100);
});

test('glyph content and custom inks are offered only where consumed', () => {
  assert.equal(getEngineCapabilities('ascii').typography, true);
  assert.equal(getEngineCapabilities('dither-bayer').typography, false);
  assert.equal(getEngineCapabilities('cmyk', 'custom').primaryInk, false);
  assert.equal(getEngineCapabilities('mosaic', 'custom').secondaryInk, false);
  assert.equal(getEngineCapabilities('dither-bayer', 'custom').secondaryInk, true);
  assert.equal(getEngineCapabilities('risograph-print', 'custom').secondaryInk, true);
});

test('hidden layer controls share one unavailable target reason and subtitle-only text is editable', () => {
  const ctx=context();
  const layer={...ctx.baseCanvas,id:'hidden',hidden:true};
  ctx.state.regions=[layer];ctx.source=layer;ctx.selectedRegion=layer;ctx.target='layer';
  ctx.baseCanvas.mode='hybrid';
  assert.match(getDisabledControls(ctx)['style-cell-size'], /Show the selected layer/);
  layer.hidden=false;ctx.baseCanvas.mode='full';
  assert.match(getDisabledControls(ctx)['style-cell-size'], /not visible in Full Frame/);
  ctx.state.crt.textOverlay={enabled:true,text:'',subtext:'Subtitle on its own'};
  assert.equal(getDisabledControls(ctx)['txt-size'], undefined);
});
