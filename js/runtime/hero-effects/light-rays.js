/*
 * Wiki Hero Light Rays WebGL renderer.
 * Independently implemented with the native WebGL API for Stellar.
 */

'use strict';

const vertexShader = `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uRayPosition;
uniform vec2 uRayDirection;
uniform vec3 uRayColor;
uniform float uRaySpeed;
uniform float uLightSpread;
uniform float uRayLength;
uniform float uPulsating;
uniform float uFadeDistance;
uniform float uSaturation;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform float uNoiseAmount;
uniform float uDistortion;
uniform float uLightMode;

float hash21(vec2 point) {
  vec3 p = fract(vec3(point.xyx) * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

vec2 safeDirection(vec2 value, vec2 fallbackValue) {
  float magnitude = length(value);
  return magnitude > 0.0001 ? value / magnitude : fallbackValue;
}

void main() {
  vec2 point = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 baseDirection = safeDirection(uRayDirection, vec2(0.0, 1.0));
  vec2 mouseDirection = safeDirection(uMouse * uResolution - uRayPosition, baseDirection);
  vec2 direction = safeDirection(mix(baseDirection, mouseDirection, uMouseInfluence), baseDirection);
  vec2 perpendicular = vec2(-direction.y, direction.x);
  vec2 offset = point - uRayPosition;
  float distanceFromSource = length(offset);
  float forward = dot(offset, direction);
  float side = dot(offset, perpendicular);

  float spread = max(abs(uLightSpread), 0.001);
  float lengthScale = max(abs(uRayLength), 0.001);
  float fadeScale = max(abs(uFadeDistance), 0.001);
  float directionalExtent = max(abs(direction.x) * uResolution.x + abs(direction.y) * uResolution.y, 1.0);
  float lengthProgress = distanceFromSource / max(directionalExtent * lengthScale / 3.0, 1.0);
  float fadeProgress = distanceFromSource / max(directionalExtent * fadeScale, 1.0);
  float angularAlignment = forward / max(distanceFromSource, 0.001);
  float fan = pow(max(angularAlignment, 0.0), 1.25 / spread);
  float reach = 1.0 - smoothstep(0.08, 1.0, lengthProgress);
  float fade = 1.0 - smoothstep(0.12, 1.2, fadeProgress);

  float animatedTime = uTime * uRaySpeed;
  float wave = sin(distanceFromSource * 0.015 + animatedTime * 1.7);
  side += wave * uDistortion * max(uResolution.y * 0.12, 1.0);

  float beamWidth = max(distanceFromSource * (0.035 + spread * 0.12), 1.0);
  float beamCoordinate = side / beamWidth;
  float broadBeam = 0.3 + 0.7 * exp(-beamCoordinate * beamCoordinate * 0.32);
  float rayBands = 0.55
    + 0.14 * sin(beamCoordinate * 2.7 - animatedTime * 0.72)
    + 0.09 * sin(beamCoordinate * 6.1 + animatedTime * 0.41);
  rayBands = smoothstep(0.2, 0.9, rayBands);

  vec2 noisePoint = point / max(uResolution.y, 1.0) * 7.0;
  float grain = valueNoise(noisePoint + vec2(animatedTime * 0.08, -animatedTime * 0.05));
  float noiseFactor = mix(1.0, grain, uNoiseAmount);
  float pulse = mix(1.0, 0.82 + 0.18 * sin(animatedTime * 2.4), step(0.5, uPulsating));
  float intensity = clamp(fan * reach * fade * broadBeam * (0.68 + 0.32 * rayBands) * noiseFactor * pulse * 0.62, 0.0, 0.65);

  float gray = dot(uRayColor, vec3(0.299, 0.587, 0.114));
  vec3 saturatedColor = mix(vec3(gray), uRayColor, uSaturation);
  vec3 darkInk = mix(vec3(0.025), saturatedColor * 0.42, 0.7);
  vec3 outputColor = mix(saturatedColor, darkInk, step(0.5, uLightMode));
  gl_FragColor = vec4(outputColor, intensity);
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

  function normalizeParams(value, defaults) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      raysOrigin: typeof source.raysOrigin === 'string' ? source.raysOrigin : defaults.raysOrigin,
      raysColor: colorOrDefault(source.raysColor, defaults.raysColor),
      raysSpeed: finiteOrDefault(source.raysSpeed, defaults.raysSpeed),
      lightSpread: finiteOrDefault(source.lightSpread, defaults.lightSpread),
      rayLength: finiteOrDefault(source.rayLength, defaults.rayLength),
      pulsating: booleanOrDefault(source.pulsating, defaults.pulsating),
      fadeDistance: finiteOrDefault(source.fadeDistance, defaults.fadeDistance),
      saturation: finiteOrDefault(source.saturation, defaults.saturation),
      followMouse: booleanOrDefault(source.followMouse, defaults.followMouse),
      mouseInfluence: finiteOrDefault(source.mouseInfluence, defaults.mouseInfluence),
      noiseAmount: finiteOrDefault(source.noiseAmount, defaults.noiseAmount),
      distortion: finiteOrDefault(source.distortion, defaults.distortion),
      lightMode: booleanOrDefault(source.lightMode, defaults.lightMode)
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

  function placement(origin, width, height) {
    const outside = 0.2;
    if (origin === 'top-left') return { position: [0, -outside * height], direction: [0, 1] };
    if (origin === 'top-right') return { position: [width, -outside * height], direction: [0, 1] };
    if (origin === 'left') return { position: [-outside * width, 0.5 * height], direction: [1, 0] };
    if (origin === 'right') return { position: [(1 + outside) * width, 0.5 * height], direction: [-1, 0] };
    if (origin === 'bottom-left') return { position: [0, (1 + outside) * height], direction: [0, -1] };
    if (origin === 'bottom-center') return { position: [0.5 * width, (1 + outside) * height], direction: [0, -1] };
    if (origin === 'bottom-right') return { position: [width, (1 + outside) * height], direction: [0, -1] };
    return { position: [0.5 * width, -outside * height], direction: [0, 1] };
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
      'uTime', 'uResolution', 'uRayPosition', 'uRayDirection', 'uRayColor',
      'uRaySpeed', 'uLightSpread', 'uRayLength', 'uPulsating', 'uFadeDistance',
      'uSaturation', 'uMouse', 'uMouseInfluence', 'uNoiseAmount', 'uDistortion',
      'uLightMode'
    ];
    const locations = {};
    names.forEach(function (name) {
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
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      return;
    }
    if (!gl) return;

    let program;
    try {
      program = createProgram(gl);
    } catch (e) {
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
      return;
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
    gl.clearColor(0, 0, 0, 0);

    const color = hexToRgb(params.raysColor);
    gl.uniform3f(locations.uRayColor, color[0], color[1], color[2]);
    gl.uniform1f(locations.uRaySpeed, params.raysSpeed);
    gl.uniform1f(locations.uLightSpread, params.lightSpread);
    gl.uniform1f(locations.uRayLength, params.rayLength);
    gl.uniform1f(locations.uPulsating, params.pulsating ? 1 : 0);
    gl.uniform1f(locations.uFadeDistance, params.fadeDistance);
    gl.uniform1f(locations.uSaturation, params.saturation);
    gl.uniform1f(locations.uMouseInfluence, params.followMouse ? params.mouseInfluence : 0);
    gl.uniform1f(locations.uNoiseAmount, params.noiseAmount);
    gl.uniform1f(locations.uDistortion, params.distortion);
    gl.uniform1f(locations.uLightMode, params.lightMode ? 1 : 0);

    const smoothMouse = { x: 0.5, y: 0.5 };
    return Object.freeze({
      pointer: params.followMouse,
      resize(rect, devicePixelRatio) {
        const dpr = Math.min(devicePixelRatio, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width === width && canvas.height === height) return;
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(locations.uResolution, width, height);
        const ray = placement(params.raysOrigin, width, height);
        gl.uniform2f(locations.uRayPosition, ray.position[0], ray.position[1]);
        gl.uniform2f(locations.uRayDirection, ray.direction[0], ray.direction[1]);
      },
      render(time, pointer) {
        const targetX = pointer?.active === true ? pointer.x : 0.5;
        const targetY = pointer?.active === true ? pointer.y : 0.5;
        smoothMouse.x += (targetX - smoothMouse.x) * 0.08;
        smoothMouse.y += (targetY - smoothMouse.y) * 0.08;
        gl.uniform1f(locations.uTime, time * 0.001);
        gl.uniform2f(locations.uMouse, smoothMouse.x, smoothMouse.y);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy() {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) loseContext.loseContext();
      }
    });
  }
