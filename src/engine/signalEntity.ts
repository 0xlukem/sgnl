/** A procedural signal sculpture. No photographs, video files or remote assets. */
const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uVariant;
mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cycle() { return uTime * 0.5235987756; }
float chapter() { return floor(mod(uTime, 12.0) / 4.0); }
float rupture() { return 1.0 - smoothstep(0.08, 0.24, mod(uTime, 4.0)); }
float box(vec3 p, vec3 bounds) { vec3 q = abs(p) - bounds; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
vec3 fold(vec3 p) {
  p.xy = turn(-0.38 + 0.12 * sin(cycle())) * p.xy;
  p.yz = turn(0.30 + 0.20 * sin(cycle())) * p.yz;
  p.xz = turn(cycle() + uVariant) * p.xz;
  return p;
}
float field(vec3 raw) {
  vec3 p = fold(raw);
  float tier = floor((p.y + 1.5) / 0.24);
  vec3 q = p;
  q.x += (hash(vec2(tier, 7.0)) - 0.5) * rupture() * 0.65;
  q.y = mod(p.y + 0.12, 0.24) - 0.12;
  q.xz = turn(tier * 0.20) * q.xz;
  float plates = max(box(q, vec3(0.75 + 0.22 * sin(tier * 0.9), 0.032, 0.48)), abs(p.y) - 1.38);
  float spine = box(p, vec3(0.095, 1.58, 0.095));
  if (chapter() < 0.5) return min(plates, spine);
  if (chapter() < 1.5) {
    float shell = abs((abs(p.x) + abs(p.y) + abs(p.z) - 1.72) * 0.57735) - 0.026;
    shell = max(shell, -box(p, vec3(1.7, 0.34, 1.7)));
    vec3 edge = p; edge.xy = turn(0.7854) * edge.xy;
    float braces = min(box(edge, vec3(1.48, 0.045, 0.045)), box(edge, vec3(0.045, 1.48, 0.045)));
    return min(shell, min(braces, spine));
  }
  vec3 broken = p;
  broken.xy = turn(-0.7854) * broken.xy;
  float bars = max(box(vec3(broken.x, mod(broken.y + 0.18, 0.36) - 0.18, broken.z), vec3(1.25, 0.052, 0.10)), abs(broken.y) - 0.92);
  float brackets = min(box(broken - vec3(-1.12, 0.0, 0.0), vec3(0.06, 1.18, 0.25)), box(broken - vec3(1.12, 0.0, 0.0), vec3(0.06, 1.18, 0.25)));
  return min(bars, brackets);
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(field(p + e.xyy) - field(p - e.xyy), field(p + e.yxy) - field(p - e.yxy), field(p + e.yyx) - field(p - e.yyx)));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float slice = floor(uv.y * 43.0);
  float tear = step(0.66, hash(vec2(slice, floor(uTime * 9.0)))) * rupture();
  uv.x += tear * (hash(vec2(slice, 2.0)) - 0.5) * 0.30;
  vec3 ro = vec3(0.0, 0.0, 4.9);
  vec3 rd = normalize(vec3(uv * 2.55, -4.1));
  float distance = 0.0;
  vec3 p = ro;
  bool hit = false;
  for (int i = 0; i < 74; i++) {
    p = ro + rd * distance;
    float d = field(p);
    if (d < 0.0018) { hit = true; break; }
    distance += d * 0.74;
    if (distance > 8.0) break;
  }
  vec3 color = vec3(0.0196, 0.0235, 0.0196);
  if (hit) {
    vec3 n = normalAt(p);
    vec3 local = fold(p);
    float light = max(0.0, dot(n, normalize(vec3(-1.0, 1.8, 2.5))));
    float rim = pow(1.0 - max(0.0, dot(n, -rd)), 2.0);
    float scan = pow(0.5 + 0.5 * cos(local.y * 145.0), 12.0);
    float data = pow(0.5 + 0.5 * cos(local.x * 96.0), 18.0);
    float specular = pow(max(0.0, dot(reflect(-normalize(vec3(-1.0, 1.8, 2.5)), n), -rd)), 20.0);
    vec3 violet = vec3(0.67, 0.43, 1.0);
    vec3 acid = vec3(0.765, 1.0, 0.208);
    vec3 bone = vec3(0.90, 0.91, 0.87);
    color = violet * (0.20 + light * 0.72) * (0.25 + scan * 0.75);
    color += acid * (rim * 0.60 + data * light * 0.30);
    color += bone * specular * 0.35;
    if (chapter() > 0.5 && chapter() < 1.5) color = mix(color * 0.6, acid * (0.45 + light * 0.55), max(scan, data));
    color += violet * tear * 0.45;
    color *= 0.94 + 0.06 * sin(gl_FragCoord.x * 0.08 + gl_FragCoord.y * 0.11 + cycle() * 2.0);
    // The structure crosses behind the type; its left side stays subdued for reading.
    color *= 0.24 + 0.76 * smoothstep(0.12, 0.64, gl_FragCoord.x / uResolution.x);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface SignalEntityRenderer {
  draw: (time: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function drawBrokenSignalFallback(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.fillStyle = '#050605';
  ctx.fillRect(0, 0, width, height);
  const angle = time * Math.PI / 6;
  const scale = height * 0.25;
  const project = (x: number, y: number, z: number) => {
    const xx = x * Math.cos(angle) - z * Math.sin(angle);
    const depth = x * Math.sin(angle) + z * Math.cos(angle);
    const yy = y * 0.92 - depth * 0.38;
    const factor = 4.5 / (4.5 + depth);
    return [width * 0.52 + (xx * 0.93 - yy * 0.36) * scale * factor, height * 0.5 + (xx * 0.36 + yy * 0.93) * scale * factor];
  };
  for (let tier = 0; tier < 12; tier++) {
    const y = (tier - 5.5) * 0.24;
    const half = 0.75 + Math.sin(tier * 0.9) * 0.22;
    ctx.beginPath();
    for (const [index, point] of [[-half, y, -0.48], [half, y, -0.48], [half, y, 0.48], [-half, y, 0.48], [-half, y, -0.48]].entries()) {
      const [x, yy] = project(point[0], point[1], point[2]);
      if (index === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = tier % 3 === 0 ? '#c3ff35' : '#b79aff';
    ctx.lineWidth = Math.max(1, width / 850);
    ctx.stroke();
  }
}

/** A geometry fallback also provides the source material for the real studio recipes. */
export function drawSignalSource(ctx: CanvasRenderingContext2D, width: number, height: number, variant = 0, time = 0) {
  ctx.fillStyle = '#050605';
  ctx.fillRect(0, 0, width, height);
  if (variant === 1) {
    for (let i = 28; i >= 0; i--) {
      const y = height * 0.20 + i * height * 0.019;
      const x = width * 0.49 + Math.sin(i * 0.22) * width * 0.13;
      const w = width * (0.26 + Math.sin(i * 0.16) * 0.05);
      const h = height * 0.085;
      ctx.fillStyle = '#43483e';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y + h * 0.6); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y + h * 0.4); ctx.fill();
      ctx.fillStyle = '#bfc7b1';
      ctx.beginPath(); ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.4); ctx.lineTo(x, y + h); ctx.fill();
      ctx.fillStyle = i % 6 === 0 ? '#c3ff35' : '#e2e5d9';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h * 0.65); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h * 0.6); ctx.fill();
    }
    return;
  }
  if (variant === 2) {
    for (let i = 0; i < 170; i++) {
      const v = i / 170;
      ctx.beginPath();
      for (let step = 0; step <= 220; step++) {
        const u = step / 220;
        const envelope = Math.pow(Math.sin(u * Math.PI), 0.7);
        const x = width * (0.08 + u * 0.84);
        const wave = Math.sin(u * 9 + v * 5 + time * 0.5) * 0.17 + Math.cos(u * 5 - v * 6) * 0.13;
        const y = height * (0.5 + ((v - 0.5) * 0.8 + wave) * envelope);
        if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 4 === 0 ? '#d2ff65' : `rgba(219,225,207,${0.28 + Math.sin(v * Math.PI) * 0.48})`;
      ctx.lineWidth = Math.max(0.65, width / 1200);
      ctx.stroke();
    }
    return;
  }
  const scale = Math.min(width, height) * 0.31;
  const turn = time * 0.22 + variant * 0.7;
  const rotate = (x: number, y: number, z: number) => {
    const xx = x * Math.cos(turn) - z * Math.sin(turn);
    const zz = x * Math.sin(turn) + z * Math.cos(turn);
    const yy = y * Math.cos(0.55) - zz * Math.sin(0.55);
    const depth = y * Math.sin(0.55) + zz * Math.cos(0.55);
    const perspective = 4.5 / (4.5 + depth);
    return [width * 0.5 + (xx * 0.88 - yy * 0.47) * scale * perspective, height * 0.5 + (xx * 0.47 + yy * 0.88) * scale * perspective, depth];
  };
  for (let line = 0; line < 124; line++) {
    const v = line / 124 * Math.PI * 2;
    ctx.beginPath();
    let depth = 0;
    for (let step = 0; step <= 200; step++) {
      const u = step / 200 * Math.PI * 2;
      const r = 1 + Math.sin(u * 3 + time * 0.3) * 0.18;
      const twist = u * 1.5 + time * 0.12;
      const a = Math.cos(v) * 0.48;
      const b = Math.sin(v) * 0.32;
      const qx = a * Math.cos(twist) - b * Math.sin(twist);
      const qy = a * Math.sin(twist) + b * Math.cos(twist);
      const point = rotate((r + qx) * Math.cos(u), qy, (r + qx) * Math.sin(u));
      if (step === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
      depth += point[2];
    }
    const light = Math.round(110 + (depth / 201 + 1.5) * 42);
    ctx.strokeStyle = variant === 1 ? `rgba(${light},${light},${light},0.72)` : `rgba(${light * 0.77},${light},${light * 0.46},0.72)`;
    ctx.lineWidth = Math.max(0.55, width / 1000);
    ctx.stroke();
  }
}

export function createSignalEntity(canvas: HTMLCanvasElement, variant = 0): SignalEntityRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const clock = gl.getUniformLocation(program, 'uTime');
  gl.uniform1f(gl.getUniformLocation(program, 'uVariant'), variant);
  return {
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
    },
    draw(time) {
      gl.uniform1f(clock, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
