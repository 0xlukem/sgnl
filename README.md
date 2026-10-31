# SGNL

A browser-based photo studio for terminal glyphs, print textures, and broken-signal effects. Built with React, TypeScript, Vite, Canvas, WebGL, and GSAP.

## Run locally

Use Node.js 22 or newer and npm.

```sh
git clone https://github.com/0xlukem/sgnl.git
cd sgnl
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment file, API key, or backend is required.

## Build

```sh
npm run build
npm run preview
```

The production build is generated in `dist/`. Deploy that directory to a static host.

## Use the studio

- Load a JPEG, PNG, or WebP image, or start with a bundled sample.
- Apply terminal glyphs, dithering, halftone, engraving, and signal effects.
- Work on the full image, arrange independent regions, or combine both approaches.
- Adjust color, tone, lighting, tracking, and glitch settings.
- Apply built-in recipes, save custom recipes, and import or export recipe JSON.
- Export PNG or WebP images and record animation when the browser supports it.

Image processing runs in the browser. Custom recipes are saved in the current browser's local storage. The interface loads fonts from Google Fonts; the bundled sample photograph and stone textures are served locally.

The inspector uses [audio/ui](https://www.audio-ui.dev/) faders and dials, [Animate UI](https://animate-ui.com/) switches and disclosure/tab motion, [Base UI](https://base-ui.com/) menus and focus management, and [react-colorful](https://github.com/omgovich/react-colorful) color pickers. Double-click a parameter readout, or focus it and press Enter, to type an exact value. Arrow keys make fine adjustments; Page keys make larger changes. Wheel adjustments require the parameter to have focus, so scrolling the inspector does not change values.

Unavailable parameters remain gray, explain why they are disabled, and retain their values. They become editable again when the active engine, palette, visible layers, or parent effect supports them.

## Check control compatibility

Run the availability tests with Node's built-in test runner and the existing TypeScript compiler:

```sh
node --test tests/control-availability.test.mjs
```

With `npm run dev` running, open `/tests/control-matrix.html` and click **Iniciar matriz** to compare minimum, intermediate, and maximum values in the production renderer. Use **Descargar JSON** to save the measurements. The page does not modify Studio state or ship in the production build.

- The default phase covers 72 sliders and dials across all 31 engines in Full Frame and rectangular/elliptical layers.
- `?phase=hybrid` checks Base Canvas and layers with both visible.
- `?phase=conditional` checks every Warp, Still Motion, Cursor, palette, and substrate option. Reveal/Trail are also checked at 1000px.
- `?phase=probe` and `?phase=probe-hybrid` repeat the audit's small raster differences, including identical-value stability renders. These stability renders intentionally produce no change.

The matrix fixes the source image, seed, state, and time. A pixel change proves that a parameter affects that fixture; it does not prove that every increment is perceptible or every endpoint is correct. Arbitrary effect stacks, every button, and every input image are outside this matrix.

## Source layout

- `src/components/`: interface, editor controls, and interactive previews.
- `src/engine/`: rendering, recipes, sample generation, and procedural scene code.
- `src/hooks/`: shared animation behavior.
- `public/`: bundled sample image and material maps.

Local environment files, internal documents, build output, screenshots, recordings, and review reports are excluded from Git.

## License

The project source code is available under the [MIT License](LICENSE), copyright 2026 0xlukem. Bundled third-party assets retain the CC0 terms listed below.

## Asset credits

- `public/samples/colosseum-rome.jpg`: [Colosseum of Rome, Italy](https://commons.wikimedia.org/wiki/File:Colosseum_of_Rome,_Italy.jpg), photographed by Wilfredor on 8 February 2024. The bundled file is the 1280px rendition, with no visual edits. Released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- `public/materials/colosseum/stone-*.webp`: [Sandstone Blocks 05](https://polyhaven.com/a/sandstone_blocks_05), by Rob Tuytel / Poly Haven, released under [CC0](https://polyhaven.com/license). The 1K diffuse, OpenGL normal, and ambient occlusion / roughness / metalness maps were re-encoded as WebP for the procedural stone material.
