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
    const cssW  = hiddenMap.getContainer().offsetWidth;
    const scale = webglCanvas.width / (cssW || 1);

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
      const text      = textEl?.textContent?.trim() ?? '';
      if (!text) continue;

      const fontFamily = bodyEl?.style.fontFamily || '"Inter", sans-serif';
      const fontSize   = (parseFloat(bodyEl?.style.fontSize) || 14) * scale;

      this._drawLocatorLabel(ctx, cx, cy, text, {
        fontFamily,
        fontSize,
        scale,
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
    const cssW  = hiddenMap.getContainer().offsetWidth;
    const scale = baseCanvas.width / (cssW || 1);

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
    const { fontFamily, fontSize, scale, isDark, isWhite, isPlain, isLine,
            tailDown, tailUp, posLeft, posRight } = opts;

    const padX   = 10 * scale;
    const padY   =  5 * scale;
    const tailH  = 11 * scale;
    const tailHW =  4.5 * scale;   // half-width of tail base
    const radius =  5 * scale;

    ctx.font = `${fontSize}px ${fontFamily}`;
    const textW = ctx.measureText(text).width;
    const boxW  = textW + padX * 2;
    const boxH  = fontSize + padY * 2;

    // Determine box top-left position based on anchor type
    let boxX, boxY;
    if (tailDown) {
      // anchor = bottom → tail tip is at anchor; box sits above
      boxX = anchorX - boxW / 2;
      boxY = anchorY - tailH - boxH;
      if (posLeft)  boxX = anchorX - 14 * scale;
      if (posRight) boxX = anchorX - boxW + 14 * scale;
    } else if (tailUp) {
      // anchor = top → tail tip is at anchor; box sits below
      boxX = anchorX - boxW / 2;
      boxY = anchorY + tailH;
      if (posLeft)  boxX = anchorX - 14 * scale;
      if (posRight) boxX = anchorX - boxW + 14 * scale;
    } else {
      // plain / center anchor
      boxX = anchorX - boxW / 2;
      boxY = anchorY - boxH / 2;
    }

    if (isPlain) {
      // Plain text with white halo
      ctx.textBaseline = 'middle';
      ctx.lineWidth    = 3 * scale;
      ctx.strokeStyle  = 'rgba(255,255,255,0.92)';
      ctx.strokeText(text, boxX + padX, boxY + boxH / 2);
      ctx.fillStyle    = '#1a1a1a';
      ctx.fillText(text, boxX + padX, boxY + boxH / 2);
      return;
    }

    if (isLine) {
      const shaftH  = 22 * scale;
      const shaftW  = 1.5 * scale;
      const shaftColor = '#333333';

      // Shaft x-position within the element matches CSS pos rules (14px offset)
      const shaftX = posLeft  ? boxX + 14 * scale - shaftW / 2
                   : posRight ? boxX + boxW - 14 * scale - shaftW / 2
                              : anchorX - shaftW / 2; // center

      // Draw shaft line
      ctx.fillStyle = shaftColor;
      if (tailDown) {
        ctx.fillRect(shaftX, boxY + boxH, shaftW, shaftH);
      } else if (tailUp) {
        ctx.fillRect(shaftX, boxY - shaftH, shaftW, shaftH);
      }

      // Draw text with white halo
      ctx.font         = `bold ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.lineWidth    = Math.max(2, 3 * scale);
      ctx.strokeStyle  = 'rgba(255,255,255,0.95)';
      ctx.strokeText(text, boxX + padX, boxY + boxH / 2);
      ctx.fillStyle    = '#1a1a1a';
      ctx.fillText(text, boxX + padX, boxY + boxH / 2);
      return;
    }

    const bgColor   = isDark  ? '#1a1a1a' : '#ffffff';
    const textColor = isDark  ? '#ffffff' : '#1a1a1a';

    // ── Draw rounded box ───────────────────────────────────────────────────
    ctx.fillStyle = bgColor;
    this._roundRect(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.fill();

    // ── Draw tail ──────────────────────────────────────────────────────────
    if (tailDown || tailUp) {
      const tailBaseX = posLeft  ? boxX + 14 * scale
                      : posRight ? boxX + boxW - 14 * scale
                                 : anchorX;
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

    // ── Draw text ──────────────────────────────────────────────────────────
    ctx.fillStyle    = textColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, boxX + padX, boxY + boxH / 2);
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
      if (opening) {
        this._showOverlay();
      } else {
        this._hideOverlay();
      }
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

    // Close panel + hide overlay on outside click
    this._outsideClick = (e) => {
      if (!this._container.contains(e.target)) {
        this._panel.style.display = 'none';
        this._hideOverlay();
      }
    };
    document.addEventListener('click', this._outsideClick);

    // Build the SVG overlay (hidden until panel opens)
    this._createOverlay();

    // Keep overlay in sync with map resizes
    this._onResize = () => { if (this._overlayVisible) this._updateOverlay(); };
    this._map.on('resize', this._onResize);

    return this._container;
  }

  onRemove() {
    document.removeEventListener('click', this._outsideClick);
    this._map.off('resize', this._onResize);
    this._overlay?.remove();
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
  }

  _showOverlay() {
    this._overlayVisible = true;
    this._overlay.style.display = '';
    this._updateOverlay();
  }

  _hideOverlay() {
    this._overlayVisible = false;
    this._overlay.style.display = 'none';
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

    table.appendChild(this._row('Page Size',  this._buildSizeSelect()));
    this._customRow = this._buildCustomRow();
    table.appendChild(this._customRow);
    this._orientRow = this._row('Orientation', this._buildOrientationSelect());
    table.appendChild(this._orientRow);
    table.appendChild(this._row('Format',      this._buildFormatSelect()));
    table.appendChild(this._row('DPI',         this._buildDPISelect()));

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
      this._customRow.style.display = isCustom ? '' : 'none';
      this._orientRow.style.display = isCustom ? 'none' : '';
      if (this._overlayVisible) this._updateOverlay();
    });

    this._sizeSelect = sel;
    return sel;
  }

  _buildCustomRow() {
    const tr = document.createElement('tr');
    tr.style.display = 'none';

    const th = document.createElement('td');
    th.style.cssText = 'font-size:12px; padding:3px 8px 3px 0; white-space:nowrap; color:#444;';
    th.textContent = 'W × H (mm)';

    const td = document.createElement('td');
    td.style.cssText = 'display:flex; gap:4px; align-items:center;';

    const numStyle =
      'width:60px; font-size:12px; padding:3px 4px; border:1px solid #ccc; border-radius:3px;';

    this._customW = document.createElement('input');
    this._customW.type = 'number'; this._customW.min = 10;
    this._customW.max = 5000; this._customW.value = 279;
    this._customW.style.cssText = numStyle;

    this._customH = document.createElement('input');
    this._customH.type = 'number'; this._customH.min = 10;
    this._customH.max = 5000; this._customH.value = 216;
    this._customH.style.cssText = numStyle;

    const x = document.createElement('span');
    x.textContent = '×';
    x.style.cssText = 'font-size:12px; color:#666;';

    const onCustomChange = () => { if (this._overlayVisible) this._updateOverlay(); };
    this._customW.addEventListener('input', onCustomChange);
    this._customH.addEventListener('input', onCustomChange);

    td.append(this._customW, x, this._customH);
    tr.append(th, td);
    return tr;
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
    return this._select(
      'mapbox-gl-export-format-type',
      Object.fromEntries(Object.entries(Format)),
      this._options.Format);
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
    this._hideOverlay();

    const format = this._panel.querySelector('#mapbox-gl-export-format-type').value;
    const dpi    = Number(this._panel.querySelector('#mapbox-gl-export-dpi-type').value);
    const size   = this._getCurrentExportSize();

    new MapGenerator(this._map, size, dpi, format, Unit.mm, this._options.Filename).generate();
  }
}
