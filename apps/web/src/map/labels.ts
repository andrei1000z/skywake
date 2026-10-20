import type { Map as MlMap } from 'maplibre-gl';
import { type LiveStore, positionAt } from '../data/liveStore';

const MAX_LABELS = 300;
// Canvas fonts can't use CSS variables; keep in sync with --font-ui.
const LABEL_FONT = "600 11px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Callsign labels drawn on a 2D canvas above the map, positioned every frame with the same
 * extrapolation as the GPU layer so text never lags its icon. Simple grid-based decluttering.
 */
export class LabelOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  enabled = true;
  dark = false;
  private visible: () => string[];

  constructor(
    private map: MlMap,
    private store: LiveStore,
    visible: () => string[],
  ) {
    this.visible = visible;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'label-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    map.getCanvasContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    map.on('render', this.draw);
    map.on('resize', this.resize);
    this.resize();
  }

  destroy() {
    this.map.off('render', this.draw);
    this.map.off('resize', this.resize);
    this.canvas.remove();
  }

  private resize = () => {
    const c = this.map.getCanvas();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = c.clientWidth * dpr;
    this.canvas.height = c.clientHeight * dpr;
    this.canvas.style.width = `${c.clientWidth}px`;
    this.canvas.style.height = `${c.clientHeight}px`;
  };

  private draw = () => {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const zoom = this.map.getZoom();
    const sel = this.store.selected;
    const showAll = this.enabled && zoom >= 6;
    if (!showAll && !sel) return;
    ctx.scale(dpr, dpr);
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const nowS = performance.now() / 1000;
    const hexes = showAll ? this.visible() : [];
    const list = sel && !hexes.includes(sel) ? [...hexes, sel] : hexes;
    const cell = 24;
    const occupied = new Set<number>();
    const detail = zoom >= 8;
    ctx.font = LABEL_FONT;
    ctx.textBaseline = 'top';
    let drawn = 0;
    // Selected first so it always wins the declutter.
    const ordered = sel ? [sel, ...list.filter((x) => x !== sel)] : list;
    for (const hex of ordered) {
      if (drawn >= MAX_LABELS) break;
      const t = this.store.aircraft.get(hex);
      if (!t) continue;
      const p = positionAt(t, nowS);
      const lng = p.x * 360 - 180;
      const lat = (360 / Math.PI) * Math.atan(Math.exp(Math.PI - p.y * 2 * Math.PI)) - 90;
      const s = this.map.project([lng, lat]);
      if (s.x < -50 || s.y < -20 || s.x > w + 50 || s.y > h + 20) continue;
      const x = s.x + 14;
      const y = s.y - 6;
      const key = Math.floor(x / (cell * 3)) * 100000 + Math.floor(y / cell);
      const isSel = hex === sel;
      if (!isSel && occupied.has(key)) continue;
      occupied.add(key);
      const text = t.ac.callsign ?? t.ac.reg ?? t.ac.hex.toUpperCase();
      const sub = detail && t.ac.alt !== undefined && !t.ac.onGround ? `FL${String(Math.round(t.ac.alt / 100)).padStart(3, '0')}` : '';
      const tw = Math.max(ctx.measureText(text).width, sub ? ctx.measureText(sub).width : 0);
      const bh = sub ? 27 : 15;
      ctx.fillStyle = isSel ? (this.dark ? 'rgba(255,214,77,0.95)' : 'rgba(20,24,32,0.92)') : this.dark ? 'rgba(13,20,32,0.78)' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.roundRect(x - 3, y - 2, tw + 6, bh, 3);
      ctx.fill();
      ctx.fillStyle = isSel ? (this.dark ? '#141820' : '#fff') : this.dark ? '#e6ebf2' : '#1b2230';
      ctx.fillText(text, x, y);
      if (sub) {
        ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.fillText(sub, x, y + 13);
        ctx.font = LABEL_FONT;
      }
      drawn++;
    }
  };
}
