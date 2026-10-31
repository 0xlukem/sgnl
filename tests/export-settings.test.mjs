import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const build = mkdtempSync(join(tmpdir(), 'sgnl-export-'));
after(() => rmSync(build, { recursive: true, force: true }));
const source = readFileSync(new URL('../src/engine/exportSettings.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
writeFileSync(join(build, 'exportSettings.js'), outputText);
const require = createRequire(import.meta.url);
const { getVideoDimensions, getSupportedVideoFormats } = require(join(build, 'exportSettings.js'));

test('video size retains orientation and respects its long-edge limit for portrait and landscape photos', () => {
  assert.deepEqual(getVideoDimensions(1800, 1200, 1080), { width: 1080, height: 720 });
  assert.deepEqual(getVideoDimensions(1200, 1800, 720), { width: 480, height: 720 });
  assert.deepEqual(getVideoDimensions(2400, 2400, 1440), { width: 1440, height: 1440 });
  for (const [width, height] of [[4033, 3025], [3025, 4033], [301, 199], [17, 8000]]) {
    for (const longEdge of [720, 1080, 1440]) {
      const result = getVideoDimensions(width, height, longEdge);
      assert.ok(Math.max(result.width, result.height) <= longEdge);
      assert.ok(result.width <= width && result.height <= height);
      assert.equal(result.width % 2, 0);
      assert.equal(result.height % 2, 0);
      assert.ok(result.width >= 2 && result.height >= 2);
    }
  }
});

test('small photos are not enlarged and odd dimensions are compatible with even-size encoders', () => {
  assert.deepEqual(getVideoDimensions(601, 399, 1440), { width: 600, height: 398 });
  assert.deepEqual(getVideoDimensions(400, 300, 1080), { width: 400, height: 300 });
});

test('format choices expose only encoders supported by the browser, with WebM fallback and MP4-only support', () => {
  const supported = (...types) => getSupportedVideoFormats((type) => types.includes(type));
  assert.deepEqual(supported(), []);
  assert.deepEqual(supported('video/mp4').map((format) => format.extension), ['mp4']);
  assert.deepEqual(supported('video/webm', 'video/mp4').map((format) => format.mimeType), ['video/webm', 'video/mp4']);
  assert.deepEqual(supported('video/webm;codecs=vp9', 'video/webm', 'video/mp4').map((format) => format.mimeType), ['video/webm;codecs=vp9', 'video/mp4']);
});
