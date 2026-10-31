import { GLYPH_RAMPS } from './types';
import { prepareStoneMaterial, STONE_FRAGMENT } from './colosseumMaterial';
import type { StoneMaterial } from './colosseumMaterial';

export const ARCHITECTURE_DURATION = 14;
type Point = [number, number, number];
interface Face { points: [Point, Point, Point]; normal: Point; part: number; }
export interface ArchitectureAssets { atlas: HTMLCanvasElement; vertices: Float32Array; faces: Face[]; stone: StoneMaterial | null; }
export interface ArchitectureRenderer { resize(width: number, height: number, pixelRatio?: number): void; draw(time: number): void; dispose(): void; }

export function architecturePhase(time: number) {
  if (time < 1.6) return 'assemble';
  if (time < 3) return 'model';
  if (time < 5) return 'ascii';
  if (time < 7) return 'dither';
  if (time < 8.5) return 'braille';
  if (time < 11) return 'layers';
  return 'rebuild';
}

/** Actual geometry: elliptical arcades with open arches, intrados, cornices and stepped seating. */
function buildColosseum() {
  const faces: Face[] = [];
  const vertices: number[] = [];
  const triangle = (a: Point, b: Point, c: Point, part: number, occlusion = 1) => {
    const u = b.map((v, i) => v - a[i]), v = c.map((value, i) => value - a[i]);
    const cross: Point = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map(value => value / length) as Point;
    faces.push({ points: [a, b, c], normal, part });
    for (const point of [a, b, c]) vertices.push(...point, ...normal, part, occlusion);
  };
  const quad = (a: Point, b: Point, c: Point, d: Point, part: number, occlusion = 1) => { triangle(a, b, c, part, occlusion); triangle(a, c, d, part, occlusion); };
  const at = (angle: number, y: number, depth = 0): Point => [Math.sin(angle) * (1.92 - depth), y, Math.cos(angle) * (1.46 - depth)];
  const bays = 56, step = Math.PI * 2 / bays;
  for (let bay = 0; bay < bays; bay++) {
    const angle = bay * step;
    // Four complete architectural storeys, rather than radial wedges through the arena.
    let part = 0;
    const point = (offset: number, y: number, depth = 0) => at(angle + offset * step, y, depth);
    const block = (left: number, right: number, low: number, high: number, front: number, back: number, occlusion = 1) => {
      quad(point(left, low, front), point(right, low, front), point(right, high, front), point(left, high, front), part, occlusion);
      quad(point(right, low, back), point(left, low, back), point(left, high, back), point(right, high, back), part, occlusion);
      quad(point(left, high, front), point(right, high, front), point(right, high, back), point(left, high, back), part, occlusion);
      quad(point(left, low, back), point(right, low, back), point(right, low, front), point(left, low, front), part, occlusion * .7);
      quad(point(left, low, back), point(left, low, front), point(left, high, front), point(left, high, back), part, occlusion);
      quad(point(right, low, front), point(right, low, back), point(right, high, back), point(right, high, front), part, occlusion);
    };
    for (let level = 0; level < 3; level++) {
      if (level === 2 && bay > 2 && bay < 19) continue;
      part = level;
      const bottom = -0.93 + level * .53, top = bottom + .51, spring = bottom + .25, radius = .14;
      // Narrow pillars between each opening, with the wall's outer and inner faces.
      for (const [left, right] of [[-.5, -.34], [.34, .5]]) {
        quad(point(left, bottom), point(right, bottom), point(right, top), point(left, top), part);
        quad(point(right, bottom, .13), point(left, bottom, .13), point(left, top, .13), point(right, top, .13), part, .78);
      }
      for (let arc = 0; arc < 16; arc++) {
        const a = arc / 16 * Math.PI, b = (arc + 1) / 16 * Math.PI;
        const x1 = Math.cos(a) * .34, x2 = Math.cos(b) * .34;
        const y1 = spring + Math.sin(a) * radius, y2 = spring + Math.sin(b) * radius;
        quad(point(x2, y2), point(x1, y1), point(x1, top), point(x2, top), part);
        quad(point(x1, y1, .13), point(x2, y2, .13), point(x2, top, .13), point(x1, top, .13), part, .78);
        // The curved soffit makes each arch a hole through a thick wall.
        quad(point(x1, y1), point(x2, y2), point(x2, y2, .13), point(x1, y1, .13), part, .7);
      }
      for (const side of [-.34, .34]) quad(point(side, bottom), point(side, spring), point(side, spring, .13), point(side, bottom, .13), part, .72);
      // Tapered shafts, bases and capitals have actual volume and cast shadows.
      const columnAngle = angle - step * .48;
      const center = at(columnAngle, 0, -.018);
      const profiles = [[bottom, .034], [bottom + .035, .034], [bottom + .045, .023], [top - .055, .019], [top - .04, .036], [top, .036]];
      const column = (radius: number, y: number, theta: number): Point => [center[0] + Math.cos(theta) * radius, y, center[2] + Math.sin(theta) * radius];
      for (let ring = 0; ring < profiles.length - 1; ring++) {
        const [low, r1] = profiles[ring], [high, r2] = profiles[ring + 1];
        for (let side = 0; side < 10; side++) {
          const a = side / 10 * Math.PI * 2, b = (side + 1) / 10 * Math.PI * 2;
          quad(column(r1, low, a), column(r1, low, b), column(r2, high, b), column(r2, high, a), part);
        }
      }
      const y = top + .015;
      block(-.5, .5, y - .008, y + .014, -.035, .15, .9);
      block(-.5, .5, y + .014, y + .04, -.063, .15);
    }
    // The surviving attic stops at a damaged edge rather than forming a perfect ring.
    part = 3;
    if (bay >= 19 || bay <= 2) {
      const low = .70, high = 1.01 + Math.sin(bay * 17.3) * .012 + (bay % 9 === 0 ? -.055 : 0);
      if (bay % 2 === 0) {
        block(-.5, -.15, low, high, 0, .13);
        block(.15, .5, low, high, 0, .13);
        block(-.15, .15, low, .79, 0, .13);
        block(-.15, .15, .925, high, 0, .13);
      } else block(-.5, .5, low, high, 0, .13);
    }
    // Concentric stepped seating exposes the open arena as the camera turns.
    part = 0;
    const seat = (a: number, r: number, h: number): Point => [Math.sin(a) * r * 1.15, h, Math.cos(a) * r * .88];
    // Weld the upper seating rim to the lower arcade, rather than leaving an empty annulus.
    quad(at(angle - step / 2, -.37, .13), at(angle + step / 2, -.37, .13), seat(angle + step / 2, 1.26, -.37), seat(angle - step / 2, 1.26, -.37), part, .8);
    for (let ring = 0; ring < 9; ring++) {
      const outer = 1.26 - ring * .075, inner = outer - .075, y = -.37 - ring * .055;
      quad(seat(angle - step / 2, outer, y), seat(angle + step / 2, outer, y), seat(angle + step / 2, inner, y), seat(angle - step / 2, inner, y), part, .8);
      quad(seat(angle - step / 2, inner, y), seat(angle + step / 2, inner, y), seat(angle + step / 2, inner, y - .055), seat(angle - step / 2, inner, y - .055), part, .72);
    }
    const floor = (a: number): Point => seat(a, .585, -.91);
    quad(seat(angle - step / 2, .585, -.81), seat(angle + step / 2, .585, -.81), floor(angle + step / 2), floor(angle - step / 2), part, .72);
    triangle([0, -.91, 0], floor(angle - step / 2), floor(angle + step / 2), part);
    // One solid foundation supports the arena, seating and column feet as the upper floors open.
    const foundation = (a: number, y: number): Point => [Math.sin(a) * 2.0, y, Math.cos(a) * 1.54];
    const a = angle - step / 2, b = angle + step / 2;
    triangle([0, -.93, 0], foundation(a, -.93), foundation(b, -.93), part, .86);
    quad(foundation(a, -.93), foundation(a, -.995), foundation(b, -.995), foundation(b, -.93), part, .86);
    triangle([0, -.995, 0], foundation(b, -.995), foundation(a, -.995), part, .72);
  }
  return { vertices: new Float32Array(vertices), faces };
}

let assetsPromise: Promise<ArchitectureAssets> | undefined;
export function prepareArchitecture(): Promise<ArchitectureAssets> {
  return assetsPromise ??= Promise.all([document.fonts.ready, prepareStoneMaterial()]).then(([, stone]) => {
    // Power-of-two backing allows mipmaps to retain tiny Braille dots in motion.
    const atlas = document.createElement('canvas'); atlas.width = 512; atlas.height = 128;
    const ctx = atlas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.font = '700 30px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [GLYPH_RAMPS.ascii.chars, GLYPH_RAMPS.braille.chars].forEach((chars, row) => chars.forEach((character, index) => ctx.fillText(character, index * 32 + 16, row * 40 + 20)));
    return { atlas, stone, ...buildColosseum() };
  });
}

const MODEL_TRANSFORM = `
precision highp float;
attribute vec3 aPosition;
attribute float aPart;
uniform float uTime;
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
vec3 modelPosition() {
  float phase = uTime*0.4487989505;
  float split = smoothstep(8.5+(3.0-aPart)*.1,10.0,uTime)*(1.0-smoothstep(10.9+aPart*.05,12.0,uTime));
  float assembly = max(1.0-smoothstep(0.0,1.6,uTime),smoothstep(12.6,14.0,uTime));
  vec3 p = aPosition;
  // Keep the complete foundation fixed; only the three upper storeys lift.
  p.y += aPart*(split*.30+assembly*.95);
  p.xz = turn(phase-.6)*p.xz;
  p.yz = turn(-.48)*p.yz;
  p.xy = turn(.025*sin(phase))*p.xy;
  return p;
}
`;
const MODEL_VERTEX = `${MODEL_TRANSFORM}
attribute vec3 aNormal;
attribute float aOcclusion;
uniform vec2 uResolution;
uniform mat4 uLightMatrix;
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;
varying vec3 vViewPosition;
varying vec4 vShadow;
varying float vOcclusion;
void main() {
  vec3 p=modelPosition();
  float perspective = 5.6/(5.6-p.z);
  float aspect = uResolution.x/uResolution.y;
  float expansion=smoothstep(8.5,10.0,uTime)*(1.0-smoothstep(10.9,12.0,uTime));
  float scale = mix(.43,.59,smoothstep(1.2,2.0,aspect))*(1.0-expansion*.18);
  float placement = .22*smoothstep(1.5,2.1,aspect);
  gl_Position = vec4(p.x*perspective*scale/aspect+placement,p.y*perspective*scale+.035-expansion*.16,-p.z*.13,1.0);
  vObjectPosition=aPosition; vObjectNormal=aNormal; vViewPosition=p;
  vShadow=uLightMatrix*vec4(p,1.0); vOcclusion=aOcclusion;
}
`;
const SHADOW_VERTEX = `${MODEL_TRANSFORM}
uniform mat4 uLightMatrix;
void main() { gl_Position=uLightMatrix*vec4(modelPosition(),1.0); }
`;
const SHADOW_FRAGMENT = `
precision highp float;
void main() {
  vec4 encoded=fract(gl_FragCoord.z*vec4(1.0,255.0,65025.0,16581375.0));
  encoded-=encoded.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
  gl_FragColor=encoded;
}
`;
const SCREEN_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition*.5+.5; gl_Position=vec4(aPosition,0.0,1.0); }
`;
const SCREEN_FRAGMENT = `
precision highp float;
uniform sampler2D uModel;
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uResolution;
varying vec2 vUv;
float bayer2(vec2 p) { return mod(2.0*p.x+3.0*p.y,4.0); }
float bayer4(vec2 p) { return (4.0*bayer2(mod(p,2.0))+bayer2(floor(p/2.0)))/16.0; }
float signalNoise(float p) { return fract(sin(p*127.1)*43758.5453); }
float glyph(vec2 uv,vec2 size,float row,float count) {
  // Keep a 3 x 4 CSS-pixel grid regardless of the backing-buffer resolution.
  size = max(vec2(2.0),floor(size*uPixelRatio+.5));
  vec2 cell = floor(uv*uResolution/size);
  vec2 center = (cell+.5)*size/uResolution;
  vec2 offset = size*.28/uResolution;
  // Area sampling retains narrow arch edges as they move between cells.
  vec4 source = texture2D(uModel,center)*.4;
  source += texture2D(uModel,center+vec2(offset.x,offset.y))*.15;
  source += texture2D(uModel,center+vec2(-offset.x,offset.y))*.15;
  source += texture2D(uModel,center+vec2(offset.x,-offset.y))*.15;
  source += texture2D(uModel,center-offset)*.15;
  float luminance = dot(source.rgb,vec3(.2126,.7152,.0722))/max(source.a,.0001);
  float index = floor(pow(clamp(luminance,0.0,.999),.62)*count);
  vec2 pixel = fract(uv*uResolution/size);
  vec2 atlas = (vec2(index,row)+vec2(pixel.x,1.0-pixel.y))*vec2(32.0/512.0,40.0/128.0);
  float coverage = texture2D(uAtlas,atlas).a;
  return min(1.0,coverage*mix(1.15,1.8,row))*source.a;
}
void main() {
  vec2 uv=vUv;
  float transition = min(abs(uTime-3.0),min(abs(uTime-5.0),min(abs(uTime-7.0),min(abs(uTime-9.0),min(abs(uTime-10.15),abs(uTime-11.05))))));
  float burst=1.0-smoothstep(.035,.15,transition);
  float clock=floor(uTime*28.0),band=floor(uv.y*37.0);
  float tornBand=step(.48,signalNoise(band+clock*3.1));
  float displacement=(signalNoise(band*7.3+clock)-.5)*.15*burst*tornBand;
  uv.x += displacement;
  float missing=burst*step(.84,signalNoise(floor(vUv.x*13.0)+band*13.7+clock));
  vec4 source=texture2D(uModel,uv);
  float ascii=glyph(uv,vec2(3.0,4.0),0.0,10.0);
  float braille=glyph(uv,vec2(3.0,4.0),1.0,9.0);
  float luminance=dot(source.rgb,vec3(.2126,.7152,.0722));
  float dither=step(bayer4(mod(floor(uv*uResolution/2.0),4.0)),luminance)*source.a;
  float first=1.0-smoothstep(smoothstep(3.0,4.5,uTime)-.02,smoothstep(3.0,4.5,uTime)+.02,uv.x);
  float a=1.0-smoothstep(smoothstep(5.0,6.5,uTime)-.02,smoothstep(5.0,6.5,uTime)+.02,uv.x);
  float b=1.0-smoothstep(smoothstep(7.0,8.5,uTime)-.02,smoothstep(7.0,8.5,uTime)+.02,uv.x);
  float c=1.0-smoothstep(smoothstep(9.0,10.0,uTime)-.02,smoothstep(9.0,10.0,uTime)+.02,uv.x);
  vec3 acid=vec3(.765,1.0,.208),violet=vec3(.718,.604,1.0),paper=vec3(.9,.914,.871);
  float highlight=step(.78,luminance)*.4;
  vec3 asciiColor=mix(acid,paper,highlight),ditherColor=mix(violet,paper,highlight);
  vec3 raw=source.rgb*source.a;
  vec3 color=mix(mix(mix(mix(raw,asciiColor*ascii,first),ditherColor*dither,a),asciiColor*braille,b),raw,c);
  // Broken scan bands, dropped blocks and a chromatic echo affect only the model's signal.
  float echo=texture2D(uModel,uv+vec2(burst*.014,0.0)).a;
  float edge=max(0.0,echo-source.a);
  color=color*(1.0-missing)+violet*edge*burst*.55;
  color=mix(color,color.bgr,burst*tornBand*.36);
  float reading=.24+.76*smoothstep(.14,.58,uv.x);
  gl_FragColor=vec4(vec3(.0196,.0235,.0196)+color*reading,1.0);
}
`;

export function createGlyphArchitecture(canvas: HTMLCanvasElement, assets: ArchitectureAssets): ArchitectureRenderer | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shaders: WebGLShader[] = [], programs: WebGLProgram[] = [];
  const compileProgram = (vertex: string, fragment: string) => {
    const program = gl.createProgram()!; programs.push(program);
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!; shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { canvas.dataset.signalShaderError = gl.getShaderInfoLog(shader) ?? 'Shader compilation failed'; return null; }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { canvas.dataset.signalShaderError = gl.getProgramInfoLog(program) ?? 'Shader linking failed'; return null; }
    return program;
  };
  const model = compileProgram(MODEL_VERTEX, STONE_FRAGMENT), screen = compileProgram(SCREEN_VERTEX, SCREEN_FRAGMENT), shadow = compileProgram(SHADOW_VERTEX, SHADOW_FRAGMENT);
  if (!model || !screen || !shadow) { shaders.forEach(s => gl.deleteShader(s)); programs.forEach(p => gl.deleteProgram(p)); return null; }
  delete canvas.dataset.signalShaderError;
  gl.disable(gl.DITHER);
  const geometry = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, geometry); gl.bufferData(gl.ARRAY_BUFFER, assets.vertices, gl.STATIC_DRAW);
  const screenBuffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const createTexture = () => { const texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); return texture; };
  const rendered = createTexture(), atlas = createTexture();
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,assets.atlas);
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  const stoneTextures = [assets.stone?.color, assets.stone?.normal, assets.stone?.surface].map((image, index) => {
    const texture=createTexture();
    if(image) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    else {
      const pixels=[[190,179,157,255],[128,128,255,255],[255,220,0,255]][index];
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixels));
    }
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    return texture;
  });
  canvas.dataset.signalMaterial=assets.stone?'weathered-stone':'plain-stone';
  const shadowTexture=createTexture();
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,1024,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  const shadowFrame=gl.createFramebuffer()!,shadowDepth=gl.createRenderbuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFrame); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
  gl.bindRenderbuffer(gl.RENDERBUFFER,shadowDepth); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,1024,1024);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,shadowDepth); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const normalize=(v:number[])=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
  const light=normalize([-.7,1.4,2.1]),right=normalize([light[2],0,-light[0]]);
  const up=[light[1]*right[2],light[2]*right[0]-light[0]*right[2],-light[1]*right[0]];
  const lightMatrix=new Float32Array([right[0]/4.8,up[0]/4.8,-light[0]/5,0,right[1]/4.8,up[1]/4.8,-light[1]/5,0,right[2]/4.8,up[2]/4.8,-light[2]/5,0,0,0,0,1]);
  for(const program of [model,shadow]) { gl.useProgram(program); gl.uniformMatrix4fv(gl.getUniformLocation(program,'uLightMatrix'),false,lightMatrix); }
  gl.useProgram(model);
  ['uStoneColor','uStoneNormal','uStoneSurface','uShadow'].forEach((name,index)=>gl.uniform1i(gl.getUniformLocation(model,name),index+2));
  const frame = gl.createFramebuffer()!, depth = gl.createRenderbuffer()!;
  const uniforms = [model,screen,shadow].map(program => ({ time:gl.getUniformLocation(program,'uTime'), resolution:gl.getUniformLocation(program,'uResolution') }));
  const pixelRatioLocation = gl.getUniformLocation(screen,'uPixelRatio');
  const locations = { position:gl.getAttribLocation(model,'aPosition'), normal:gl.getAttribLocation(model,'aNormal'), part:gl.getAttribLocation(model,'aPart'), occlusion:gl.getAttribLocation(model,'aOcclusion'), screen:gl.getAttribLocation(screen,'aPosition'), shadowPosition:gl.getAttribLocation(shadow,'aPosition'), shadowPart:gl.getAttribLocation(shadow,'aPart') };
  const enable = (location:number,size:number,stride:number,offset:number) => { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride,offset); };
  let modelWidth=1,modelHeight=1;
  return {
    resize(width,height,pixelRatio=1) {
      canvas.width=Math.max(1,Math.round(width)); canvas.height=Math.max(1,Math.round(height));
      // Shade the stone at its own budget; the finer glyph grid keeps the full output resolution.
      const modelScale=Math.min(1,Math.sqrt(1100000/(canvas.width*canvas.height)));
      modelWidth=Math.max(1,Math.round(canvas.width*modelScale)); modelHeight=Math.max(1,Math.round(canvas.height*modelScale));
      gl.useProgram(screen); gl.uniform1f(pixelRatioLocation,pixelRatio);
      gl.bindTexture(gl.TEXTURE_2D,rendered); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,modelWidth,modelHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindRenderbuffer(gl.RENDERBUFFER,depth); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,modelWidth,modelHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,rendered,0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    },
    draw(time) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFrame); gl.useProgram(shadow); gl.viewport(0,0,1024,1024); gl.enable(gl.DEPTH_TEST);
      gl.clearColor(1,1,1,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER,geometry); enable(locations.shadowPosition,3,32,0); enable(locations.shadowPart,1,32,24);
      gl.uniform1f(uniforms[2].time,time); gl.drawArrays(gl.TRIANGLES,0,assets.vertices.length/8);
      gl.disableVertexAttribArray(locations.shadowPosition); gl.disableVertexAttribArray(locations.shadowPart);
      gl.viewport(0,0,modelWidth,modelHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame); gl.useProgram(model); gl.enable(gl.DEPTH_TEST); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      stoneTextures.forEach((texture,index)=>{gl.activeTexture(gl.TEXTURE2+index);gl.bindTexture(gl.TEXTURE_2D,texture);});
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
      gl.bindBuffer(gl.ARRAY_BUFFER,geometry); enable(locations.position,3,32,0); enable(locations.normal,3,32,12); enable(locations.part,1,32,24); enable(locations.occlusion,1,32,28);
      gl.uniform1f(uniforms[0].time,time); gl.uniform2f(uniforms[0].resolution,modelWidth,modelHeight); gl.drawArrays(gl.TRIANGLES,0,assets.vertices.length/8);
      gl.disableVertexAttribArray(locations.position); gl.disableVertexAttribArray(locations.normal); gl.disableVertexAttribArray(locations.part); gl.disableVertexAttribArray(locations.occlusion);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.useProgram(screen); gl.disable(gl.DEPTH_TEST);
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER,screenBuffer); enable(locations.screen,2,0,0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,rendered); gl.uniform1i(gl.getUniformLocation(screen,'uModel'),0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,atlas); gl.uniform1i(gl.getUniformLocation(screen,'uAtlas'),1);
      gl.uniform1f(uniforms[1].time,time); gl.uniform2f(uniforms[1].resolution,canvas.width,canvas.height); gl.drawArrays(gl.TRIANGLES,0,6); gl.disableVertexAttribArray(locations.screen);
    },
    dispose() { [geometry,screenBuffer].forEach(b=>gl.deleteBuffer(b)); [rendered,atlas,shadowTexture,...stoneTextures].forEach(t=>gl.deleteTexture(t)); [frame,shadowFrame].forEach(f=>gl.deleteFramebuffer(f)); [depth,shadowDepth].forEach(d=>gl.deleteRenderbuffer(d)); shaders.forEach(s=>gl.deleteShader(s)); programs.forEach(p=>gl.deleteProgram(p)); },
  };
}

const smooth = (a:number,b:number,t:number) => { const x=Math.max(0,Math.min(1,(t-a)/(b-a))); return x*x*(3-2*x); };
/** Software alternative still projects model vertices; it never substitutes a photograph. */
export function drawArchitectureFallback(ctx: CanvasRenderingContext2D, assets: ArchitectureAssets, time: number) {
  const {width,height}=ctx.canvas;
  ctx.fillStyle='#050605'; ctx.fillRect(0,0,width,height);
  const angle=time/14*Math.PI*2-.6, expansion=smooth(8.5,10,time)*(1-smooth(10.9,12,time));
  const assembly=Math.max(1-smooth(0,1.6,time),smooth(12.6,14,time));
  const style=time>=7&&time<9?1:0;
  for(let index=0;index<assets.faces.length;index+=3) {
    const face=assets.faces[index],p=face.points[0].map((v,i)=>(v+face.points[1][i]+face.points[2][i])/3);
    const split=smooth(8.5+(3-face.part)*.1,10,time)*(1-smooth(10.9+face.part*.05,12,time));
    p[1]+=face.part*(split*.30+assembly*.95);
    const x=p[0]*Math.cos(angle)+p[2]*Math.sin(angle),z=-p[0]*Math.sin(angle)+p[2]*Math.cos(angle);
    const y=p[1]*Math.cos(.48)-z*Math.sin(.48),depth=p[1]*Math.sin(.48)+z*Math.cos(.48),perspective=5.6/(5.6-depth);
    const scale=.295*(1-expansion*.18);
    const sx=width*.61+x*perspective*height*scale,sy=height*.4825-y*perspective*height*scale+expansion*height*.08;
    const glyph=Math.min(style?8:9,Math.floor((.3+Math.abs(face.normal[1])*.55)*10));
    ctx.globalAlpha=.35+Math.abs(face.normal[2])*.5;
    ctx.drawImage(assets.atlas,glyph*32,style*40,32,40,sx,sy,7,9);
  }
  ctx.globalAlpha=1;
}
