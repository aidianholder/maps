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
    const m = new maplibregl.Map({
      container,
      style,
      center: this.map.getCenter(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      preserveDrawingBuffer: true,
      fadeDuration: 0,
      attributionControl: false,
    });
    m.on('load',  () => console.log('[export] hidden map: load'));
    m.on('idle',  () => console.log('[export] hidden map: idle'));
    m.on('error', (e) => console.error('[export] hidden map error:', e?.error?.message, e?.error));
    return m;
  }

  renderMapPost(map) {
    const terrain = this.map.getTerrain?.();
    if (terrain) map.setTerrain(terrain);
    return map;
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
