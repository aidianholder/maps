// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

/**
 * CustomExportControl — drop-in replacement for MaplibreExportControl.
 *
 * Adds a "Custom size" option and a live overlay showing the exact export area.
 * Reuses MapGeneratorBase from @watergis/maplibre-gl-export for all DPI
 * scaling, canvas rendering, and PDF/PNG/JPEG/SVG output.
 */
import maplibregl from 'maplibre-gl';
import { getDrawPanel } from './draw-panel.js';
import {
  MapGeneratorBase,
  Size,
  DPI,
  Format,
  PageOrientation,
  Unit,
} from '@watergis/maplibre-gl-export';

// MapGenerator is not a named export — subclass MapGeneratorBase with the
// MapLibre-specific implementation the package uses internally.
class MapGenerator extends MapGeneratorBase {
  generate() {
    // MapGeneratorBase.generate() calls Object.defineProperty(window, 'devicePixelRatio', ...)
    // twice — once to set a high-DPI value, once to restore the original — but neither descriptor
    // sets configurable:true. The second call therefore throws (redefining a non-configurable
    // property), which kills exportImage before hideLoader() runs, leaving the spinner forever.
    //
    // Fix: patch Object.defineProperty so any write to window.devicePixelRatio is configurable,
    // then restore the real Object.defineProperty once hideLoader signals the export is done.
    const realDefProp = Object.defineProperty;
    Object.defineProperty = function(obj, prop, desc) {
      if (obj === window && prop === 'devicePixelRatio') {
        desc = { ...desc, configurable: true };
      }
      return realDefProp.call(Object, obj, prop, desc);
    };

    const realHideLoader = this.hideLoader.bind(this);
    this.hideLoader = () => {
      Object.defineProperty = realDefProp;
      realHideLoader();
    };

    super.generate();
  }

  getRenderedMap(container, style) {
    const visMap = this.map;
    const visW   = visMap.getContainer().offsetWidth  || 1;
    const visH   = visMap.getContainer().offsetHeight || 1;

    // Compute the overlay rectangle's geographic bounds so the hidden map can
    // render exactly what the preview shows — no zoom arithmetic needed.
    const expCssW   = (96 / 25.4) * this.width;
    const expCssH   = (96 / 25.4) * this.height;
    const overlaySc = Math.min(1, visW / expCssW, visH / expCssH);
    const rW = expCssW * overlaySc;
    const rH = expCssH * overlaySc;
    const rx = (visW - rW) / 2;
    const ry = (visH - rH) / 2;

    // Unproject all four corners of the overlay rectangle
    const sw = visMap.unproject([rx,      ry + rH]);  // bottom-left
    const ne = visMap.unproject([rx + rW, ry      ]);  // top-right

    const hiddenMap = new maplibregl.Map({
      container,
      style,
      center:  visMap.getCenter(),
      zoom:    visMap.getZoom(),
      bearing: visMap.getBearing(),
      pitch:   visMap.getPitch(),
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      attributionControl: false,
    });

    // Once the hidden map loads, snap it to exactly the overlay bounds.
    // This listener fires before MapGeneratorBase's own 'load' handler because
    // it is registered first (getRenderedMap is called before generate() attaches
    // its listener), so fitBounds runs synchronously before idle is awaited.
    hiddenMap.once('load', () => {
      hiddenMap.fitBounds([sw, ne], {
        padding:  0,
        animate:  false,
        bearing:  visMap.getBearing(),
        pitch:    visMap.getPitch(),
      });
    });

    return hiddenMap;
  }

  // Return empty collection → skips the default red-circle marker path entirely.
  getMarkers() {
    return document.createElement('div').getElementsByClassName('__no_match__');
  }

  // Suppress north arrow and attribution on the exported map.
  addNorthIconToMap(_map) { return Promise.resolve(); }
  addAttributions(_map)   { return false; }

  renderMapPost(map) {
    const terrain = this.map.getTerrain?.();
    if (terrain) map.setTerrain(terrain);

    // Wrap map.getCanvas() so that every call (from toPDF / toPNG / etc.)
    // returns a 2D composite canvas with locator labels, icons, and draw
    // features painted on top.
    const origGetCanvas = map.getCanvas.bind(map);
    const self = this;
    map.getCanvas = function () {
      const webgl         = origGetCanvas();
      const withLocators  = self._compositeLocators(webgl, map);
      const withIcons     = self._compositeIcons(withLocators, map);
      const withText      = self._compositeText(withIcons, map);
      return self._compositeDrawFeatures(withText, map);
    };

    return map;
  }

  // ── Locator compositing ─────────────────────────────────────────────────────

  _compositeLocators(webglCanvas, hiddenMap) {
    // Find all live locator labels in the original map
    const els = Array.from(
      document.querySelectorAll('.lm:not(.lm-thumb)')
    ).filter(el => this.map.getContainer().contains(el));

    // Nothing to draw — return the raw WebGL canvas unchanged
    if (els.length === 0) return webglCanvas;

    const composite = document.createElement('canvas');
    composite.width  = webglCanvas.width;
    composite.height = webglCanvas.height;
    const ctx = composite.getContext('2d');

    // Base map
    ctx.drawImage(webglCanvas, 0, 0);

    // Scale from CSS px → canvas px (accounts for DPI multiplier)
    // We use the container dimensions of the hidden map to determine the scale.
    // If offsetWidth is 0, we fallback to the original map's width or the canvas width.
    const cssW  = hiddenMap.getContainer().offsetWidth || this.map.getContainer().offsetWidth || (webglCanvas.width / window.devicePixelRatio);
    const scale = webglCanvas.width / cssW;

    for (const el of els) {
      let lngLat;

      // 1. Try reading lng/lat from data attributes (most reliable)
      const dataLng = el.getAttribute('data-lng');
      const dataLat = el.getAttribute('data-lat');

      if (dataLng && dataLat) {
        lngLat = new maplibregl.LngLat(parseFloat(dataLng), parseFloat(dataLat));
      } else {
        // 2. Fallback to parsing CSS transforms (for markers not created by LocatorPanel)
        const elStyle = el.getAttribute('style') || '';
        const m = elStyle.match(/translate(?:3d)?\(([^,]+)px,\s*([^,]+)px/);
        
        let origX, origY;

        if (m) {
          origX = parseFloat(m[1]);
          origY = parseFloat(m[2]);
        } else {
          const transform = window.getComputedStyle(el).transform;
          if (transform && transform !== 'none') {
            const parts = transform.match(/^matrix(?:3d)?\((.+)\)$/);
            if (parts) {
              const values = parts[1].split(', ');
              if (values.length === 6) {
                origX = parseFloat(values[4]);
                origY = parseFloat(values[5]);
              } else if (values.length === 16) {
                origX = parseFloat(values[12]);
                origY = parseFloat(values[13]);
              }
            }
          }
        }

        if (origX !== undefined && origY !== undefined) {
          lngLat = this.map.unproject([origX, origY]);
        }
      }

      if (!lngLat) continue;

      // Convert from original-map screen coords → lng/lat → hidden-map screen coords
      const hiddenPt  = hiddenMap.project(lngLat);

      // The locator-panel applies a horizontal CSS offset for left/right tail positions
      // (offset: [+18.5, 0] for posLeft, [-18.5, 0] for posRight) so the tail tip lands
      // visually 18.5 CSS px away from the stored geographic pin.  We must shift cx by the
      // same amount so _drawLocatorLabel receives the true visual tail-tip position.
      const posLeft  = el.classList.contains('lm-pos-left');
      const posRight = el.classList.contains('lm-pos-right');
      const tailPxOff = posLeft ? 18.5 : posRight ? -18.5 : 0;
      const cx = (hiddenPt.x + tailPxOff) * scale;
      const cy = hiddenPt.y * scale;

      // Read style info from the live element
      const bodyEl    = el.querySelector('.lm-body');
      const textEl    = el.querySelector('.lm-text');
      // innerText preserves <br> as \n; textContent collapses them
      const text      = (textEl?.innerText ?? '').trim();
      if (!text) continue;

      const fontFamily = bodyEl?.style.fontFamily || '"Inter", sans-serif';
      const fontSize   = (parseFloat(bodyEl?.style.fontSize) || 14) * scale;
      const textAlign  = textEl?.dataset?.align || 'left';

      this._drawLocatorLabel(ctx, cx, cy, text, {
        fontFamily,
        fontSize,
        scale,
        textAlign,
        isDark:    el.classList.contains('lm-dark'),
        isWhite:   el.classList.contains('lm-white'),
        isPlain:   el.classList.contains('lm-plain'),
        isLine:    el.classList.contains('lm-line'),
        tailDown:  el.classList.contains('lm-tail-down'),
        tailUp:    el.classList.contains('lm-tail-up'),
        posLeft,
        posRight,
      });
    }

    return composite;
  }

  _compositeIcons(baseCanvas, hiddenMap) {
    // Find all live icons in the original map
    const els = Array.from(
      document.querySelectorAll('.map-icon')
    ).filter(el => this.map.getContainer().contains(el));

    if (els.length === 0) return baseCanvas;

    const composite = document.createElement('canvas');
    composite.width  = baseCanvas.width;
    composite.height = baseCanvas.height;
    const ctx = composite.getContext('2d');

    // Base map (including locators if already painted)
    ctx.drawImage(baseCanvas, 0, 0);

    // Scale from CSS px → canvas px (accounts for DPI multiplier)
    // We use the container dimensions of the hidden map to determine the scale.
    // If offsetWidth is 0, we fallback to the original map's width or the canvas width.
    const cssW  = hiddenMap.getContainer().offsetWidth || this.map.getContainer().offsetWidth || (baseCanvas.width / window.devicePixelRatio);
    const scale = baseCanvas.width / cssW;

    for (const el of els) {
      const dataLng = el.getAttribute('data-lng');
      const dataLat = el.getAttribute('data-lat');
      if (!dataLng || !dataLat) continue;

      const lngLat = new maplibregl.LngLat(parseFloat(dataLng), parseFloat(dataLat));
      
      // PROJECT USING THE ACTUAL HIDDEN MAP RENDERED FOR EXPORT
      const hiddenPt = hiddenMap.project(lngLat);
      const cx = hiddenPt.x * scale;
      const cy = hiddenPt.y * scale;

      const imgEl = el.querySelector('img');
      // If the image in the DOM is not complete, we can't draw it synchronously.
      // But since they were already visible on the main map, they should be loaded.
      if (!imgEl || !imgEl.complete) continue;

      const iconSize = 15 * scale;
      
      ctx.save();
      // Draw a small white halo for readability
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 2 * scale;
      // Draw centered on the projected point
      ctx.drawImage(imgEl, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
      ctx.restore();
    }

    return composite;
  }

  // ── Text overlay compositing ─────────────────────────────────────────────────

  _compositeText(baseCanvas, hiddenMap) {
    const els = Array.from(
      document.querySelectorAll('.map-text')
    ).filter(el => this.map.getContainer().contains(el));

    if (els.length === 0) return baseCanvas;

    const composite = document.createElement('canvas');
    composite.width  = baseCanvas.width;
    composite.height = baseCanvas.height;
    const ctx = composite.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);

    const cssW  = hiddenMap.getContainer().offsetWidth || this.map.getContainer().offsetWidth || (baseCanvas.width / window.devicePixelRatio);
    const scale = baseCanvas.width / cssW;

    for (const el of els) {
      const dataLng = el.getAttribute('data-lng');
      const dataLat = el.getAttribute('data-lat');
      if (!dataLng || !dataLat) continue;

      const lngLat   = new maplibregl.LngLat(parseFloat(dataLng), parseFloat(dataLat));
      const hiddenPt = hiddenMap.project(lngLat);
      // anchor: 'left' → element's left edge sits on the projected point,
      // vertically centered (mirrors the live `translate(0,-50%)` CSS transform)
      const anchorX = hiddenPt.x * scale;
      const anchorY = hiddenPt.y * scale;

      const textEl = el.querySelector('.mt-text');
      const text   = (textEl?.innerText ?? '').trim();
      if (!text) continue;

      const fontFamily  = textEl?.style.fontFamily || '"Inter", sans-serif';
      const fontSize    = (parseFloat(textEl?.style.fontSize) || 18) * scale;
      const color       = textEl?.style.color || '#1a1a1a';
      const borderColor = textEl?.style.borderColor || '#1a1a1a';
      const bgColor     = textEl?.style.backgroundColor || '#ffffff';

      this._drawTextOverlay(ctx, anchorX, anchorY, text, {
        fontFamily,
        fontSize,
        scale,
        color,
        bold:       el.classList.contains('mt-bold'),
        italic:     el.classList.contains('mt-italic'),
        underline:  el.classList.contains('mt-underline'),
        border:     el.classList.contains('mt-border'),
        borderColor,
        background: el.classList.contains('mt-bg'),
        bgColor,
      });
    }

    return composite;
  }

  /**
   * Draws a left-anchored, vertically-centered text overlay onto the canvas.
   * `anchorX, anchorY` is the geographic pin's projected screen position —
   * the text's left edge (or its border/background box's left edge, if present)
   * sits there.
   */
  _drawTextOverlay(ctx, anchorX, anchorY, text, opts) {
    const {
      fontFamily, fontSize, scale, color, bold, italic, underline,
      border, borderColor, background, bgColor,
    } = opts;

    const weight = bold   ? 'bold '   : '';
    const style  = italic ? 'italic ' : '';
    const font   = `${style}${weight}${fontSize}px ${fontFamily}`;

    const lines = text.split('\n');
    const lineH = fontSize * 1.3;
    const textH = lines.length * lineH;

    ctx.font = font;
    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));

    const padX = (border || background) ? 8 * scale : 0;
    const padY = (border || background) ? 5 * scale : 0;

    const boxX = anchorX;
    const boxY = anchorY - textH / 2 - padY;
    const boxW = maxLineW + padX * 2;
    const boxH = textH + padY * 2;

    if (background) {
      ctx.save();
      ctx.fillStyle = bgColor;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.restore();
    }

    if (border) {
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth   = 2 * scale;
      ctx.strokeRect(boxX + ctx.lineWidth / 2, boxY + ctx.lineWidth / 2, boxW - ctx.lineWidth, boxH - ctx.lineWidth);
      ctx.restore();
    }

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const textX = boxX + padX;
    lines.forEach((line, i) => {
      const ly = boxY + padY + (i + 0.5) * lineH;
      ctx.fillText(line, textX, ly);
      if (underline) {
        const w = ctx.measureText(line).width;
        const underlineY = ly + fontSize * 0.32;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(1, fontSize * 0.06);
        ctx.moveTo(textX, underlineY);
        ctx.lineTo(textX + w, underlineY);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  _compositeDrawFeatures(baseCanvas, hiddenMap) {
    const features = getDrawPanel(this.map)?.getSnapshot() ?? [];
    if (features.length === 0) return baseCanvas;

    const composite = document.createElement('canvas');
    composite.width  = baseCanvas.width;
    composite.height = baseCanvas.height;
    const ctx = composite.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);

    const cssW  = hiddenMap.getContainer().offsetWidth
                  || this.map.getContainer().offsetWidth
                  || (baseCanvas.width / window.devicePixelRatio);
    const scale = baseCanvas.width / cssW;

    const proj = (coord) => {
      const pt = hiddenMap.project(coord);
      return [pt.x * scale, pt.y * scale];
    };

    for (const f of features) {
      const p    = f.properties;
      const type = f.geometry.type;
      const coords = f.geometry.coordinates;
      ctx.save();

      if (type === 'Point') {
        const [cx, cy] = proj(coords);
        const r = ((p.pointWidth || 8) / 2) * scale;
        ctx.globalAlpha = p.pointOpacity ?? 1;
        ctx.fillStyle   = p.pointColor || '#e03444';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fill();
        if ((p.pointOutlineWidth || 0) > 0) {
          ctx.globalAlpha  = p.pointOutlineOpacity ?? 1;
          ctx.strokeStyle  = p.pointOutlineColor || '#ffffff';
          ctx.lineWidth    = (p.pointOutlineWidth || 1) * scale;
          ctx.stroke();
        }

      } else if (type === 'LineString') {
        if (coords.length < 2) { ctx.restore(); continue; }
        const pts = coords.map(proj);
        ctx.globalAlpha = p.lineStringOpacity ?? 1;
        ctx.strokeStyle = p.lineStringColor   || '#3388ff';
        ctx.lineWidth   = (p.lineStringWidth  || 2) * scale;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();

      } else if (type === 'Polygon') {
        const ring = coords[0];
        if (!ring || ring.length < 3) { ctx.restore(); continue; }
        const pts = ring.map(proj);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.globalAlpha = p.polygonFillOpacity ?? 0.3;
        ctx.fillStyle   = p.polygonFillColor  || '#3388ff';
        ctx.fill();
        if ((p.polygonOutlineWidth || 0) > 0) {
          ctx.globalAlpha = p.polygonOutlineOpacity ?? 1;
          ctx.strokeStyle = p.polygonOutlineColor   || '#1a66cc';
          ctx.lineWidth   = (p.polygonOutlineWidth  || 2) * scale;
          ctx.lineJoin    = 'round';
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    return composite;
  }

  _drawLocatorLabel(ctx, anchorX, anchorY, text, opts) {
    const { fontFamily, fontSize, scale, isDark, isPlain, isLine,
            tailDown, tailUp, posLeft, posRight, textAlign = 'left' } = opts;

    const padX   = 10 * scale;
    const padY   =  5 * scale;
    const tailH  = 11 * scale;
    const tailHW =  4.5 * scale;
    const radius =  5 * scale;
    const lineH  = fontSize * 1.3;

    const lines = text.split('\n');

    ctx.font = `${fontSize}px ${fontFamily}`;
    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxLineW + padX * 2;
    const boxH = lines.length * lineH + padY * 2;

    // Box top-left based on anchor type.
    // anchorX is the visual tail-tip position (already offset-corrected by the caller):
    //   center  → tail tip at box horizontal centre  → boxX = anchorX - boxW/2
    //   posLeft → tail tip at box LEFT  edge         → boxX = anchorX
    //   posRight→ tail tip at box RIGHT edge         → boxX = anchorX - boxW
    let boxX, boxY;
    if (tailDown) {
      boxY = anchorY - tailH - boxH;
      if      (posLeft)  boxX = anchorX;
      else if (posRight) boxX = anchorX - boxW;
      else               boxX = anchorX - boxW / 2;
    } else if (tailUp) {
      boxY = anchorY + tailH;
      if      (posLeft)  boxX = anchorX;
      else if (posRight) boxX = anchorX - boxW;
      else               boxX = anchorX - boxW / 2;
    } else {
      boxX = anchorX - boxW / 2;
      boxY = anchorY - boxH / 2;
    }

    // Helpers to draw all lines respecting alignment
    const lineX = (i) => {
      if (textAlign === 'center') return boxX + boxW / 2;
      if (textAlign === 'right')  return boxX + boxW - padX;
      return boxX + padX;
    };
    const lineY = (i) => boxY + padY + (i + 0.5) * lineH;

    const setAlign = () => {
      ctx.textBaseline = 'middle';
      ctx.textAlign    = (textAlign === 'center' || textAlign === 'right') ? textAlign : 'left';
    };

    const fillLines = (font) => {
      ctx.font = font;
      setAlign();
      lines.forEach((l, i) => ctx.fillText(l, lineX(i), lineY(i)));
    };
    const strokeLines = (font) => {
      ctx.font = font;
      setAlign();
      lines.forEach((l, i) => ctx.strokeText(l, lineX(i), lineY(i)));
    };

    if (isPlain) {
      ctx.lineWidth   = 3 * scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      strokeLines(`${fontSize}px ${fontFamily}`);
      ctx.fillStyle   = '#1a1a1a';
      fillLines(`${fontSize}px ${fontFamily}`);
      return;
    }

    if (isLine) {
      const shaftH    = 22 * scale;
      const shaftW    = 1.5 * scale;
      // anchorX is already the visual tail-tip x — shaft is always centred on it.
      const shaftX    = anchorX - shaftW / 2;
      ctx.fillStyle = '#333333';
      if (tailDown) ctx.fillRect(shaftX, boxY + boxH, shaftW, shaftH);
      else if (tailUp) ctx.fillRect(shaftX, boxY - shaftH, shaftW, shaftH);

      const boldFont = `bold ${fontSize}px ${fontFamily}`;
      ctx.lineWidth   = Math.max(2, 3 * scale);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      strokeLines(boldFont);
      ctx.fillStyle   = '#1a1a1a';
      fillLines(boldFont);
      return;
    }

    const bgColor   = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff'  : '#1a1a1a';

    // ── Rounded box ────────────────────────────────────────────────────────
    ctx.fillStyle = bgColor;
    this._roundRect(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.fill();

    // ── Tail ───────────────────────────────────────────────────────────────
    if (tailDown || tailUp) {
      // anchorX is the corrected visual tail-tip x; the CSS triangle centre always
      // lands at anchorX regardless of posLeft/posRight, so tailBaseX = anchorX.
      const tailBaseX = anchorX;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (tailDown) {
        ctx.moveTo(tailBaseX - tailHW, boxY + boxH);
        ctx.lineTo(tailBaseX + tailHW, boxY + boxH);
        ctx.lineTo(anchorX, anchorY);
      } else {
        ctx.moveTo(tailBaseX - tailHW, boxY);
        ctx.lineTo(tailBaseX + tailHW, boxY);
        ctx.lineTo(anchorX, anchorY);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ── Text ───────────────────────────────────────────────────────────────
    ctx.fillStyle = textColor;
    fillLines(`${fontSize}px ${fontFamily}`);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }
}

const CUSTOM_KEY = '__custom__';
const MM_PER_INCH = 25.4;
const SCREEN_DPI  = 96;

const FENCE_SOURCE  = 'export-fence';
const FENCE_LAYER   = 'export-fence';
const FENCE_SPACING = 10;  // px between fence posts along each edge
const FENCE_PADDING = 5;  // text-padding px — sets collision box radius

const DEFAULT_OPTIONS = {
  PageSize: Size.LETTER,
  PageOrientation: PageOrientation.Landscape,
  Format: Format.PDF,
  DPI: 150,
  Filename: 'map-export',
};

function normalizeOptions(opts) {
  let pageSize = opts.PageSize ?? Size.LETTER;
  if (typeof pageSize === 'string' && Size[pageSize]) pageSize = Size[pageSize];

  let format = opts.Format ?? Format.PDF;
  if (typeof format === 'string' && Format[format]) format = Format[format];

  let orientation = opts.PageOrientation ?? PageOrientation.Landscape;
  if (typeof orientation === 'string' && PageOrientation[orientation]) {
    orientation = PageOrientation[orientation];
  }

  return {
    ...opts,
    PageSize: pageSize,
    Format: format,
    PageOrientation: orientation,
    DPI: opts.DPI ?? 150,
    Filename: opts.Filename ?? 'map-export',
  };
}

// SVG namespace helper
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export class CustomExportControl {
  constructor(options = {}) {
    this._options = normalizeOptions({ ...DEFAULT_OPTIONS, ...options });
  }

  onAdd(map) {
    this._map = map;

    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // Printer-icon toggle button
    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'maplibregl-export-control';
    this._btn.title = 'Export map';
    this._btn.setAttribute('aria-label', 'Export map');
    this._btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = this._panel.style.display !== 'block';
      this._panel.style.display = opening ? 'block' : 'none';
      if (opening) { this._fenceActive = true;  this._addFence(); }
      else         { this._fenceActive = false; this._removeFence(); }
    });

    // Floating panel
    this._panel = document.createElement('div');
    this._panel.className = 'maplibregl-export-list';
    this._panel.style.cssText =
      'display:none; position:absolute; right:0; top:100%; background:#fff; ' +
      'border-radius:4px; box-shadow:0 0 0 2px rgba(0,0,0,.1); padding:12px; ' +
      'min-width:230px; margin-top:4px; font-family:inherit; z-index:10;';

    this._panel.appendChild(this._buildTable());

    this._container.appendChild(this._btn);
    this._container.appendChild(this._panel);

    // Track active style URL (updated when StyleSwitcherControl fires mapstylechange)
    this._styleUrl = this._options.StyleURL || '';
    this._onStyleChange = (e) => { this._styleUrl = e.detail.uri; };
    this._map.getContainer().addEventListener('mapstylechange', this._onStyleChange);

    // Close panel on outside click (overlay stays visible)
    this._outsideClick = (e) => {
      if (this._suppressNextOutsideClick) {
        this._suppressNextOutsideClick = false;
        return;
      }
      if (!this._container.contains(e.target)) {
        this._panel.style.display = 'none';
        this._fenceActive = false;
        this._removeFence();
      }
    };
    document.addEventListener('click', this._outsideClick);

    // Build the SVG overlay; show once the map has rendered so dimensions are ready
    this._createOverlay();
    if (this._map.loaded()) {
      this._showOverlay();
      this._initFenceLayer();
    } else {
      this._map.once('load', () => { this._showOverlay(); this._initFenceLayer(); });
    }

    // Keep overlay in sync with map resizes
    this._onResize = () => { if (this._overlayVisible) this._updateOverlay(); };
    this._map.on('resize', this._onResize);

    // Re-init fence layer after style swaps (addSource/addLayer are lost on style reload)
    this._onStyleData = () => {
      if (typeof this._initFenceLayer !== 'function') return;
      this._initFenceLayer();
      if (this._fenceActive) this._addFence();
    };
    this._map.on('styledata', this._onStyleData);

    // Remove fence while map is moving (geographic coords would drift from overlay),
    // then rebuild once the camera settles.
    this._onMoveStart = () => this._removeFence();
    this._onMoveEnd   = () => { if (this._fenceActive) this._addFence(); };
    this._map.on('movestart', this._onMoveStart);
    this._map.on('moveend',   this._onMoveEnd);

    return this._container;
  }

  onRemove() {
    document.removeEventListener('click', this._outsideClick);
    this._map.getContainer().removeEventListener('mapstylechange', this._onStyleChange);
    this._map.off('resize',     this._onResize);
    this._map.off('styledata',  this._onStyleData);
    this._map.off('movestart',  this._onMoveStart);
    this._map.off('moveend',    this._onMoveEnd);
    this._removeFenceLayer();
    this._overlay?.remove();
    for (const el of Object.values(this._handleEls ?? {})) el.remove();
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }

  getDefaultPosition() { return 'top-right'; }

  // ── Overlay ────────────────────────────────────────────────────────────────

  _createOverlay() {
    const mapContainer = this._map.getContainer();

    const svg = svgEl('svg', {
      style: 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;',
    });

    // Mask: white background with a black cutout where the export area is
    const defs  = svgEl('defs');
    const mask  = svgEl('mask', { id: 'export-area-mask' });
    const mBg   = svgEl('rect', { width: '100%', height: '100%', fill: 'white' });
    this._maskHole = svgEl('rect', { fill: 'black' });
    mask.append(mBg, this._maskHole);
    defs.appendChild(mask);
    svg.appendChild(defs);

    // Semi-transparent dark overlay, punched through by the mask
    svg.appendChild(svgEl('rect', {
      width: '100%', height: '100%',
      fill: 'rgba(0,0,0,0.45)',
      mask: 'url(#export-area-mask)',
    }));

    // Dashed white border around the export area
    this._borderRect = svgEl('rect', {
      fill: 'none',
      stroke: 'white',
      'stroke-width': '1.5',
      'stroke-dasharray': '6 3',
    });
    svg.appendChild(this._borderRect);

    // Dimension label inside the border
    this._sizeLabel = svgEl('text', {
      fill: 'white',
      'font-size': '11',
      'font-family': 'sans-serif',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      style: 'text-shadow:0 0 4px rgba(0,0,0,0.8);',
    });
    svg.appendChild(this._sizeLabel);

    svg.style.display = 'none';
    mapContainer.appendChild(svg);
    this._overlay = svg;
    this._overlayVisible = false;

    // Corner drag handles (HTML divs so pointer-events work through the SVG)
    const CURSORS = { nw: 'nw-resize', ne: 'ne-resize', se: 'se-resize', sw: 'sw-resize' };
    this._handleEls = {};
    for (const [corner, cursor] of Object.entries(CURSORS)) {
      const div = document.createElement('div');
      div.style.cssText =
        'position:absolute; width:14px; height:14px; border-radius:50%; ' +
        'background:white; border:1.5px solid rgba(0,0,0,0.4); ' +
        'transform:translate(-50%,-50%); z-index:4; display:none; ' +
        `cursor:${cursor};`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._dragStart(e, corner);
      });
      mapContainer.appendChild(div);
      this._handleEls[corner] = div;
    }

    this._dragState = null;
    this._onMouseMove = (e) => this._dragMove(e);
    this._onMouseUp   = ()  => this._dragEnd();
  }

  _showOverlay() {
    this._overlayVisible = true;
    this._overlay.style.display = '';
    for (const el of Object.values(this._handleEls)) el.style.display = '';
    this._updateOverlay();
  }

  _hideOverlay() {
    this._overlayVisible = false;
    this._overlay.style.display = 'none';
    for (const el of Object.values(this._handleEls)) el.style.display = 'none';
  }

  // ── Collision fence ────────────────────────────────────────────────────────

  _initFenceLayer() {
    if (!this._map || this._map.getSource(FENCE_SOURCE)) return;
    this._map.addSource(FENCE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this._map.addLayer({
      id: FENCE_LAYER,
      type: 'symbol',
      source: FENCE_SOURCE,
      layout: {
        'text-field':            'X',
        'text-size':             10,
        'text-allow-overlap':    true,   // fence posts always placed
        'text-ignore-placement': false,  // they block other labels
        'text-padding':          FENCE_PADDING,
        'text-font':             this._detectStyleFont(),
      },
      paint: { 'text-color': 'transparent' },
    });
  }

  _removeFenceLayer() {
    if (!this._map) return;
    if (this._map.getLayer(FENCE_LAYER))   this._map.removeLayer(FENCE_LAYER);
    if (this._map.getSource(FENCE_SOURCE)) this._map.removeSource(FENCE_SOURCE);
  }

  _addFence() {
    const src = this._map?.getSource(FENCE_SOURCE);
    if (!src) return;

    const x     = parseFloat(this._maskHole.getAttribute('x'));
    const y     = parseFloat(this._maskHole.getAttribute('y'));
    const rectW = parseFloat(this._maskHole.getAttribute('width'));
    const rectH = parseFloat(this._maskHole.getAttribute('height'));
    if (isNaN(x) || isNaN(y)) return;

    const features = [];
    const addPoint = (px, py) => {
      const { lng, lat } = this._map.unproject([px, py]);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {},
      });
    };

    const stepsX = Math.ceil(rectW / FENCE_SPACING);
    for (let i = 0; i <= stepsX; i++) {
      const px = x + (i / stepsX) * rectW;
      addPoint(px, y);           // top edge
      addPoint(px, y + rectH);   // bottom edge
    }
    // Left and right edges — corners already added above
    const stepsY = Math.ceil(rectH / FENCE_SPACING);
    for (let i = 1; i < stepsY; i++) {
      const py = y + (i / stepsY) * rectH;
      addPoint(x,          py);  // left edge
      addPoint(x + rectW,  py);  // right edge
    }

    src.setData({ type: 'FeatureCollection', features });
  }

  _removeFence() {
    const src = this._map?.getSource(FENCE_SOURCE);
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  }

  _updateOverlay() {
    const mapContainer = this._map.getContainer();
    const vw = mapContainer.offsetWidth;
    const vh = mapContainer.offsetHeight;

    const [mmW, mmH] = this._getCurrentExportSize();

    // Convert mm → CSS pixels at screen DPI, then clamp to viewport
    const exportPxW = (SCREEN_DPI / MM_PER_INCH) * mmW;
    const exportPxH = (SCREEN_DPI / MM_PER_INCH) * mmH;

    // Scale down uniformly if export is larger than the viewport
    const scale = Math.min(1, vw / exportPxW, vh / exportPxH);
    const rectW = exportPxW * scale;
    const rectH = exportPxH * scale;

    const x = (vw - rectW) / 2;
    const y = (vh - rectH) / 2;

    for (const el of [this._maskHole, this._borderRect]) {
      el.setAttribute('x',      x);
      el.setAttribute('y',      y);
      el.setAttribute('width',  rectW);
      el.setAttribute('height', rectH);
    }

    // Dimension label (show actual mm, not the scaled screen size)
    const labelText = scale < 1
      ? `${Math.round(mmW)} × ${Math.round(mmH)} mm  (scaled to fit)`
      : `${Math.round(mmW)} × ${Math.round(mmH)} mm`;
    this._sizeLabel.textContent = labelText;
    this._sizeLabel.setAttribute('x', x + rectW / 2);
    this._sizeLabel.setAttribute('y', y + rectH - 14);

    this._updateHandlePositions(x, y, rectW, rectH);
  }

  _updateHandlePositions(x, y, rectW, rectH) {
    const pos = {
      nw: [x,          y],
      ne: [x + rectW,  y],
      se: [x + rectW,  y + rectH],
      sw: [x,          y + rectH],
    };
    for (const [id, [hx, hy]] of Object.entries(pos)) {
      const el = this._handleEls[id];
      el.style.left = `${hx}px`;
      el.style.top  = `${hy}px`;
    }
  }

  _dragStart(e, corner) {
    const mapContainer = this._map.getContainer();
    // Switch to custom mode so the current drag dimensions are used for export
    if (this._sizeSelect && this._sizeSelect.value !== CUSTOM_KEY) {
      this._sizeSelect.value = CUSTOM_KEY;
      if (this._orientRow) this._orientRow.style.display = 'none';
    }
    this._dragState = { corner, containerRect: mapContainer.getBoundingClientRect() };
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
    this._removeFence();
  }

  _dragMove(e) {
    if (!this._dragState) return;
    const mapContainer = this._map.getContainer();
    const vw = mapContainer.offsetWidth;
    const vh = mapContainer.offsetHeight;
    const cr = this._dragState.containerRect;

    const mouseX = Math.max(0, Math.min(vw, e.clientX - cr.left));
    const mouseY = Math.max(0, Math.min(vh, e.clientY - cr.top));

    const cx = vw / 2;
    const cy = vh / 2;
    const MIN_HALF = 20;
    const halfW = Math.max(MIN_HALF, Math.abs(mouseX - cx));
    const halfH = Math.max(MIN_HALF, Math.abs(mouseY - cy));

    const rectW = halfW * 2;
    const rectH = halfH * 2;
    const x = cx - halfW;
    const y = cy - halfH;

    for (const el of [this._maskHole, this._borderRect]) {
      el.setAttribute('x',      x);
      el.setAttribute('y',      y);
      el.setAttribute('width',  rectW);
      el.setAttribute('height', rectH);
    }
    this._updateHandlePositions(x, y, rectW, rectH);

    const PX_PER_MM = SCREEN_DPI / MM_PER_INCH;
    const mmW = Math.max(10, Math.round(rectW / PX_PER_MM));
    const mmH = Math.max(10, Math.round(rectH / PX_PER_MM));

    this._sizeLabel.textContent = `${mmW} × ${mmH} mm`;
    this._sizeLabel.setAttribute('x', x + rectW / 2);
    this._sizeLabel.setAttribute('y', y + rectH - 14);

    this._customW.value = mmW;
    this._customH.value = mmH;
  }

  _dragEnd() {
    this._dragState = null;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
    // Suppress the click that fires after mouseup so the overlay stays visible
    this._suppressNextOutsideClick = true;
    setTimeout(() => { this._suppressNextOutsideClick = false; }, 100);
    if (this._fenceActive) this._addFence();
  }

  _getCurrentExportSize() {
    if (!this._sizeSelect) return this._options.PageSize;

    if (this._sizeSelect.value === CUSTOM_KEY) {
      return [Number(this._customW.value) || 100, Number(this._customH.value) || 100];
    }

    let [w, h] = JSON.parse(this._sizeSelect.value);
    const orient = this._orientSelect?.value;
    if (orient === PageOrientation.Portrait  && w > h) [w, h] = [h, w];
    if (orient === PageOrientation.Landscape && w < h) [w, h] = [h, w];
    return [w, h];
  }

  // ── Panel UI ───────────────────────────────────────────────────────────────

  _buildTable() {
    const table = document.createElement('table');
    table.className = 'print-table';
    table.style.cssText = 'border-collapse:collapse; width:100%;';

    // Internal custom size state — driven by drag, not numeric inputs
    this._customW = { value: '279' };
    this._customH = { value: '216' };

    table.appendChild(this._row('Page Size',  this._buildSizeSelect()));
    this._orientRow = this._row('Orientation', this._buildOrientationSelect());
    table.appendChild(this._orientRow);
    table.appendChild(this._row('Format',      this._buildFormatSelect()));
    this._dpiRow = this._row('DPI', this._buildDPISelect());
    table.appendChild(this._dpiRow);

    // HTML-export-only options — checkboxes, unchecked by default, only shown
    // when Format is set to HTML.
    const { row: zoomCtrlRow, checkbox: zoomCtrlCheckbox } =
      this._checkboxRow('Zoom control', 'mapbox-gl-export-zoom-control');
    const { row: staticRow, checkbox: staticCheckbox } =
      this._checkboxRow('Make Map Static', 'mapbox-gl-export-static');
    const { row: scaleBarRow, checkbox: scaleBarCheckbox } =
      this._checkboxRow('Scale bar', 'mapbox-gl-export-scale-bar');

    this._zoomControlCheckbox = zoomCtrlCheckbox;
    this._staticCheckbox      = staticCheckbox;
    this._scaleBarCheckbox    = scaleBarCheckbox;

    this._htmlOptionRows = [zoomCtrlRow, staticRow, scaleBarRow];
    const isHtml = this._formatSelect?.value === 'html';
    this._htmlOptionRows.forEach(row => { row.style.display = isHtml ? '' : 'none'; });

    table.appendChild(zoomCtrlRow);
    table.appendChild(staticRow);
    table.appendChild(scaleBarRow);

    const btnRow  = document.createElement('tr');
    const btnCell = document.createElement('td');
    btnCell.colSpan = 2;
    btnCell.style.paddingTop = '10px';

    const btn = document.createElement('button');
    btn.id   = 'generate-button';
    btn.type = 'button';
    btn.textContent = 'Generate';
    btn.style.cssText =
      'width:100%; padding:7px 0; background:#3b82f6; color:#fff; border:none; ' +
      'border-radius:4px; font-size:13px; font-weight:600; cursor:pointer;';
    btn.addEventListener('mouseover', () => btn.style.background = '#2563eb');
    btn.addEventListener('mouseout',  () => btn.style.background = '#3b82f6');
    btn.addEventListener('click', () => this._generate());

    btnCell.appendChild(btn);
    btnRow.appendChild(btnCell);
    table.appendChild(btnRow);

    return table;
  }

  _row(label, control) {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.style.cssText = 'font-size:12px; padding:3px 8px 3px 0; white-space:nowrap; color:#444;';
    th.textContent = label;
    const td = document.createElement('td');
    td.style.width = '100%';
    td.appendChild(control);
    tr.append(th, td);
    return tr;
  }

  _select(id, optionsMap, defaultValue) {
    const sel = document.createElement('select');
    sel.id = id;
    sel.style.cssText =
      'width:100%; font-size:12px; padding:3px 4px; border:1px solid #ccc; ' +
      'border-radius:3px; background:#fff;';
    for (const [label, value] of Object.entries(optionsMap)) {
      const opt = document.createElement('option');
      opt.value = typeof value === 'object' ? JSON.stringify(value) : String(value);
      opt.textContent = label;
      if (JSON.stringify(value) === JSON.stringify(defaultValue)) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }

  _buildSizeSelect() {
    const sizes = {
      ...Object.fromEntries(Object.entries(Size)),
      '1 column': [42, 84],
      '2 column': [87, 75],
      'Custom…': CUSTOM_KEY,
    };

    const sel = this._select('mapbox-gl-export-page-size', sizes, this._options.PageSize);

    sel.addEventListener('change', () => {
      const isCustom = sel.value === CUSTOM_KEY;
      this._orientRow.style.display = isCustom ? 'none' : '';
      if (this._overlayVisible) this._updateOverlay();
    });

    this._sizeSelect = sel;
    return sel;
  }

  _buildOrientationSelect() {
    const opts = Object.fromEntries(Object.entries(PageOrientation));
    const sel  = this._select(
      'mapbox-gl-export-page-orientation', opts, this._options.PageOrientation);
    sel.addEventListener('change', () => { if (this._overlayVisible) this._updateOverlay(); });
    this._orientSelect = sel;
    return sel;
  }

  _buildFormatSelect() {
    const formats = { ...Object.fromEntries(Object.entries(Format)), 'HTML': 'html' };
    const sel = this._select('mapbox-gl-export-format-type', formats, this._options.Format);
    sel.addEventListener('change', () => {
      const isHtml = sel.value === 'html';
      if (this._dpiRow) this._dpiRow.style.display = isHtml ? 'none' : '';
      if (this._htmlOptionRows) {
        this._htmlOptionRows.forEach(row => { row.style.display = isHtml ? '' : 'none'; });
      }
    });
    this._formatSelect = sel;
    return sel;
  }

  _checkboxRow(label, id, checked = false) {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.style.cssText = 'font-size:12px; padding:3px 8px 3px 0; white-space:nowrap; color:#444;';
    th.textContent = label;
    const td = document.createElement('td');
    td.style.width = '100%';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    td.appendChild(checkbox);
    tr.append(th, td);
    return { row: tr, checkbox };
  }

  _buildDPISelect() {
    const vals = new Set([...Object.values(DPI), this._options.DPI]);
    const opts = {};
    [...vals].sort((a, b) => a - b).forEach(v => { opts[String(v)] = v; });
    return this._select('mapbox-gl-export-dpi-type', opts, this._options.DPI);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  _generate() {
    this._panel.style.display = 'none';
    const format = this._panel.querySelector('#mapbox-gl-export-format-type').value;
    if (format === 'html') {
      const htmlOptions = {
        zoomControl: this._panel.querySelector('#mapbox-gl-export-zoom-control')?.checked ?? false,
        staticMap:   this._panel.querySelector('#mapbox-gl-export-static')?.checked ?? false,
        scaleBar:    this._panel.querySelector('#mapbox-gl-export-scale-bar')?.checked ?? false,
      };
      this._generateHtml(htmlOptions);
      return;
    }
    const dpi  = Number(this._panel.querySelector('#mapbox-gl-export-dpi-type').value);
    const size = this._getCurrentExportSize();
    new MapGenerator(this._map, size, dpi, format, Unit.mm, this._options.Filename).generate();
  }

  // ── HTML embed export ──────────────────────────────────────────────────────

  _generateHtml(htmlOptions = {}) {
    const { zoomControl = false, staticMap = false, scaleBar = false } = htmlOptions;
    const center    = this._map.getCenter();
    const zoom      = this._map.getZoom();
    const styleObj  = this._map.getStyle();
    // Strip fence source/layer — they're invisible collision markers, not map content
    if (styleObj.sources) delete styleObj.sources[FENCE_SOURCE];
    if (styleObj.layers)  styleObj.layers = styleObj.layers.filter(l => l.id !== FENCE_LAYER);

    // Strip terra-draw sources/layers — they are re-added dynamically in the map.on('load')
    // block with the actual feature data.  Leaving them in the style causes MapLibre to throw
    // "Source with ID 'td-*' already exists" when the load handler runs, which aborts the
    // async callback before the locator popup code executes.
    const TD_SOURCE_IDS = ['td-polygon', 'td-linestring', 'td-point'];
    const TD_LAYER_IDS  = new Set(['td-polygon', 'td-polygon-outline', 'td-linestring', 'td-point', 'td-point-marker']);
    TD_SOURCE_IDS.forEach(id => { if (styleObj.sources) delete styleObj.sources[id]; });
    if (styleObj.layers) styleObj.layers = styleObj.layers.filter(l => !TD_LAYER_IDS.has(l.id));

    // Map dimensions from the current export overlay
    const [mmW, mmH] = this._getCurrentExportSize();
    const pxPerMm = SCREEN_DPI / MM_PER_INCH;
    const maxW = Math.round(mmW * pxPerMm);
    const mapH = Math.round(mmH * pxPerMm);

    const locatorFeatures = this._collectLocatorFeatures();
    const { iconFeatures, iconDataMap } = this._collectIconData();
    const textFeatures = this._collectTextFeatures();
    const font = this._detectStyleFont();
    const drawFeatures = getDrawPanel(this._map)?.getSnapshot() ?? [];

    const html = this._buildHtml({
      center, zoom, styleObj, maxW, mapH,
      locatorFeatures, iconFeatures, iconDataMap, textFeatures, font, drawFeatures,
      zoomControl, staticMap, scaleBar,
    });

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `${this._options.Filename || 'map'}.html`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  _detectStyleFont() {
    try {
      for (const layer of (this._map.getStyle()?.layers ?? [])) {
        if (layer.type !== 'symbol') continue;
        const tf = layer.layout?.['text-font'];
        if (Array.isArray(tf) && typeof tf[0] === 'string') return tf;
        if (Array.isArray(tf) && tf[0] === 'literal' && Array.isArray(tf[1])) return tf[1];
      }
    } catch (_) { /* ignore */ }
    return ['Noto Sans Regular', 'Arial Unicode MS Regular'];
  }

  _collectLocatorFeatures() {
    return Array.from(document.querySelectorAll('.lm:not(.lm-thumb)'))
      .filter(el => this._map.getContainer().contains(el))
      .flatMap(el => {
        const textEl  = el.querySelector('.lm-text');
        const bodyEl  = el.querySelector('.lm-body');
        const text    = (textEl?.innerText ?? '').trim();
        if (!text) return [];

        const tailDown = el.classList.contains('lm-tail-down');
        const tailUp   = el.classList.contains('lm-tail-up');
        const posLeft  = el.classList.contains('lm-pos-left');
        const posRight = el.classList.contains('lm-pos-right');

        let anchor = 'center';
        if (tailDown) anchor = posLeft ? 'bottom-left' : posRight ? 'bottom-right' : 'bottom';
        else if (tailUp) anchor = posLeft ? 'top-left'  : posRight ? 'top-right'   : 'top';

        const isDark  = el.classList.contains('lm-dark');
        const isLine  = el.classList.contains('lm-line');
        const textColor  = isDark ? '#ffffff' : '#1a1a1a';
        const haloColor  = isDark ? '#1a1a1a' : '#ffffff';
        const haloWidth  = (isDark || el.classList.contains('lm-white')) ? 4 : 2;

        // The locator-panel shifts the element ±18.5 CSS px from the stored pin so the
        // CSS tail tip aligns with that pin visually.  The HTML popup needs the same
        // pixel offset so it lands in the same position as the live locator.
        const offsetX = posLeft ? 18.5 : posRight ? -18.5 : 0;

        return [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [
            parseFloat(el.getAttribute('data-lng')),
            parseFloat(el.getAttribute('data-lat')),
          ]},
          properties: {
            text,
            fontSize:   parseFloat(bodyEl?.style.fontSize) || 14,
            anchor,
            offsetX,
            textColor,
            haloColor,
            haloWidth,
            isDark,
          },
        }];
      });
  }

  _collectIconData() {
    const BASE = 'https://mapicons.nyc3.cdn.digitaloceanspaces.com/png/maki/';
    const mapContainer = this._map.getContainer();
    const iconEls = Array.from(document.querySelectorAll('.map-icon'))
      .filter(el => mapContainer.contains(el));

    const iconDataMap = {};
    for (const el of iconEls) {
      const name = el.dataset.icon;
      if (name && !iconDataMap[name + '-icon']) iconDataMap[name + '-icon'] = `${BASE}${name}.png`;
    }

    const iconFeatures = iconEls
      .filter(el => el.dataset.icon)
      .map((el, idx) => {
        const sizePx   = parseInt(el.dataset.size) || 15;
        const iconSize = Math.round((sizePx / 15) * 10) / 10;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [
            parseFloat(el.getAttribute('data-lng')),
            parseFloat(el.getAttribute('data-lat')),
          ]},
          properties: {
            _iwIdx: idx,
            icon: el.dataset.icon + '-icon',
            iconSize,
            iwTitle:   el.dataset.iwTitle   || '',
            iwSubhead: el.dataset.iwSubhead || '',
            iwText:    el.dataset.iwText    || '',
            iwFont:    el.dataset.iwFont    || 'Inter',
            iwSize:    parseFloat(el.dataset.iwSize) || 14,
            iwAlign:   el.dataset.iwAlign   || 'left',
          },
        };
      });

    return { iconFeatures, iconDataMap };
  }

  _collectTextFeatures() {
    return Array.from(document.querySelectorAll('.map-text'))
      .filter(el => this._map.getContainer().contains(el))
      .flatMap(el => {
        const textEl = el.querySelector('.mt-text');
        const text   = (textEl?.innerText ?? '').trim();
        if (!text) return [];

        return [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [
            parseFloat(el.getAttribute('data-lng')),
            parseFloat(el.getAttribute('data-lat')),
          ]},
          properties: {
            text,
            font:        el.dataset.font  || 'Inter',
            size:        parseFloat(el.dataset.size) || 18,
            color:       el.dataset.color || '#1a1a1a',
            bold:        el.classList.contains('mt-bold'),
            italic:      el.classList.contains('mt-italic'),
            underline:   el.classList.contains('mt-underline'),
            border:      el.classList.contains('mt-border'),
            borderColor: el.dataset.borderColor || '#1a1a1a',
            background:  el.classList.contains('mt-bg'),
            bgColor:     el.dataset.bgColor || '#ffffff',
          },
        }];
      });
  }

  _buildHtml({ center, zoom, styleObj, maxW, mapH, locatorFeatures, iconFeatures, iconDataMap, textFeatures = [], font, drawFeatures = [], zoomControl = false, staticMap = false, scaleBar = false }) {
    const hasLocators = locatorFeatures.length > 0;
    const hasIcons    = iconFeatures.length > 0;
    const hasText     = textFeatures.length > 0;

    // Detect all fonts used across locators, infowindows, and text overlays
    const usedFonts = new Set();
    locatorFeatures.forEach(f => {
      // Locator features don't currently store the font value in properties,
      // but they are already loaded in the main app.
      // However, for HTML export, we should probably ensure they are linked.
      // For now, let's focus on Infowindow fonts which we just added.
    });
    iconFeatures.forEach(f => {
      if (f.properties.iwFont) usedFonts.add(f.properties.iwFont);
    });
    textFeatures.forEach(f => {
      if (f.properties.font) usedFonts.add(f.properties.font);
    });

    const fontLinks = Array.from(usedFonts).map(f => {
      if (f.startsWith('helveticaltstd')) {
        return `<style>@font-face { font-family: "${f}"; src: url("https://vectortiles.nyc3.cdn.digitaloceanspaces.com/font/${f}.woff2") format("woff2"); }</style>`;
      }
      return `<link href="https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;700&display=swap" rel="stylesheet">`;
    }).join('\n    ');

    // ── Terra-draw feature layers ──────────────────────────────────────────
    const tdPoints    = drawFeatures.filter(f => f.geometry.type === 'Point');
    const tdLines     = drawFeatures.filter(f => f.geometry.type === 'LineString');
    const tdPolygons  = drawFeatures.filter(f => f.geometry.type === 'Polygon');

    const tdJs = [
      tdPoints.length > 0 ? `
        map.addSource('td-point', { type: 'geojson', data: ${JSON.stringify({ type: 'FeatureCollection', features: tdPoints }, null, 8)} });
        map.addLayer({ id: 'td-point', type: 'circle', source: 'td-point', paint: {
            'circle-color':           ['get', 'pointColor'],
            'circle-radius':          ['get', 'pointWidth'],
            'circle-opacity':         ['get', 'pointOpacity'],
            'circle-stroke-color':    ['get', 'pointOutlineColor'],
            'circle-stroke-width':    ['get', 'pointOutlineWidth'],
            'circle-stroke-opacity':  ['get', 'pointOutlineOpacity'],
        }});` : '',

      tdLines.length > 0 ? `
        map.addSource('td-linestring', { type: 'geojson', data: ${JSON.stringify({ type: 'FeatureCollection', features: tdLines }, null, 8)} });
        map.addLayer({ id: 'td-linestring', type: 'line', source: 'td-linestring', paint: {
            'line-color':   ['get', 'lineStringColor'],
            'line-width':   ['get', 'lineStringWidth'],
            'line-opacity': ['get', 'lineStringOpacity'],
        }});` : '',

      tdPolygons.length > 0 ? `
        map.addSource('td-polygon', { type: 'geojson', data: ${JSON.stringify({ type: 'FeatureCollection', features: tdPolygons }, null, 8)} });
        map.addLayer({ id: 'td-polygon', type: 'fill', source: 'td-polygon', paint: {
            'fill-color':   ['get', 'polygonFillColor'],
            'fill-opacity': ['get', 'polygonFillOpacity'],
        }});
        map.addLayer({ id: 'td-polygon-outline', type: 'line', source: 'td-polygon', paint: {
            'line-color':   ['get', 'polygonOutlineColor'],
            'line-width':   ['get', 'polygonOutlineWidth'],
            'line-opacity': ['get', 'polygonOutlineOpacity'],
        }});` : '',
    ].join('');
    const fontJson    = JSON.stringify(font);

    const iconLoadLines = Object.entries(iconDataMap).map(([name, url]) =>
      `        image = await map.loadImage("${url}");\n        map.addImage('${name}', image.data);`
    ).join('\n');

    const uniqueIcons = [...new Set(iconFeatures.map(f => f.properties.icon))];
    const iconLayersJs = uniqueIcons.map(name => `
        map.addLayer({
            id: '${name}',
            type: 'symbol',
            source: 'map-icons',
            filter: ['==', ['get', 'icon'], '${name}'],
            layout: {
                'icon-image':         '${name}',
                'icon-size':          ['get', 'iconSize'],
                'icon-allow-overlap': true,
            },
        });`).join('\n');

    const iconSourceJs = hasIcons ? `
        map.addSource('map-icons', {
            type: 'geojson',
            data: ${JSON.stringify({ type: 'FeatureCollection', features: iconFeatures }, null, 12)},
        });
${iconLayersJs}

        const _iwPanel = document.createElement('div');
        _iwPanel.id = 'iw-panel';
        _iwPanel.style.cssText = 'position:absolute;bottom:0;left:0;right:0;max-height:${Math.round(mapH / 3)}px;background:#fff;overflow-y:auto;padding:16px 20px;z-index:100;box-shadow:0 -4px 16px rgba(0,0,0,.15);box-sizing:border-box;width:fit-content;min-width:40%;max-width:80%;margin:0 auto 1em;transform:translateY(120%);transition:transform .3s ease;';
        _iwPanel.innerHTML = '<div id="iw-p-title" style="font-weight:700;margin-bottom:0;"></div><div id="iw-p-subhead" style="color:#555;margin-bottom:0;white-space:pre-wrap;"></div><div id="iw-p-text" style="font-size:.9em;margin-top:10px;line-height:1.5;"></div>';
        map.getContainer().appendChild(_iwPanel);

        const _iwShow = () => { _iwPanel.style.transform = 'translateY(0)'; };
        const _iwHide = () => { _iwPanel.style.transform = 'translateY(120%)'; };

        // Add highlight layer
        map.addLayer({
            id: 'map-icons-highlight',
            type: 'circle',
            source: 'map-icons',
            filter: ['==', ['id'], 'none'],
            paint: {
                'circle-radius': ['+', ['*', ['get', 'iconSize'], 10], 4],
                'circle-color': 'rgba(59, 130, 246, 0.2)',
                'circle-stroke-color': '#3b82f6',
                'circle-stroke-width': 2
            }
        }, '${uniqueIcons[0]}');

        let _selectedIconIdx = null;

        const _deselectIcon = () => {
            _selectedIconIdx = null;
            _iwHide();
            map.setFilter('map-icons-highlight', ['==', ['id'], 'none']);
        };

        map.on('click', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ${JSON.stringify(uniqueIcons)} });
            if (features.length === 0) {
                _deselectIcon();
                return;
            }

            const f = features[0];
            const p = f.properties;

            // Clicking the already-selected icon toggles it back off
            if (_selectedIconIdx === p._iwIdx) {
                _deselectIcon();
                return;
            }
            _selectedIconIdx = p._iwIdx;

            if (!p.iwTitle && !p.iwSubhead && !p.iwText) {
                _iwHide();
                map.setFilter('map-icons-highlight', ['==', ['id'], 'none']);
                return;
            }

            // Highlight
            // Since MapLibre features don't have stable IDs unless specified in GeoJSON,
            // and we are using unique icon layers, we filter the highlight layer by icon property
            map.setFilter('map-icons-highlight', ['==', ['get', 'icon'], p.icon]);

            const titleEl = document.getElementById('iw-p-title');
            const subheadEl = document.getElementById('iw-p-subhead');
            const textEl = document.getElementById('iw-p-text');

            titleEl.textContent   = p.iwTitle   || '';
            subheadEl.textContent = p.iwSubhead || '';
            textEl.innerHTML      = p.iwText    || '';

            const displayFont = (p.iwFont || 'Inter').replace(/\\+/g, ' ');
            _iwPanel.style.fontFamily = '"' + displayFont + '", sans-serif';
            _iwPanel.style.textAlign  = p.iwAlign || 'left';

            titleEl.style.fontSize = (p.iwSize * 1.2) + 'px';
            subheadEl.style.fontSize = (p.iwSize * 0.95) + 'px';
            textEl.style.fontSize = (p.iwSize * 0.9) + 'px';

            _iwShow();
        });` : '';

    const locatorJs = hasLocators ? locatorFeatures.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      const html = f.properties.text.replace(/\n/g, '<br>');
      const darkClass = f.properties.isDark ? ' lm-popup-dark' : '';
      // offsetX mirrors the CSS horizontal shift the locator-panel applies so the
      // popup tip lands at the same screen position as the live locator's tail tip.
      const offsetX = f.properties.offsetX || 0;
      return `        new maplibregl.Popup({ closeOnClick: false, closeButton: false, anchor: '${f.properties.anchor}', offset: [${offsetX}, 0], className: '${darkClass.trim()}' })
            .setLngLat([${lng}, ${lat}])
            .setHTML(${JSON.stringify(html)})
            .addTo(map);`;
    }).join('\n') : '';

    // Text overlays — recreated as left-anchored maplibregl.Markers carrying a
    // styled HTML <div>, mirroring the geo-anchored positioning used live
    // (anchor: 'left' pins the element's left edge to the stored coordinate).
    const textJs = hasText ? textFeatures.map(f => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const displayFont = (p.font || 'Inter').replace(/\+/g, ' ');
      const html = p.text.replace(/\n/g, '<br>');
      const weight      = p.bold      ? 'font-weight:700;'           : '';
      const styleIt     = p.italic    ? 'font-style:italic;'         : '';
      const decoration  = p.underline ? 'text-decoration:underline;' : '';
      const borderStyle = p.border     ? `border:2px solid ${p.borderColor};border-radius:3px;` : '';
      const bgStyle     = p.background ? `background-color:${p.bgColor};` : '';
      const padStyle    = (p.border || p.background) ? 'padding:5px 8px;display:inline-block;' : '';
      const elStyle = `font-family:"${displayFont}", sans-serif;font-size:${p.size}px;color:${p.color};` +
        `white-space:pre-wrap;line-height:1.3;${weight}${styleIt}${decoration}${borderStyle}${bgStyle}${padStyle}`;
      return `        (() => {
            const el = document.createElement('div');
            el.style.cssText = ${JSON.stringify(elStyle)};
            el.innerHTML = ${JSON.stringify(html)};
            new maplibregl.Marker({ element: el, anchor: 'left' })
                .setLngLat([${lng}, ${lat}])
                .addTo(map);
        })();`;
    }).join('\n') : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${fontLinks}
    <link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet">
    <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"><\/script>
    <script src="https://unpkg.com/pmtiles@3/dist/pmtiles.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        #map { width: 100%; height: ${mapH}px; }
        .maplibregl-popup-content { padding: 5px 10px; }
        .maplibregl-popup-tip { border-left-width: 5px; border-right-width: 5px; }
        .lm-popup-dark .maplibregl-popup-content { background: #000; color: #fff; }
        .lm-popup-dark.maplibregl-popup-anchor-top .maplibregl-popup-tip,
        .lm-popup-dark.maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
        .lm-popup-dark.maplibregl-popup-anchor-top-right .maplibregl-popup-tip { border-bottom-color: #000; }
        .lm-popup-dark.maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
        .lm-popup-dark.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
        .lm-popup-dark.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { border-top-color: #000; }
        .lm-popup-dark.maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: #000; }
        .lm-popup-dark.maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: #000; }
        #iw-p-text a { color: inherit; text-decoration: underline; }
        #iw-p-text ul, #iw-p-text ol { padding-left: 1.4em; margin: 4px 0; }
    </style>
</head>
<body>
<div id="map"></div>
<script>
    const _pmtilesProtocol = new pmtiles.Protocol();
    maplibregl.addProtocol('pmtiles', _pmtilesProtocol.tile.bind(_pmtilesProtocol));

    const map = new maplibregl.Map({
        container: 'map',
        style: ${JSON.stringify(styleObj)},
        center: [${center.lng.toFixed(6)}, ${center.lat.toFixed(6)}],
        zoom: ${zoom.toFixed(3)},
        attributionControl: false,${staticMap ? '\n        interactive: false,' : ''}
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
${zoomControl ? "    map.addControl(new maplibregl.NavigationControl());\n" : ''}${scaleBar ? "    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }));\n" : ''}
    map.on('load', async () => {
${hasIcons ? iconLoadLines + '\n' : ''}${iconSourceJs}${tdJs}${locatorJs}${textJs}
    });
<\/script>
</body>
</html>`;
  }
}
