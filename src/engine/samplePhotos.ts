export type SamplePhoto = {
  id: string;
  name: string;
  subtitle: string;
  aspectLabel: string;
  width: number;
  height: number;
} & ({ createCanvas: () => HTMLCanvasElement; sourceUrl?: never } | { sourceUrl: string; createCanvas?: never });

/**
 * Adds fine photographic silver-halide grain so sample plates have genuine camera texture
 * in the untouched photo areas.
 */
function applyPhotographicGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 14
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  let seed = 133742;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) | 0;
    const noise = (((seed >>> 16) & 0xff) - 128) * (amount / 128);
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Sample 1: Editorial Portrait
 * High-fashion black-and-warm-bronze studio portrait with realistic sculpted human eyes,
 * iris catchlights, eyebrows, nose bridge shadow, lips, and cheekbones.
 */
function createEditorialPortraitSample(): HTMLCanvasElement {
  const width = 1440;
  const height = 1800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep studio backdrop with warm bronze key halo
  const bgGrad = ctx.createRadialGradient(
    width * 0.44,
    height * 0.32,
    width * 0.04,
    width * 0.5,
    height * 0.48,
    width * 0.88
  );
  bgGrad.addColorStop(0, '#3a2e27');
  bgGrad.addColorStop(0.45, '#1b1615');
  bgGrad.addColorStop(0.8, '#0c0a0b');
  bgGrad.addColorStop(1, '#050506');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle diagonal Rembrandt studio key light falloff across canvas
  ctx.save();
  const beam = ctx.createLinearGradient(0, height * 0.04, width * 0.9, height * 0.82);
  beam.addColorStop(0, 'rgba(255, 224, 195, 0.14)');
  beam.addColorStop(0.48, 'rgba(215, 165, 125, 0.08)');
  beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Tailored Editorial Coat / Shoulders
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(width * 0.07, height);
  ctx.quadraticCurveTo(width * 0.14, height * 0.69, width * 0.35, height * 0.63);
  ctx.lineTo(width * 0.65, height * 0.63);
  ctx.quadraticCurveTo(width * 0.86, height * 0.69, width * 0.93, height);
  ctx.closePath();
  const coatGrad = ctx.createLinearGradient(width * 0.1, height * 0.63, width * 0.9, height);
  coatGrad.addColorStop(0, '#4a3a31');
  coatGrad.addColorStop(0.38, '#211b19');
  coatGrad.addColorStop(0.75, '#0f0d0e');
  coatGrad.addColorStop(1, '#1c1817');
  ctx.fillStyle = coatGrad;
  ctx.fill();

  // Crisp editorial lapel fold lines
  ctx.strokeStyle = 'rgba(235, 205, 180, 0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(width * 0.34, height * 0.63);
  ctx.lineTo(width * 0.45, height * 0.92);
  ctx.moveTo(width * 0.66, height * 0.63);
  ctx.lineTo(width * 0.55, height * 0.92);
  ctx.stroke();

  // Sculpted Neck & Collarbone Shadow
  ctx.beginPath();
  ctx.roundRect(width * 0.415, height * 0.48, width * 0.17, height * 0.19, 36);
  const neckGrad = ctx.createLinearGradient(width * 0.415, 0, width * 0.585, 0);
  neckGrad.addColorStop(0, '#e5b594');
  neckGrad.addColorStop(0.48, '#9a684d');
  neckGrad.addColorStop(0.85, '#2b1c17');
  neckGrad.addColorStop(1, '#523a2e');
  ctx.fillStyle = neckGrad;
  ctx.fill();

  // Cast shadow from chin onto neck
  const chinShadow = ctx.createRadialGradient(
    width * 0.51,
    height * 0.51,
    width * 0.02,
    width * 0.51,
    height * 0.52,
    width * 0.12
  );
  chinShadow.addColorStop(0, 'rgba(15, 9, 8, 0.85)');
  chinShadow.addColorStop(1, 'rgba(15, 9, 8, 0)');
  ctx.fillStyle = chinShadow;
  ctx.fillRect(width * 0.38, height * 0.47, width * 0.24, height * 0.14);
  ctx.restore();

  // Sculpted Hair Silhouette & Crown Volume
  ctx.save();
  ctx.fillStyle = '#0e0b0a';
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.27, width * 0.228, height * 0.165, 0, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();

  // Sculpted Face with Chiaroscuro Studio Lighting
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.33, width * 0.205, height * 0.205, 0, 0, Math.PI * 2);
  const faceGrad = ctx.createRadialGradient(
    width * 0.39,
    height * 0.26,
    width * 0.02,
    width * 0.51,
    height * 0.34,
    width * 0.25
  );
  faceGrad.addColorStop(0, '#fff3e6');
  faceGrad.addColorStop(0.28, '#e8b694');
  faceGrad.addColorStop(0.58, '#9c664c');
  faceGrad.addColorStop(0.86, '#2a1b16');
  faceGrad.addColorStop(0.96, '#3d2920');
  faceGrad.addColorStop(1, '#8c6752'); // Subtle warm bronze edge rim light
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Cheekbone highlight (left key side) & Rembrandt triangle on right cheek
  const leftCheek = ctx.createRadialGradient(
    width * 0.38,
    height * 0.35,
    width * 0.01,
    width * 0.38,
    height * 0.35,
    width * 0.08
  );
  leftCheek.addColorStop(0, 'rgba(255, 245, 235, 0.55)');
  leftCheek.addColorStop(1, 'rgba(255, 245, 235, 0)');
  ctx.fillStyle = leftCheek;
  ctx.beginPath();
  ctx.arc(width * 0.38, height * 0.35, width * 0.08, 0, Math.PI * 2);
  ctx.fill();

  const rembrandtPatch = ctx.createRadialGradient(
    width * 0.59,
    height * 0.355,
    width * 0.005,
    width * 0.59,
    height * 0.355,
    width * 0.055
  );
  rembrandtPatch.addColorStop(0, 'rgba(228, 175, 138, 0.48)');
  rembrandtPatch.addColorStop(1, 'rgba(228, 175, 138, 0)');
  ctx.fillStyle = rembrandtPatch;
  ctx.beginPath();
  ctx.arc(width * 0.59, height * 0.355, width * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // Cheekbone hollow contour shadows
  ctx.fillStyle = 'rgba(28, 16, 13, 0.38)';
  ctx.beginPath();
  ctx.ellipse(width * 0.37, height * 0.41, width * 0.055, height * 0.022, 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.62, height * 0.41, width * 0.06, height * 0.025, -0.38, 0, Math.PI * 2);
  ctx.fill();

  // Natural Sculpted Eyebrows (y ≈ 0.258)
  ctx.fillStyle = '#1c1310';
  // Left eyebrow
  ctx.beginPath();
  ctx.moveTo(width * 0.335, height * 0.268);
  ctx.quadraticCurveTo(width * 0.395, height * 0.244, width * 0.462, height * 0.264);
  ctx.quadraticCurveTo(width * 0.398, height * 0.256, width * 0.335, height * 0.268);
  ctx.fill();
  // Right eyebrow
  ctx.beginPath();
  ctx.moveTo(width * 0.538, height * 0.264);
  ctx.quadraticCurveTo(width * 0.605, height * 0.244, width * 0.665, height * 0.268);
  ctx.quadraticCurveTo(width * 0.602, height * 0.256, width * 0.538, height * 0.264);
  ctx.fill();

  // Realistic Sculpted Human Eyes (y ≈ 0.298)
  const eyes = [
    { cx: width * 0.405, cy: height * 0.298, isKey: true },
    { cx: width * 0.595, cy: height * 0.298, isKey: false },
  ];

  for (const eye of eyes) {
    const ew = width * 0.046;
    const eh = height * 0.014;

    // Orbital socket shading
    const socketGrad = ctx.createRadialGradient(eye.cx, eye.cy, ew * 0.2, eye.cx, eye.cy, ew * 1.45);
    socketGrad.addColorStop(0, 'rgba(32, 18, 15, 0.58)');
    socketGrad.addColorStop(1, 'rgba(32, 18, 15, 0)');
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.arc(eye.cx, eye.cy, ew * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Almond Sclera (white of the eye with subtle studio shading)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(eye.cx - ew, eye.cy);
    ctx.quadraticCurveTo(eye.cx, eye.cy - eh * 1.35, eye.cx + ew, eye.cy);
    ctx.quadraticCurveTo(eye.cx, eye.cy + eh * 1.15, eye.cx - ew, eye.cy);
    ctx.closePath();
    ctx.fillStyle = eye.isKey ? '#eee6de' : '#bfb3a8';
    ctx.fill();
    ctx.clip();

    // Sculpted Iris
    const irisR = ew * 0.46;
    const irisGrad = ctx.createRadialGradient(
      eye.cx - irisR * 0.2,
      eye.cy - irisR * 0.2,
      irisR * 0.1,
      eye.cx,
      eye.cy,
      irisR
    );
    irisGrad.addColorStop(0, '#9e6b43');
    irisGrad.addColorStop(0.65, '#4f321e');
    irisGrad.addColorStop(1, '#160d09');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(eye.cx, eye.cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Deep Pupil
    ctx.fillStyle = '#070505';
    ctx.beginPath();
    ctx.arc(eye.cx, eye.cy, irisR * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Studio Softbox Catchlight & Secondary Fill Catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye.cx - irisR * 0.34, eye.cy - irisR * 0.32, irisR * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 242, 228, 0.75)';
    ctx.beginPath();
    ctx.arc(eye.cx + irisR * 0.36, eye.cy + irisR * 0.28, irisR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Upper Eyelash Line & Eyelid Crease
    ctx.strokeStyle = '#120b09';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(eye.cx - ew * 1.05, eye.cy + 2);
    ctx.quadraticCurveTo(eye.cx, eye.cy - eh * 1.4, eye.cx + ew * 1.05, eye.cy + 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(42, 24, 19, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eye.cx - ew * 0.95, eye.cy - eh * 0.55);
    ctx.quadraticCurveTo(eye.cx, eye.cy - eh * 2.0, eye.cx + ew * 0.95, eye.cy - eh * 0.55);
    ctx.stroke();
  }

  // Nose Bridge Highlight & Cast Shadow
  ctx.fillStyle = 'rgba(28, 16, 13, 0.68)';
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height * 0.29);
  ctx.lineTo(width * 0.535, height * 0.385);
  ctx.lineTo(width * 0.5, height * 0.398);
  ctx.lineTo(width * 0.478, height * 0.388);
  ctx.closePath();
  ctx.fill();

  // Sunlit nose bridge & tip highlight
  const noseHighlight = ctx.createLinearGradient(width * 0.48, height * 0.28, width * 0.495, height * 0.385);
  noseHighlight.addColorStop(0, 'rgba(255, 245, 232, 0.75)');
  noseHighlight.addColorStop(1, 'rgba(255, 232, 210, 0.9)');
  ctx.fillStyle = noseHighlight;
  ctx.beginPath();
  ctx.roundRect(width * 0.482, height * 0.285, width * 0.02, height * 0.095, 8);
  ctx.fill();

  // Sculpted Editorial Lips (y ≈ 0.442)
  const lipY = height * 0.442;
  const lipW = width * 0.062;
  // Upper lip (darker warm rose-umber with Cupid's bow)
  ctx.fillStyle = '#6e3d34';
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - lipW, lipY);
  ctx.quadraticCurveTo(width * 0.5 - lipW * 0.45, lipY - height * 0.016, width * 0.5 - lipW * 0.15, lipY - height * 0.011);
  ctx.lineTo(width * 0.5, lipY - height * 0.006);
  ctx.lineTo(width * 0.5 + lipW * 0.15, lipY - height * 0.011);
  ctx.quadraticCurveTo(width * 0.5 + lipW * 0.45, lipY - height * 0.016, width * 0.5 + lipW, lipY);
  ctx.closePath();
  ctx.fill();

  // Lower lip (fuller with warm studio specular highlight)
  const lowerLipGrad = ctx.createRadialGradient(
    width * 0.485,
    lipY + height * 0.01,
    2,
    width * 0.5,
    lipY + height * 0.012,
    lipW
  );
  lowerLipGrad.addColorStop(0, '#f2c2ac');
  lowerLipGrad.addColorStop(0.55, '#a66352');
  lowerLipGrad.addColorStop(1, '#47251f');
  ctx.fillStyle = lowerLipGrad;
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - lipW, lipY);
  ctx.quadraticCurveTo(width * 0.5, lipY + height * 0.028, width * 0.5 + lipW, lipY);
  ctx.closePath();
  ctx.fill();

  // Center lip parting shadow line
  ctx.strokeStyle = '#1f100e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - lipW, lipY);
  ctx.quadraticCurveTo(width * 0.5, lipY + 3, width * 0.5 + lipW, lipY);
  ctx.stroke();
  ctx.restore();

  applyPhotographicGrain(ctx, width, height, 14);
  return canvas;
}

/**
 * Sample 2: Brutalist Monolith
 * Board-formed concrete geometry with sharp shadows, coffered recesses, and dramatic sky gradient.
 */
function createBrutalistMonolithSample(): HTMLCanvasElement {
  const width = 1600;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Dramatic architectural sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#09111c');
  sky.addColorStop(0.45, '#1d3147');
  sky.addColorStop(0.78, '#7c4c3e');
  sky.addColorStop(1, '#e0935b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Low atmospheric sun disc for tonal contrast
  const sunGrad = ctx.createRadialGradient(
    width * 0.22,
    height * 0.32,
    width * 0.02,
    width * 0.22,
    height * 0.32,
    width * 0.16
  );
  sunGrad.addColorStop(0, '#fff6eb');
  sunGrad.addColorStop(0.4, 'rgba(255, 210, 165, 0.75)');
  sunGrad.addColorStop(1, 'rgba(255, 160, 100, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(width * 0.22, height * 0.32, width * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  // Main sunlit left facade (poured board-formed concrete)
  const leftFacade = ctx.createLinearGradient(width * 0.16, height * 0.08, width * 0.54, height);
  leftFacade.addColorStop(0, '#f2ece1');
  leftFacade.addColorStop(0.6, '#d8cfc2');
  leftFacade.addColorStop(1, '#9c9286');
  ctx.fillStyle = leftFacade;
  ctx.beginPath();
  ctx.moveTo(width * 0.16, height * 0.14);
  ctx.lineTo(width * 0.54, height * 0.05);
  ctx.lineTo(width * 0.54, height);
  ctx.lineTo(width * 0.16, height);
  ctx.closePath();
  ctx.fill();

  // Sharp shadow-side right facade
  const rightWall = ctx.createLinearGradient(width * 0.54, 0, width * 0.88, height);
  rightWall.addColorStop(0, '#22262e');
  rightWall.addColorStop(0.6, '#14171d');
  rightWall.addColorStop(1, '#0b0d11');
  ctx.fillStyle = rightWall;
  ctx.beginPath();
  ctx.moveTo(width * 0.54, height * 0.05);
  ctx.lineTo(width * 0.88, height * 0.19);
  ctx.lineTo(width * 0.88, height);
  ctx.lineTo(width * 0.54, height);
  ctx.closePath();
  ctx.fill();

  // Horizontal concrete tie-rod seams on sunlit facade
  ctx.strokeStyle = 'rgba(60, 52, 45, 0.28)';
  ctx.lineWidth = 2;
  for (let y = height * 0.14; y < height; y += height * 0.065) {
    ctx.beginPath();
    ctx.moveTo(width * 0.16, y);
    ctx.lineTo(width * 0.54, y - height * 0.025);
    ctx.stroke();
  }

  // Deep recessed coffered brutalist windows with diagonal sunlight reveals
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = width * (0.205 + col * 0.102);
      const wy = height * (0.17 + row * 0.158) - col * 14;
      const ww = width * 0.068;
      const wh = height * 0.108;

      ctx.fillStyle = '#12151a';
      ctx.fillRect(wx, wy, ww, wh);

      ctx.fillStyle = '#b59f8b';
      ctx.beginPath();
      ctx.moveTo(wx + ww * 0.62, wy);
      ctx.lineTo(wx + ww, wy);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.lineTo(wx + ww * 0.62, wy + wh * 0.82);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Cantilevered brutalist fins & warm sunset rim reflections on right facade
  for (let row = 0; row < 6; row++) {
    const fy = height * (0.18 + row * 0.135);
    ctx.fillStyle = '#5c6470';
    ctx.fillRect(width * 0.54, fy, width * 0.31, height * 0.036);
    ctx.fillStyle = '#f0a26b';
    ctx.fillRect(width * 0.54, fy, width * 0.15, height * 0.009);
  }
  ctx.restore();

  applyPhotographicGrain(ctx, width, height, 15);
  return canvas;
}

/**
 * Sample 3: Botanical Macro
 * High-detail organic phyllotaxis rosette with emerald gradients and sharp leaf edges.
 */
function createBotanicalMacroSample(): HTMLCanvasElement {
  const width = 1440;
  const height = 1800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    width * 0.05,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );
  bg.addColorStop(0, '#142c24');
  bg.addColorStop(0.55, '#091612');
  bg.addColorStop(1, '#030706');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.48;
  const goldenAngle = 137.507764 * (Math.PI / 180);
  const totalLeaves = 88;

  for (let i = totalLeaves; i >= 1; i--) {
    const t = i / totalLeaves;
    const angle = i * goldenAngle;
    const dist = Math.pow(t, 0.72) * (width * 0.44);
    const lx = cx + Math.cos(angle) * dist;
    const ly = cy + Math.sin(angle) * dist;

    const leafLen = width * (0.075 + t * 0.165);
    const leafWid = leafLen * (0.44 - t * 0.08);

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + Math.PI * 0.5);

    ctx.fillStyle = 'rgba(2, 6, 5, 0.72)';
    ctx.beginPath();
    ctx.moveTo(0, -leafLen * 0.65);
    ctx.quadraticCurveTo(leafWid * 0.9, 0, 0, leafLen * 0.48);
    ctx.quadraticCurveTo(-leafWid * 0.9, 0, 0, -leafLen * 0.65);
    ctx.fill();

    const leafGrad = ctx.createLinearGradient(0, leafLen * 0.4, 0, -leafLen * 0.62);
    leafGrad.addColorStop(0, '#081f18');
    leafGrad.addColorStop(0.38, '#156649');
    leafGrad.addColorStop(0.74, '#4fd69c');
    leafGrad.addColorStop(0.91, '#e85d75');
    leafGrad.addColorStop(1, '#ffccd5');

    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.moveTo(0, -leafLen * 0.62);
    ctx.quadraticCurveTo(leafWid * 0.82, -leafLen * 0.05, 0, leafLen * 0.42);
    ctx.quadraticCurveTo(-leafWid * 0.82, -leafLen * 0.05, 0, -leafLen * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = t < 0.35 ? '#fff0f3' : 'rgba(205, 255, 230, 0.82)';
    ctx.lineWidth = 2.5 + (1 - t) * 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -leafLen * 0.58);
    ctx.lineTo(0, leafLen * 0.25);
    ctx.stroke();

    ctx.restore();
  }

  applyPhotographicGrain(ctx, width, height, 13);
  return canvas;
}

/**
 * Sample 4: Classical Still Life
 * Minimalist studio composition of an alabaster sphere and architectural arch/plinth over a perspective grid.
 */
function createClassicalSculptureSample(): HTMLCanvasElement {
  const width = 1500;
  const height = 1500;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const horizonY = height * 0.62;

  // Warm studio plaster backdrop gradient
  const sky = ctx.createLinearGradient(0, 0, width, horizonY);
  sky.addColorStop(0, '#141210');
  sky.addColorStop(0.55, '#2b2520');
  sky.addColorStop(1, '#635346');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY);

  // Classical Monolithic Arch in background left
  ctx.save();
  const archGrad = ctx.createLinearGradient(width * 0.14, height * 0.12, width * 0.48, horizonY);
  archGrad.addColorStop(0, '#ded6c8');
  archGrad.addColorStop(0.7, '#9e9283');
  archGrad.addColorStop(1, '#5e554b');
  ctx.fillStyle = archGrad;
  ctx.fillRect(width * 0.14, height * 0.12, width * 0.34, horizonY - height * 0.12);

  // Deep shadow side of the arch block
  ctx.fillStyle = '#241f1c';
  ctx.beginPath();
  ctx.moveTo(width * 0.48, height * 0.12);
  ctx.lineTo(width * 0.55, height * 0.16);
  ctx.lineTo(width * 0.55, horizonY);
  ctx.lineTo(width * 0.48, horizonY);
  ctx.closePath();
  ctx.fill();

  // Recessed Roman arch cutout with inner sunlit reveal
  ctx.fillStyle = '#120f0d';
  ctx.beginPath();
  ctx.arc(width * 0.31, height * 0.34, width * 0.095, Math.PI, 0, false);
  ctx.lineTo(width * 0.405, horizonY);
  ctx.lineTo(width * 0.215, horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#b8ab99';
  ctx.beginPath();
  ctx.arc(width * 0.335, height * 0.34, width * 0.085, -Math.PI * 0.45, 0, false);
  ctx.lineTo(width * 0.42, horizonY);
  ctx.lineTo(width * 0.385, horizonY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Perspective stone tile studio floor below horizonY
  const floorHeight = height - horizonY;
  const numRows = 14;
  const numCols = 16;
  for (let r = 0; r < numRows; r++) {
    const z0 = Math.pow(r / numRows, 1.8);
    const z1 = Math.pow((r + 1) / numRows, 1.8);
    const y0 = horizonY + z0 * floorHeight;
    const y1 = horizonY + z1 * floorHeight;

    const spread0 = 0.45 + z0 * 2.2;
    const spread1 = 0.45 + z1 * 2.2;

    for (let c = -numCols / 2; c < numCols / 2; c++) {
      const x0Left = width * 0.5 + (c / (numCols / 2)) * (width * 0.5) * spread0;
      const x0Right = width * 0.5 + ((c + 1) / (numCols / 2)) * (width * 0.5) * spread0;
      const x1Right = width * 0.5 + ((c + 1) / (numCols / 2)) * (width * 0.5) * spread1;
      const x1Left = width * 0.5 + (c / (numCols / 2)) * (width * 0.5) * spread1;

      const isLight = (r + c + 100) % 2 === 0;
      ctx.fillStyle = isLight ? '#d4cbbd' : '#26221e';
      ctx.beginPath();
      ctx.moveTo(x0Left, y0);
      ctx.lineTo(x0Right, y0);
      ctx.lineTo(x1Right, y1);
      ctx.lineTo(x1Left, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Architectural Stone Plinth under the Alabaster Sphere
  ctx.save();
  ctx.fillStyle = '#dfd7c9';
  ctx.fillRect(width * 0.38, height * 0.67, width * 0.32, height * 0.12);
  ctx.fillStyle = '#29231e';
  ctx.beginPath();
  ctx.moveTo(width * 0.7, height * 0.67);
  ctx.lineTo(width * 0.78, height * 0.63);
  ctx.lineTo(width * 0.78, height * 0.75);
  ctx.lineTo(width * 0.7, height * 0.79);
  ctx.closePath();
  ctx.fill();

  // Cast shadow on plinth and floor
  const shadow = ctx.createRadialGradient(
    width * 0.6,
    height * 0.67,
    20,
    width * 0.62,
    height * 0.68,
    width * 0.26
  );
  shadow.addColorStop(0, 'rgba(10, 8, 7, 0.92)');
  shadow.addColorStop(0.55, 'rgba(10, 8, 7, 0.55)');
  shadow.addColorStop(1, 'rgba(10, 8, 7, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(width * 0.61, height * 0.67, width * 0.25, height * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted Alabaster Sphere with Chiaroscuro Form Shadow & Reflected Plinth Bounce
  const cx = width * 0.54;
  const cy = height * 0.45;
  const r = width * 0.22;
  const orb = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.38, r * 0.04, cx, cy, r);
  orb.addColorStop(0, '#fffdf9');
  orb.addColorStop(0.24, '#f0e8da');
  orb.addColorStop(0.54, '#a69886');
  orb.addColorStop(0.78, '#2b241e'); // Core terminator shadow
  orb.addColorStop(0.94, '#6e5f50'); // Warm reflected bounce light from plinth
  orb.addColorStop(1, '#bfb29f');
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  applyPhotographicGrain(ctx, width, height, 13);
  return canvas;
}

/**
 * Sample 5: Night Rain Reflections
 * Atmospheric urban night photography with warm sodium-vapor streetlamps and wet pavement reflections.
 */
function createNightRainStreetSample(): HTMLCanvasElement {
  const width = 1600;
  const height = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const horizonY = height * 0.58;

  // Deep atmospheric night sky & mist
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, '#05070b');
  skyGrad.addColorStop(0.55, '#101824');
  skyGrad.addColorStop(1, '#2b2520');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizonY);

  // Perspective historic urban building silhouettes left & right
  ctx.fillStyle = '#090c12';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.38, horizonY * 0.28);
  ctx.lineTo(width * 0.38, horizonY);
  ctx.lineTo(0, horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0b0e15';
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.62, horizonY * 0.24);
  ctx.lineTo(width * 0.62, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // Warm golden fog core at the vanishing point
  const fogGrad = ctx.createRadialGradient(
    width * 0.5,
    horizonY * 0.78,
    18,
    width * 0.5,
    horizonY * 0.78,
    width * 0.36
  );
  fogGrad.addColorStop(0, 'rgba(255, 210, 145, 0.85)');
  fogGrad.addColorStop(0.4, 'rgba(235, 140, 75, 0.38)');
  fogGrad.addColorStop(1, 'rgba(10, 14, 22, 0)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, width, horizonY);

  // Warm illuminated architectural windows & sodium streetlamps
  const lamps = [
    { x: 0.13, y: 0.18, w: 0.1, h: 0.3, color: '#ff9d3b' },
    { x: 0.26, y: 0.26, w: 0.08, h: 0.24, color: '#ffd280' },
    { x: 0.66, y: 0.2, w: 0.09, h: 0.28, color: '#ffb040' },
    { x: 0.79, y: 0.14, w: 0.11, h: 0.34, color: '#ffe5b4' },
  ];

  ctx.save();
  for (const l of lamps) {
    const lx = width * l.x;
    const ly = height * l.y;
    const lw = width * l.w;
    const lh = height * l.h;

    // Warm window glow & mullions
    ctx.shadowColor = l.color;
    ctx.shadowBlur = 32;
    ctx.fillStyle = l.color;
    ctx.fillRect(lx, ly, lw, lh);

    // Classic architectural window muntin bars
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0e15';
    ctx.fillRect(lx + lw * 0.47, ly, lw * 0.06, lh);
    for (let b = 1; b <= 3; b++) {
      ctx.fillRect(lx, ly + (lh * b) / 4, lw, 6);
    }
  }
  ctx.restore();

  // Wet Rain-Slicked Asphalt Street (horizonY..height)
  const streetGrad = ctx.createLinearGradient(0, horizonY, 0, height);
  streetGrad.addColorStop(0, '#141418');
  streetGrad.addColorStop(0.5, '#0b0d12');
  streetGrad.addColorStop(1, '#050608');
  ctx.fillStyle = streetGrad;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  // Shimmering horizontal wet puddle reflections of the warm streetlamps
  ctx.save();
  for (const l of lamps) {
    const rx = width * (l.x + l.w * 0.5);
    const rw = width * l.w * 1.35;
    for (let row = 0; row < 28; row++) {
      const t = row / 28;
      const py = horizonY + t * (height - horizonY);
      const jitter = Math.sin(row * 1.9 + l.x * 12) * (18 * t);
      const streakW = rw * (0.4 + t * 0.9) * (0.65 + 0.35 * Math.cos(row * 2.7));
      ctx.fillStyle = row % 4 === 0 ? '#fff6e5' : l.color;
      ctx.globalAlpha = (1 - t * 0.52) * 0.68;
      ctx.fillRect(rx - streakW * 0.5 + jitter, py, streakW, 4 + t * 6);
    }
  }
  ctx.restore();

  applyPhotographicGrain(ctx, width, height, 14);
  return canvas;
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'sample-colosseum',
    name: 'Colosseum / Rome',
    subtitle: 'Stone, arches & Roman geometry',
    aspectLabel: '1.59:1',
    width: 1280,
    height: 806,
    sourceUrl: '/samples/colosseum-rome.jpg',
  },
  {
    id: 'sample-portrait',
    name: 'Editorial Portrait',
    subtitle: 'Chiaroscuro Studio Light',
    aspectLabel: '4:5',
    width: 1440,
    height: 1800,
    createCanvas: createEditorialPortraitSample,
  },
  {
    id: 'sample-architecture',
    name: 'Brutalist Monolith',
    subtitle: 'Board-Formed Concrete',
    aspectLabel: '4:3',
    width: 1600,
    height: 1200,
    createCanvas: createBrutalistMonolithSample,
  },
  {
    id: 'sample-botanical',
    name: 'Botanical Macro',
    subtitle: 'Phyllotaxis Rosette',
    aspectLabel: '4:5',
    width: 1440,
    height: 1800,
    createCanvas: createBotanicalMacroSample,
  },
  {
    id: 'sample-sculpture',
    name: 'Classical Still Life',
    subtitle: 'Alabaster Sphere & Arch',
    aspectLabel: '1:1',
    width: 1500,
    height: 1500,
    createCanvas: createClassicalSculptureSample,
  },
  {
    id: 'sample-night-street',
    name: 'Night Rain Reflections',
    subtitle: 'Wet Asphalt & Sodium Light',
    aspectLabel: '4:3',
    width: 1600,
    height: 1200,
    createCanvas: createNightRainStreetSample,
  },
];
