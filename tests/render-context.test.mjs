import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const build = mkdtempSync(join(tmpdir(), 'sgnl-render-context-'));
after(() => rmSync(build, { recursive: true, force: true }));
for (const name of ['types', 'prng', 'recipes', 'renderContext', 'studioState', 'posterLayout']) {
  const source = readFileSync(new URL(`../src/engine/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(join(build, `${name}.js`), outputText);
}
const require = createRequire(import.meta.url);
const { resolveRenderContext, normalizePixelSortRange, getPaletteColors } = require(join(build, 'renderContext.js'));
const { normalizeStudioState } = require(join(build, 'studioState.js'));
const { BUILTIN_RECIPES } = require(join(build, 'recipes.js'));
const { PHOSPHOR_PALETTES } = require(join(build, 'types.js'));
const { wrapPosterLines } = require(join(build, 'posterLayout.js'));

function document() {
  return structuredClone(BUILTIN_RECIPES[0].state);
}

test('Image render remains static without clearing the saved animation or touching the document', () => {
  const state = document();
  state.animation = { enabled: true, playbackSpeed: 2 };
  state.crt.motionMode = 'parallax';
  const before = structuredClone(state);
  for (const time of [0, 0.6, 2.9, 30]) {
    const ctx = resolveRenderContext(state, { intent: 'image', time });
    assert.equal(ctx.time, 0);
    assert.equal(ctx.motionEnabled, false);
    for (const channel of ['distortionTime', 'trackingTime', 'glitchTime', 'texturesTime']) assert.equal(ctx[channel], 0);
  }
  assert.deepEqual(state, before);
});

test('Animate master bypass and speed govern every temporal family, while channel bypass preserves other clocks', () => {
  const state = document();
  state.animation = { enabled: true, playbackSpeed: 1.5, channels: { tracking: false, distortion: false } };
  const ctx = resolveRenderContext(state, { intent: 'animate', time: 2 });
  assert.equal(ctx.time, 3);
  assert.equal(ctx.trackingTime, 0);
  assert.equal(ctx.distortionTime, 0);
  assert.equal(ctx.glitchTime, 3);
  assert.equal(ctx.texturesTime, 3);
  assert.equal(ctx.motionEnabled, true);
  const off = resolveRenderContext(state, { intent: 'animate', time: 2, animationEnabled: false });
  assert.equal(off.motionEnabled, false);
  assert.ok(['time', 'trackingTime', 'glitchTime', 'texturesTime', 'distortionTime'].every((key) => off[key] === 0));
  const explicit = resolveRenderContext(state, { intent: 'animate', time: 2, playbackSpeed: 0.5 });
  assert.equal(explicit.time, 1);
});

test('legacy render fixtures retain their clock and invalid time/speed cannot leak NaN into rendering', () => {
  const state = document();
  state.animation = { enabled: false, playbackSpeed: 3 };
  assert.equal(resolveRenderContext(state, { time: 2 }).time, 2);
  assert.equal(resolveRenderContext(state, { time: NaN, playbackSpeed: NaN }).time, 0);
  assert.equal(resolveRenderContext(state, { intent: 'animate', time: -8 }).time, 0);
});

test('crossed legacy Pixel Sort thresholds are materialized as their actual interval, not silently left contradictory', () => {
  assert.deepEqual(normalizePixelSortRange(80, 20), { min: 15, max: 85 });
  assert.deepEqual(normalizePixelSortRange(25, 80), { min: 25, max: 80 });
  for (const [a,b] of [[0,0],[100,100],[-8,240],[NaN,NaN],[40,41]]) {
    const { min, max } = normalizePixelSortRange(a,b);
    assert.ok(min >= 0 && max <= 100 && max - min >= 5);
  }
  const raw = document();
  raw.glitch.pixelSortMin = 80;
  raw.glitch.pixelSortMax = 20;
  const normalized = normalizeStudioState(raw);
  assert.equal(normalized.glitch.pixelSortMin, 15);
  assert.equal(normalized.glitch.pixelSortMax, 85);
});

test('all bundled recipes normalize idempotently without losing layers, local speeds or effect settings', () => {
  for (const recipe of BUILTIN_RECIPES) {
    const raw = structuredClone(recipe.state);
    const original = structuredClone(raw);
    const normalized = normalizeStudioState(raw);
    assert.deepEqual(raw, original, recipe.id + ' must not mutate input');
    assert.equal(normalized.schemaVersion, 2, recipe.id);
    assert.deepEqual(normalizeStudioState(normalized), normalized, recipe.id + ' idempotence');
    assert.deepEqual(normalized.regions.map((r) => r.id), raw.regions.map((r) => r.id), recipe.id);
    for (const key of ['tracking', 'grading']) assert.deepEqual(normalized[key], raw[key], recipe.id + '/' + key);
    assert.equal(normalized.crt.motionSpeed, raw.crt.motionSpeed ?? 100, recipe.id);
    assert.equal(normalized.crt.motionAmount, raw.crt.motionAmount ?? 50, recipe.id);
    assert.equal(normalized.crt.hoverRadius, raw.crt.hoverRadius ?? 18, recipe.id);
    assert.equal(normalized.crt.hoverStrength, raw.crt.hoverStrength ?? 65, recipe.id);
  }
});

test('legacy palette overrides stay explicit, while selecting a new preset ignores stored Custom ink', () => {
  const raw = document();
  raw.baseCanvas.color = 'blueprint';
  raw.baseCanvas.secondaryColorHex = '#B79AFF';
  const migrated = normalizeStudioState(raw);
  assert.equal(migrated.baseCanvas.paletteModified, true);
  const palette = PHOSPHOR_PALETTES.blueprint;
  assert.equal(getPaletteColors(migrated.baseCanvas, palette).secondary, '#B79AFF');
  const selectedPreset = { ...migrated.baseCanvas, paletteModified: false };
  assert.equal(getPaletteColors(selectedPreset, palette).secondary, palette.secondaryHex);
  assert.equal(selectedPreset.secondaryColorHex, '#B79AFF', 'Custom memory survives without contaminating presets');
  assert.equal(getPaletteColors({ ...selectedPreset, color: 'custom' }, PHOSPHOR_PALETTES.custom).secondary, '#B79AFF');
});

test('poster wrapping preserves explicit lines and long ASCII words without dropping characters', () => {
  const measure = (value) => Array.from(value).length * 10;
  assert.deepEqual(wrapPosterLines('SGNL\nSTUDIO',100,measure),['SGNL','STUDIO']);
  assert.deepEqual(wrapPosterLines('HELLO WORLD',60,measure),['HELLO','WORLD']);
  assert.deepEqual(wrapPosterLines('ABCDEFGHIJK',40,measure),['ABCD','EFGH','IJK']);
  assert.deepEqual(wrapPosterLines('',40,measure),[]);
});
