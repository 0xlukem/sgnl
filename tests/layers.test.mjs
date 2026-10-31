import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const build = mkdtempSync(join(tmpdir(), 'sgnl-layers-'));
after(() => rmSync(build, { recursive: true, force: true }));
for (const name of ['types', 'layers']) {
  const source = readFileSync(new URL(`../src/engine/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  writeFileSync(join(build, `${name}.js`), outputText);
}
const require = createRequire(import.meta.url);
const { createStudioLayer, duplicateStudioLayer, getSoloPreviewState, clampLayerGeometry, nudgeStudioLayer } = require(join(build, 'layers.js'));
const { DEFAULT_BASE_CANVAS } = require(join(build, 'types.js'));

const fixture = () => ({ regions: [], baseCanvas: { ...DEFAULT_BASE_CANVAS }, grading: {}, tracking: {}, glitch: {}, crt: {}, randomSeed: 409 });

test('Add inherits the complete selected visible style and falls back to Base for hidden targets', () => {
  const state = fixture();
  const first = createStudioLayer(state, null);
  const selected = { ...first, cellSize: 23, glyphFamily: 'woodblock', customChars: 'abcd', wordmarkText: 'SGNL', fontFamily: 'Space Mono', printWeight: 1.6, printRegistration: 0.7, tileGap: 0.3, paletteModified: true };
  state.regions = [selected];
  const created = createStudioLayer(state, selected.id);
  for (const key of ['cellSize', 'glyphFamily', 'customChars', 'wordmarkText', 'fontFamily', 'printWeight', 'printRegistration', 'tileGap', 'paletteModified']) assert.equal(created[key], selected[key], key);
  assert.notEqual(created.id, selected.id);
  assert.notEqual(created.label, selected.label);
  selected.hidden = true;
  assert.equal(createStudioLayer(state, selected.id).glyphFamily, state.baseCanvas.glyphFamily);
});

test('Duplicate preserves style and unknown persisted fields while giving it a valid new identity and editable geometry', () => {
  const state = fixture();
  const region = { ...createStudioLayer(state, null), x: 0.95, y: 0.9, w: 0.05, h: 0.1, hidden: true, locked: true, customChars: '+-#', extensionField: 'retained' };
  const copy = duplicateStudioLayer(region, [region], 1280, 806);
  assert.notEqual(copy.id, region.id);
  assert.notEqual(copy.label, region.label);
  assert.equal(copy.extensionField, 'retained');
  assert.equal(copy.customChars, '+-#');
  assert.equal(copy.hidden, false);
  assert.equal(copy.locked, false);
  assert.ok(copy.x + copy.w <= 1 && copy.y + copy.h <= 1);
});

test('Solo shows only its target without changing saved visibility or the base mode', () => {
  const state = fixture();
  state.regions = [createStudioLayer(state, null), { ...createStudioLayer(state, null), hidden: true }];
  const saved = structuredClone(state);
  const isolated = getSoloPreviewState(state, state.regions[1].id);
  assert.equal(isolated.regions[0].hidden, true);
  assert.equal(isolated.regions[1].hidden, false);
  assert.equal(isolated.baseCanvas.mode, 'blocks');
  assert.deepEqual(state, saved);
  assert.equal(getSoloPreviewState(state, null), state);
  assert.equal(getSoloPreviewState(state, 'deleted-layer'), state);
});

test('Geometry clamps to the source bounds and keyboard nudges use source pixels', () => {
  const geometry = clampLayerGeometry({ x: -1, y: 2, w: 0, h: 0 }, 1280, 806);
  assert.equal(geometry.w, 8 / 1280);
  assert.equal(geometry.h, 8 / 806);
  assert.equal(geometry.x, 0);
  assert.equal(geometry.y + geometry.h, 1);
  const region = createStudioLayer(fixture(), null);
  const nudged = nudgeStudioLayer(region, 'ArrowRight', 1280, 806);
  assert.ok(Math.abs(nudged.x - region.x - 1 / 1280) < 1e-10);
  assert.ok(Math.abs(nudgeStudioLayer(region, 'ArrowUp', 1280, 806, true).y - region.y + 10 / 806) < 1e-10);
  const locked = { ...region, locked: true };
  assert.equal(nudgeStudioLayer(locked, 'ArrowRight', 1280, 806), locked);
});
