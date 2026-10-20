import { type FilterSpec, isEmergency, matchesFilter } from '@skywake/shared';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { CORRECTION_S, type LiveStore, MAX_EXTRAPOLATION_S } from '../data/liveStore';
import { aircraftRgb, type ColorMode } from './colors';
import { buildAtlas, ICON_COUNT, ICON_SIZE, iconFor } from './icons';

const VS = `#version 300 es
precision highp float;
uniform mat4 u_matrix;
uniform vec2 u_viewport;
uniform float u_now;
uniform float u_bearing;
uniform float u_world;
uniform float u_scale;
in vec2 a_corner;
in vec2 a_pos;
in vec2 a_vel;
in vec2 a_times;
in vec2 a_corr;
in vec4 a_misc;
in vec4 a_color;
out vec2 v_uv;
out vec4 v_color;
out float v_sel;
void main() {
  float dt = clamp(u_now - a_times.x, 0.0, ${MAX_EXTRAPOLATION_S.toFixed(1)});
  float k = max(0.0, 1.0 - (u_now - a_times.y) / ${CORRECTION_S.toFixed(2)});
  vec2 p = a_pos + a_vel * dt + a_corr * k;
  p.x += u_world;
  vec4 clip = u_matrix * vec4(p, 0.0, 1.0);
  float ang = a_misc.x - u_bearing;
  float cs = cos(ang);
  float sn = sin(ang);
  vec2 c = a_corner;
  vec2 r = vec2(c.x * cs + c.y * sn, -c.x * sn + c.y * cs);
  float size = a_misc.z * u_scale * (a_misc.w > 0.5 ? 1.35 : 1.0);
  clip.xy += r * size / u_viewport * 2.0 * clip.w;
  gl_Position = clip;
  v_uv = vec2((a_misc.y + c.x * 0.5 + 0.5) / ${ICON_COUNT.toFixed(1)}, 0.5 - c.y * 0.5);
  v_color = a_color;
  v_sel = a_misc.w;
}`;

const FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_outline;
uniform vec3 u_selOutline;
in vec2 v_uv;
in vec4 v_color;
in float v_sel;
out vec4 o;
void main() {
  vec4 t = texture(u_tex, v_uv);
  float fill = t.r;
  float line = t.g * (1.0 - fill);
  vec3 outline = v_sel > 0.5 ? u_selOutline : u_outline;
  float a = fill + line;
  if (a < 0.01) discard;
  o = vec4(v_color.rgb * fill + outline * line, a);
}`;

/** Floats per instance: pos2 vel2 times2 corr2 misc4. */
const STRIDE = 12;

export interface LayerOptions {
  filter: FilterSpec;
  colorMode: ColorMode;
  dark: boolean;
}

/**
 * Renders every aircraft as an instanced, GPU-extrapolated quad. CPU work happens only
 * when data or filters change (rebuild instance buffers); per-frame cost is one draw call.
 */
export class AircraftLayer implements CustomLayerInterface {
  readonly id = 'skywake-aircraft';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private map!: MlMap;
  private gl!: WebGL2RenderingContext;
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private inst!: WebGLBuffer;
  private colorBuf!: WebGLBuffer;
  private tex!: WebGLTexture;
  private count = 0;
  private builtVersion = -1;
  private dirty = true;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private epoch = performance.now() / 1000;
  private lastRepaint = 0;
  private repaintPending = false;
  private maxSpeed = 0;
  /** Hex codes currently drawn, in draw order (for hit testing and counts). */
  visible: string[] = [];

  constructor(
    private store: LiveStore,
    private opts: LayerOptions,
  ) {}

  setOptions(o: Partial<LayerOptions>) {
    this.opts = { ...this.opts, ...o };
    this.dirty = true;
    this.map?.triggerRepaint();
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    this.prog = prog;
    for (const u of ['u_matrix', 'u_viewport', 'u_now', 'u_bearing', 'u_world', 'u_scale', 'u_tex', 'u_outline', 'u_selOutline']) {
      this.loc[u] = gl.getUniformLocation(prog, u);
    }

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aCorner = gl.getAttribLocation(prog, 'a_corner');
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

    this.inst = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const attrs: [string, number, number][] = [['a_pos', 2, 0], ['a_vel', 2, 2], ['a_times', 2, 4], ['a_corr', 2, 6], ['a_misc', 4, 8]];
    for (const [name, size, off] of attrs) {
      const l = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4);
      gl.vertexAttribDivisor(l, 1);
    }
    this.colorBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    const aColor = gl.getAttribLocation(prog, 'a_color');
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.vertexAttribDivisor(aColor, 1);
    gl.bindVertexArray(null);

    const atlas = buildAtlas(window.devicePixelRatio || 1);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  onRemove(_map: MlMap, gl: WebGL2RenderingContext) {
    gl.deleteProgram(this.prog);
    gl.deleteBuffer(this.inst);
    gl.deleteBuffer(this.colorBuf);
    gl.deleteTexture(this.tex);
    gl.deleteVertexArray(this.vao);
  }

  /** Rebuild instance buffers from the store. Selected aircraft is drawn last (on top). */
  private rebuild() {
    const gl = this.gl;
    const list = [...this.store.aircraft.values()].filter((t) => t.ac.hex === this.store.selected || matchesFilter(t.ac, this.opts.filter));
    const selIdx = list.findIndex((t) => t.ac.hex === this.store.selected);
    if (selIdx >= 0 && selIdx !== list.length - 1) list.push(list.splice(selIdx, 1)[0]!);
    const f = new Float32Array(list.length * STRIDE);
    const c = new Uint8Array(list.length * 4);
    let maxV = 0;
    this.visible = Array.from({ length: list.length }, () => '');
    for (let i = 0; i < list.length; i++) {
      const t = list[i]!;
      const o = i * STRIDE;
      f[o] = t.mx;
      f[o + 1] = t.my;
      f[o + 2] = t.vx;
      f[o + 3] = t.vy;
      f[o + 4] = t.baseT - this.epoch;
      f[o + 5] = t.corrT - this.epoch;
      f[o + 6] = t.corrX;
      f[o + 7] = t.corrY;
      f[o + 8] = ((t.ac.track ?? 0) * Math.PI) / 180;
      const icon = iconFor(t.ac);
      f[o + 9] = icon;
      f[o + 10] = ICON_SIZE[icon];
      f[o + 11] = t.ac.hex === this.store.selected ? 1 : 0;
      const rgb = aircraftRgb(t.ac, this.opts.colorMode, isEmergency(t.ac));
      c[i * 4] = rgb[0];
      c[i * 4 + 1] = rgb[1];
      c[i * 4 + 2] = rgb[2];
      c[i * 4 + 3] = 255;
      maxV = Math.max(maxV, Math.hypot(t.vx, t.vy));
      this.visible[i] = t.ac.hex;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, c, gl.DYNAMIC_DRAW);
    this.count = list.length;
    this.maxSpeed = maxV;
    this.builtVersion = this.store.version;
    this.dirty = false;
  }

  render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (this.dirty || this.builtVersion !== this.store.version) this.rebuild();
    if (this.count > 0) {
      const map = this.map;
      const zoom = map.getZoom();
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.uniformMatrix4fv(this.loc.u_matrix!, false, args.defaultProjectionData.mainMatrix as Float32Array);
      gl.uniform2f(this.loc.u_viewport!, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(this.loc.u_now!, performance.now() / 1000 - this.epoch);
      gl.uniform1f(this.loc.u_bearing!, (map.getBearing() * Math.PI) / 180);
      // Icons grow gently with zoom; DPR keeps them the same CSS size on dense screens.
      const zScale = Math.min(1.25, Math.max(0.55, 0.55 + (zoom - 2) * 0.09));
      gl.uniform1f(this.loc.u_scale!, zScale * (window.devicePixelRatio || 1));
      gl.uniform3fv(this.loc.u_outline!, this.opts.dark ? [0.05, 0.07, 0.1] : [1, 1, 1]);
      gl.uniform3fv(this.loc.u_selOutline!, this.opts.dark ? [1, 0.84, 0.3] : [0.1, 0.12, 0.16]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(this.loc.u_tex!, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const worlds = zoom < 3.5 ? [-1, 0, 1] : [0];
      for (const w of worlds) {
        gl.uniform1f(this.loc.u_world!, w);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
      }
      gl.bindVertexArray(null);
    }
    this.scheduleRepaint();
  }

  /**
   * Repaint only as often as icons visibly move (≥ ~0.4 px), capped at display rate.
   * Saves battery at low zoom where aircraft crawl across the screen.
   */
  private scheduleRepaint() {
    if (this.repaintPending) return;
    this.repaintPending = true;
    const map = this.map;
    const worldPx = 512 * 2 ** map.getZoom();
    const pxPerSec = this.maxSpeed * worldPx;
    const interval = pxPerSec <= 0 ? 1000 : Math.min(1000, (0.4 / pxPerSec) * 1000);
    const now = performance.now();
    const wait = Math.max(0, this.lastRepaint + interval - now);
    const fire = () => {
      this.repaintPending = false;
      this.lastRepaint = performance.now();
      map.triggerRepaint();
    };
    if (wait < 8) requestAnimationFrame(fire);
    else setTimeout(fire, wait);
  }
}
