/**
 * CustomExportControl — drop-in replacement for MaplibreExportControl that adds
 * a "Custom size" option alongside all the standard page sizes.
 *
 * Reuses MapGenerator from @watergis/maplibre-gl-export for all DPI scaling,
 * canvas rendering, and PDF/PNG/JPEG/SVG output logic.
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
// same MapLibre-specific implementation the package uses internally.
class MapGenerator extends MapGeneratorBase {
  getRenderedMap(container, style) {
    return new maplibregl.Map({
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
  }

  renderMapPost(map) {
    const terrain = this.map.getTerrain?.();
    if (terrain) map.setTerrain(terrain);
  }
}

const CUSTOM_KEY = '__custom__';

const DEFAULT_OPTIONS = {
  PageSize: Size.LETTER,
  PageOrientation: PageOrientation.Landscape,
  Format: Format.PDF,
  DPI: 150,
  Filename: 'map-export',
};

// Accept string keys like 'LETTER', 'PDF', 'Landscape', or raw values
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

export class CustomExportControl {
  constructor(options = {}) {
    this._options = normalizeOptions({ ...DEFAULT_OPTIONS, ...options });
  }

  onAdd(map) {
    this._map = map;

    // Outer ctrl wrapper (inherits maplibre button group styles)
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    // Toggle button — reuses the printer-icon class from the package CSS
    this._btn = document.createElement('button');
    this._btn.type = 'button';
    this._btn.className = 'maplibregl-export-control';
    this._btn.title = 'Export map';
    this._btn.setAttribute('aria-label', 'Export map');
    this._btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._panel.style.display =
        this._panel.style.display === 'block' ? 'none' : 'block';
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

    this._outsideClick = (e) => {
      if (!this._container.contains(e.target)) {
        this._panel.style.display = 'none';
      }
    };
    document.addEventListener('click', this._outsideClick);

    return this._container;
  }

  onRemove() {
    document.removeEventListener('click', this._outsideClick);
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }

  getDefaultPosition() {
    return 'top-right';
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildTable() {
    const table = document.createElement('table');
    table.className = 'print-table';
    table.style.cssText = 'border-collapse:collapse; width:100%;';

    table.appendChild(this._row('Page Size',    this._buildSizeSelect()));
    this._customRow = this._buildCustomRow();
    table.appendChild(this._customRow);
    this._orientRow = this._row('Orientation',  this._buildOrientationSelect());
    table.appendChild(this._orientRow);
    table.appendChild(this._row('Format',        this._buildFormatSelect()));
    table.appendChild(this._row('DPI',           this._buildDPISelect()));

    const btnRow = document.createElement('tr');
    const btnCell = document.createElement('td');
    btnCell.colSpan = 2;
    btnCell.style.paddingTop = '10px';

    const btn = document.createElement('button');
    btn.id = 'generate-button';
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

    tr.appendChild(th);
    tr.appendChild(td);
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
    const sizes = {};
    for (const [key, val] of Object.entries(Size)) {
      sizes[key] = val;
    }
    sizes['Custom…'] = CUSTOM_KEY;

    const sel = this._select(
      'mapbox-gl-export-page-size',
      sizes,
      this._options.PageSize,
    );

    sel.addEventListener('change', () => {
      const isCustom = sel.value === CUSTOM_KEY;
      this._customRow.style.display = isCustom ? '' : 'none';
      this._orientRow.style.display  = isCustom ? 'none' : '';
    });

    this._sizeSelect = sel;
    return sel;
  }

  _buildCustomRow() {
    const tr = document.createElement('tr');
    tr.style.display = 'none'; // hidden until Custom is chosen

    const th = document.createElement('td');
    th.style.cssText = 'font-size:12px; padding:3px 8px 3px 0; white-space:nowrap; color:#444;';
    th.textContent = 'W × H (mm)';

    const td = document.createElement('td');
    td.style.cssText = 'display:flex; gap:4px; align-items:center;';

    const numStyle =
      'width:60px; font-size:12px; padding:3px 4px; border:1px solid #ccc; border-radius:3px;';

    this._customW = document.createElement('input');
    this._customW.type = 'number';
    this._customW.min = 10;
    this._customW.max = 5000;
    this._customW.value = 279;
    this._customW.style.cssText = numStyle;

    this._customH = document.createElement('input');
    this._customH.type = 'number';
    this._customH.min = 10;
    this._customH.max = 5000;
    this._customH.value = 216;
    this._customH.style.cssText = numStyle;

    const x = document.createElement('span');
    x.textContent = '×';
    x.style.cssText = 'font-size:12px; color:#666;';

    td.appendChild(this._customW);
    td.appendChild(x);
    td.appendChild(this._customH);
    tr.appendChild(th);
    tr.appendChild(td);
    return tr;
  }

  _buildOrientationSelect() {
    const opts = {};
    for (const [key, val] of Object.entries(PageOrientation)) {
      opts[key] = val;
    }
    const sel = this._select(
      'mapbox-gl-export-page-orientation',
      opts,
      this._options.PageOrientation,
    );
    this._orientSelect = sel;
    return sel;
  }

  _buildFormatSelect() {
    const opts = {};
    for (const [key, val] of Object.entries(Format)) {
      opts[key] = val;
    }
    return this._select(
      'mapbox-gl-export-format-type',
      opts,
      this._options.Format,
    );
  }

  _buildDPISelect() {
    // Merge enum values with any custom DPI from options
    const vals = new Set([...Object.values(DPI), this._options.DPI]);
    const opts = {};
    [...vals].sort((a, b) => a - b).forEach(v => { opts[String(v)] = v; });
    return this._select(
      'mapbox-gl-export-dpi-type',
      opts,
      this._options.DPI,
    );
  }

  _generate() {
    this._panel.style.display = 'none';

    const formatSel = this._panel.querySelector('#mapbox-gl-export-format-type');
    const dpiSel    = this._panel.querySelector('#mapbox-gl-export-dpi-type');

    const format   = formatSel.value;
    const dpi      = Number(dpiSel.value);
    const filename = this._options.Filename;

    let size;
    if (this._sizeSelect.value === CUSTOM_KEY) {
      size = [Number(this._customW.value), Number(this._customH.value)];
    } else {
      size = JSON.parse(this._sizeSelect.value);
      const orient = this._orientSelect.value;
      // Landscape = wider side first; portrait = taller side first
      const [a, b] = size;
      if (orient === PageOrientation.Portrait  && a > b) size = [b, a];
      if (orient === PageOrientation.Landscape && a < b) size = [b, a];
    }

    const generator = new MapGenerator(
      this._map,
      size,
      dpi,
      format,
      Unit.mm,
      filename,
    );
    generator.generate();
  }
}
