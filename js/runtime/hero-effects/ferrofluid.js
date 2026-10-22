/*
 * Wiki Ferrofluid WebGL renderer.
 * Shader adapted from React Bits Ferrofluid: https://github.com/DavidHDev/react-bits
 * React Bits is MIT licensed; see THIRD-PARTY-NOTICES.md.
 */

'use strict';

const MAX_COLORS = 8;

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float iTime;

uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform int uColorCount;

uniform vec2 uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);
  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);
  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

function finiteOrDefault(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function colorOrDefault(value, fallback) {
  return typeof value === 'string' && /^#?[a-f\d]{6}$/i.test(value) ? value : fallback;
}

function colorsOrDefault(value, fallback) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_COLORS) return fallback.slice();
  if (value.some(item => typeof item !== 'string' || !/^#?[a-f\d]{6}$/i.test(item))) return fallback.slice();
  return value.slice();
}

function directionOrDefault(value, fallback) {
  return ['up', 'down', 'left', 'right'].includes(value) ? value : fallback;
}

function normalizeParams(value, defaults) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const explicitDpr = source.dpr === null ? null : finiteOrDefault(source.dpr, defaults.dpr);
  return {
    colors: colorsOrDefault(source.colors, defaults.colors),
    backgroundColor: colorOrDefault(source.backgroundColor, defaults.backgroundColor),
    speed: finiteOrDefault(source.speed, defaults.speed),
    scale: finiteOrDefault(source.scale, defaults.scale),
    turbulence: finiteOrDefault(source.turbulence, defaults.turbulence),
    fluidity: finiteOrDefault(source.fluidity, defaults.fluidity),
    rimWidth: finiteOrDefault(source.rimWidth, defaults.rimWidth),
    sharpness: finiteOrDefault(source.sharpness, defaults.sharpness),
    shimmer: finiteOrDefault(source.shimmer, defaults.shimmer),
    glow: finiteOrDefault(source.glow, defaults.glow),
    flowDirection: directionOrDefault(source.flowDirection, defaults.flowDirection),
    opacity: finiteOrDefault(source.opacity, defaults.opacity),
    mouseInteraction: booleanOrDefault(source.mouseInteraction, defaults.mouseInteraction),
    mouseStrength: finiteOrDefault(source.mouseStrength, defaults.mouseStrength),
    mouseRadius: finiteOrDefault(source.mouseRadius, defaults.mouseRadius),
    mouseDampening: finiteOrDefault(source.mouseDampening, defaults.mouseDampening),
    paused: booleanOrDefault(source.paused, defaults.paused),
    dpr: typeof explicitDpr === 'number' && explicitDpr > 0 ? explicitDpr : null,
    mixBlendMode: typeof source.mixBlendMode === 'string' && source.mixBlendMode.trim().length > 0
      ? source.mixBlendMode
      : defaults.mixBlendMode
  };
}

function hexToRgb(value) {
  const normalized = value.replace(/^#/, '');
  return [
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255
  ];
}

function prepareColors(colors) {
  const rgb = colors.map(hexToRgb);
  while (rgb.length < MAX_COLORS) rgb.push(rgb[rgb.length - 1].slice());
  return { values: rgb, count: colors.length };
}

function flowVector(direction) {
  if (direction === 'up') return [0, 1];
  if (direction === 'left') return [-1, 0];
  if (direction === 'right') return [1, 0];
  return [0, -1];
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  let fragment;
  try {
    fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  } catch (error) {
    gl.deleteShader(vertex);
    throw error;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function uniformLocations(gl, program) {
  const names = [
    'iResolution', 'iMouse', 'iTime',
    'uColor0', 'uColor1', 'uColor2', 'uColor3',
    'uColor4', 'uColor5', 'uColor6', 'uColor7', 'uColorCount',
    'uFlow', 'uSpeed', 'uScale', 'uTurbulence', 'uFluidity',
    'uRimWidth', 'uSharpness', 'uShimmer', 'uGlow', 'uOpacity',
    'uMouseEnabled', 'uMouseStrength', 'uMouseRadius'
  ];
  const locations = {};
  names.forEach(name => {
    locations[name] = gl.getUniformLocation(program, name);
  });
  return locations;
}

export function createRenderer(canvas, options, defaults) {
  if (!canvas) return null;
  const params = normalizeParams(options, defaults);

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    void error;
    return null;
  }
  if (!gl) return null;

  let program;
  try {
    program = createProgram(gl);
  } catch (error) {
    void error;
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) loseContext.loseContext();
    return null;
  }

  gl.useProgram(program);
  const locations = uniformLocations(gl, program);
  const buffer = gl.createBuffer();
  const position = gl.getAttribLocation(program, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
    3.0, -1.0,
    -1.0, 3.0
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const colors = prepareColors(params.colors);
  colors.values.forEach((color, index) => {
    const location = locations[`uColor${index}`];
    gl.uniform3f(location, color[0], color[1], color[2]);
  });
  const flow = flowVector(params.flowDirection);
  gl.uniform1i(locations.uColorCount, colors.count);
  gl.uniform2f(locations.uFlow, flow[0], flow[1]);
  gl.uniform1f(locations.uSpeed, params.speed);
  gl.uniform1f(locations.uScale, params.scale);
  gl.uniform1f(locations.uTurbulence, params.turbulence);
  gl.uniform1f(locations.uFluidity, params.fluidity);
  gl.uniform1f(locations.uRimWidth, params.rimWidth);
  gl.uniform1f(locations.uSharpness, params.sharpness);
  gl.uniform1f(locations.uShimmer, params.shimmer);
  gl.uniform1f(locations.uGlow, params.glow);
  gl.uniform1f(locations.uOpacity, params.opacity);
  gl.uniform1f(locations.uMouseEnabled, params.mouseInteraction ? 1 : 0);
  gl.uniform1f(locations.uMouseStrength, params.mouseStrength);
  gl.uniform1f(locations.uMouseRadius, params.mouseRadius);

  const previousMixBlendMode = canvas.style.mixBlendMode;
  if (params.mixBlendMode) canvas.style.mixBlendMode = params.mixBlendMode;

  const mouse = { x: 0, y: 0 };
  let lastTime = null;
  let rendered = false;
  return Object.freeze({
    pointer: params.mouseInteraction,
    resize(rect, devicePixelRatio) {
      const dpr = params.dpr || devicePixelRatio;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform3f(locations.iResolution, width, height, 1);
    },
    render(time, pointer) {
      if (params.paused && rendered) return;
      const targetX = pointer?.active === true ? pointer.x * canvas.width : 0;
      const targetY = pointer?.active === true ? (1 - pointer.y) * canvas.height : 0;
      if (params.mouseDampening <= 0 || lastTime === null) {
        mouse.x = targetX;
        mouse.y = targetY;
      } else {
        const elapsed = Math.max(0, (time - lastTime) / 1000);
        const factor = Math.min(1, 1 - Math.exp(-elapsed / Math.max(params.mouseDampening, 0.0001)));
        mouse.x += (targetX - mouse.x) * factor;
        mouse.y += (targetY - mouse.y) * factor;
      }
      lastTime = time;
      gl.uniform1f(locations.iTime, time * 0.001);
      gl.uniform2f(locations.iMouse, mouse.x, mouse.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rendered = true;
    },
    destroy() {
      canvas.style.mixBlendMode = previousMixBlendMode;
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    }
  });
}
