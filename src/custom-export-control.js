/**
 * CustomExportControl — drop-in replacement for MaplibreExportControl.
 *
 * Adds a "Custom size" option and a live overlay showing the exact export area.
 * Reuses MapGeneratorBase from @watergis/maplibre-gl-export for all DPI
 * scaling, canvas rendering, and PDF/PNG/JPEG/SVG output.
 */
import maplibregl from 'maplibre-gl';
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
    // returns a 2D composite canvas with locator labels painted on top.
    const origGetCanvas = map.getCanvas.bind(map);
    const self = this;
    map.getCanvas = function () {
      const webgl = origGetCanvas();
      const withLocators = self._compositeLocators(webgl, map);
      return self._compositeIcons(withLocators, map);
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
      const cx = hiddenPt.x * scale;
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
        posLeft:   el.classList.contains('lm-pos-left'),
        posRight:  el.classList.contains('lm-pos-right'),
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

    // Box top-left based on anchor type
    let boxX, boxY;
    if (tailDown) {
      boxX = anchorX - boxW / 2;
      boxY = anchorY - tailH - boxH;
      if (posLeft)  boxX = anchorX - 18.5 * scale;
      if (posRight) boxX = anchorX - boxW + 18.5 * scale;
    } else if (tailUp) {
      boxX = anchorX - boxW / 2;
      boxY = anchorY + tailH;
      if (posLeft)  boxX = anchorX - 18.5 * scale;
      if (posRight) boxX = anchorX - boxW + 18.5 * scale;
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
      const shaftX    = posLeft  ? boxX + 18.5 * scale - shaftW / 2
                      : posRight ? boxX + boxW - 18.5 * scale - shaftW / 2
                      :            anchorX - shaftW / 2;
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
      const tailBaseX = posLeft  ? boxX + 18.5 * scale
                      : posRight ? boxX + boxW - 18.5 * scale
                      :            anchorX;
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
      }
    };
    document.addEventListener('click', this._outsideClick);

    // Build the SVG overlay; show once the map has rendered so dimensions are ready
    this._createOverlay();
    if (this._map.loaded()) {
      this._showOverlay();
    } else {
      this._map.once('load', () => this._showOverlay());
    }

    // Keep overlay in sync with map resizes
    this._onResize = () => { if (this._overlayVisible) this._updateOverlay(); };
    this._map.on('resize', this._onResize);

    return this._container;
  }

  onRemove() {
    document.removeEventListener('click', this._outsideClick);
    this._map.getContainer().removeEventListener('mapstylechange', this._onStyleChange);
    this._map.off('resize', this._onResize);
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
    const sizes = { ...Object.fromEntries(Object.entries(Size)), 'Custom…': CUSTOM_KEY };

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
      if (this._dpiRow) this._dpiRow.style.display = sel.value === 'html' ? 'none' : '';
    });
    return sel;
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
    if (format === 'html') { this._generateHtml(); return; }
    const dpi  = Number(this._panel.querySelector('#mapbox-gl-export-dpi-type').value);
    const size = this._getCurrentExportSize();
    new MapGenerator(this._map, size, dpi, format, Unit.mm, this._options.Filename).generate();
  }

  // ── HTML embed export ──────────────────────────────────────────────────────

  _generateHtml() {
    const center = this._map.getCenter();
    const zoom   = this._map.getZoom();
    const styleUrl = this._options.StyleURLMap?.[this._styleUrl]
      ?? new URL(this._styleUrl || '', window.location.href).href;

    // Map dimensions from the current export overlay
    const [mmW, mmH] = this._getCurrentExportSize();
    const pxPerMm = SCREEN_DPI / MM_PER_INCH;
    const maxW = Math.round(mmW * pxPerMm);
    const mapH = Math.round(mmH * pxPerMm);

    const locatorFeatures = this._collectLocatorFeatures();
    const { iconFeatures, iconDataMap } = this._collectIconData();
    const font = this._detectStyleFont();

    const html = this._buildHtml({
      center, zoom, styleUrl, maxW, mapH,
      locatorFeatures, iconFeatures, iconDataMap, font,
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
            textColor,
            haloColor,
            haloWidth,
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
      if (name && !iconDataMap[name]) iconDataMap[name] = `${BASE}${name}.png`;
    }

    const iconFeatures = iconEls
      .filter(el => el.dataset.icon)
      .map(el => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [
          parseFloat(el.getAttribute('data-lng')),
          parseFloat(el.getAttribute('data-lat')),
        ]},
        properties: { icon: el.dataset.icon },
      }));

    return { iconFeatures, iconDataMap };
  }

  _buildHtml({ center, zoom, styleUrl, maxW, mapH, locatorFeatures, iconFeatures, iconDataMap, font }) {
    const hasLocators = locatorFeatures.length > 0;
    const hasIcons    = iconFeatures.length > 0;
    const fontJson    = JSON.stringify(font);

    const iconLoadLines = Object.entries(iconDataMap).map(([name, url]) =>
      `        image = await map.loadImage("${url}");\n        map.addImage('${name}', image.data);`
    ).join('\n');

    const iconSourceJs = hasIcons ? `
        map.addSource('map-icons', {
            type: 'geojson',
            data: ${JSON.stringify({ type: 'FeatureCollection', features: iconFeatures }, null, 12)},
        });
        map.addLayer({
            id: 'map-icons',
            type: 'symbol',
            source: 'map-icons',
            layout: {
                'icon-image':         ['get', 'icon'],
                'icon-size':          1,
                'icon-allow-overlap': true,
            },
        });` : '';

    const locatorJs = hasLocators ? `
        map.addSource('locators', {
            type: 'geojson',
            data: ${JSON.stringify({ type: 'FeatureCollection', features: locatorFeatures }, null, 12)},
        });
        map.addLayer({
            id: 'locators',
            type: 'symbol',
            source: 'locators',
            layout: {
                'text-field':            ['get', 'text'],
                'text-size':             ['get', 'fontSize'],
                'text-font':             ${fontJson},
                'text-anchor':           ['get', 'anchor'],
                'text-allow-overlap':    true,
                'text-ignore-placement': false,
            },
            paint: {
                'text-color':      ['get', 'textColor'],
                'text-halo-color': ['get', 'haloColor'],
                'text-halo-width': ['get', 'haloWidth'],
            },
        });` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet">
    <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        #map { width: 100%; max-width: ${maxW}px; height: ${mapH}px; }
    </style>
</head>
<body>
<div id="map"></div>
<script>
    const map = new maplibregl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${center.lng.toFixed(6)}, ${center.lat.toFixed(6)}],
        zoom: ${zoom.toFixed(3)},
    });

    map.on('load', async () => {
${hasIcons ? iconLoadLines + '\n' : ''}${iconSourceJs}${locatorJs}
    });
<\/script>
</body>
</html>`;
  }
}
