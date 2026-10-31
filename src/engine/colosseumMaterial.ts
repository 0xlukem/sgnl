export interface StoneMaterial {
  color: HTMLImageElement;
  normal: HTMLImageElement;
  surface: HTMLImageElement;
}

/** Local CC0 maps; a failed image keeps the geometry usable with a plain stone material. */
export async function prepareStoneMaterial(): Promise<StoneMaterial | null> {
  const load = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `/materials/colosseum/stone-${name}.webp`;
  });
  try {
    const [color, normal, surface] = await Promise.all([load('color'), load('normal'), load('arm')]);
    return { color, normal, surface };
  } catch {
    return null;
  }
}

export const STONE_FRAGMENT = `
precision highp float;
uniform sampler2D uStoneColor;
uniform sampler2D uStoneNormal;
uniform sampler2D uStoneSurface;
uniform sampler2D uShadow;
uniform float uTime;
varying vec3 vObjectPosition;
varying vec3 vObjectNormal;
varying vec3 vViewPosition;
varying vec4 vShadow;
varying float vOcclusion;
const float PI = 3.14159265359;
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
vec3 rotateNormal(vec3 n) {
  float phase=uTime*.4487989505;
  n.xz=turn(phase-.6)*n.xz; n.yz=turn(-.48)*n.yz; n.xy=turn(.025*sin(phase))*n.xy;
  return n;
}
float shadowDepth(vec2 uv) {
  return dot(texture2D(uShadow,uv),vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));
}
float visibility(float nDotL) {
  vec3 p=vShadow.xyz/vShadow.w*.5+.5;
  if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0||p.z>1.0) return 1.0;
  float bias=.0012+.0018*(1.0-nDotL);
  float sum=0.0;
  for(int x=0;x<2;x++) for(int y=0;y<2;y++) {
    vec2 offset=(vec2(float(x),float(y))-.5)/1024.0;
    sum+=step(p.z-bias,shadowDepth(p.xy+offset));
  }
  return sum*.25;
}
void main() {
  vec3 objectNormal=normalize(vObjectNormal);
  if(!gl_FrontFacing) objectNormal=-objectNormal;
  float angle=atan(vObjectPosition.x/1.92,vObjectPosition.z/1.46);
  bool horizontal=abs(objectNormal.y)>.65;
  vec2 uv=horizontal?vObjectPosition.xz*3.4:vec2(angle/(2.0*PI)*24.0,(vObjectPosition.y+.93)*3.4);
  vec3 albedo=pow(texture2D(uStoneColor,uv).rgb,vec3(2.2));
  vec3 surface=texture2D(uStoneSurface,uv).rgb;
  vec3 detail=texture2D(uStoneNormal,uv).rgb*2.0-1.0;
  detail.xy*=.38;
  vec3 tangent=horizontal?vec3(1.0,0.0,0.0):normalize(vec3(cos(angle)*1.92,0.0,-sin(angle)*1.46));
  if(abs(dot(tangent,objectNormal))>.95) tangent=vec3(0.0,1.0,0.0);
  tangent=normalize(tangent-objectNormal*dot(tangent,objectNormal));
  vec3 bitangent=normalize(cross(objectNormal,tangent));
  vec3 n=normalize(rotateNormal(tangent*detail.x+bitangent*detail.y+objectNormal*detail.z));
  vec3 light=normalize(vec3(-.7,1.4,2.1));
  vec3 view=normalize(vec3(0.0,0.0,5.6)-vViewPosition);
  vec3 halfVector=normalize(light+view);
  float nDotL=max(dot(n,light),0.0),nDotV=max(dot(n,view),.001);
  float nDotH=max(dot(n,halfVector),0.0),vDotH=max(dot(view,halfVector),0.0);
  float roughness=clamp(surface.g,.68,.98);
  float a=roughness*roughness,a2=a*a;
  float denominator=nDotH*nDotH*(a2-1.0)+1.0;
  float distribution=a2/(PI*denominator*denominator);
  float k=(roughness+1.0)*(roughness+1.0)/8.0;
  float geometry=nDotV/(nDotV*(1.0-k)+k)*nDotL/(nDotL*(1.0-k)+k);
  vec3 fresnel=vec3(.04)+.96*pow(1.0-vDotH,5.0);
  vec3 specular=distribution*geometry*fresnel/max(4.0*nDotV*nDotL,.001);
  float shadow=visibility(nDotL);
  float ao=mix(.4,1.0,surface.r)*vOcclusion;
  vec3 ambient=albedo*mix(vec3(.16,.17,.19),vec3(.38,.40,.43),max(n.y,0.0))*ao;
  vec3 direct=((1.0-fresnel)*albedo/PI+specular)*vec3(3.0,2.82,2.5)*nDotL*shadow;
  vec3 color=ambient+direct;
  // Exposure and display transfer happen before the ASCII / dither passes.
  color=1.0-exp(-color*1.25);
  gl_FragColor=vec4(pow(color,vec3(1.0/2.2)),1.0);
}
`;
