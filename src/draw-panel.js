import { TerraDraw } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  TerraDrawPointMode,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawCircleMode,
  TerraDrawSelectMode,
} from 'terra-draw';

// ── Global default styles ──────────────────────────────────────────────────
// Used as the default for newly drawn features.  Each committed feature gets
// these values baked into its own GeoJSON properties so it can be styled
// independently later.

const STYLES = {
  point: {
    color:        '#e03444',
    outlineColor: '#ffffff',
    width:        8,
  },
  linestring: {
    color: '#3388ff',
    width: 2,
  },
  polygon: {
    fillColor:    '#3388ff',
    fillOpacity:  0.3,
    outlineColor: '#1a66cc',
    outlineWidth: 2,
  },
  circle: {
    fillColor:    '#3388ff',
    fillOpacity:  0.3,
    outlineColor: '#1a66cc',
    outlineWidth: 2,
  },
};

// Maps STYLES keys → terra-draw feature property keys (what setFeatureProperty / getSnapshot uses)
const PROP_MAP = {
  point: {
    color:        'pointColor',
    width:        'pointWidth',
    outlineColor: 'pointOutlineColor',
  },
  linestring: {
    color: 'lineStringColor',
    width: 'lineStringWidth',
  },
  polygon: {
    fillColor:    'polygonFillColor',
    fillOpacity:  'polygonFillOpacity',
    outlineColor: 'polygonOutlineColor',
    outlineWidth: 'polygonOutlineWidth',
  },
  circle: {
    // circles are stored as Polygon geometry, same property names
    fillColor:    'polygonFillColor',
    fillOpacity:  'polygonFillOpacity',
    outlineColor: 'polygonOutlineColor',
    outlineWidth: 'polygonOutlineWidth',
  },
};

// ── Per-map registry ───────────────────────────────────────────────────────

const _registry = new WeakMap();
export function getDrawPanel(map) { return _registry.get(map); }

// ── DrawPanel ──────────────────────────────────────────────────────────────

export class DrawPanel {
  constructor(map) {
    this._map        = map;
    this._draw       = null;
    this._active     = null;   // active mode name, or null
    this._selectedId = null;   // ID of the feature selected in select mode
  }

  mount(container) {
    this._container = container;

    const panel = document.createElement('div');
    panel.id = 'draw-panel';

    // ── Header ──────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'dp-header';
    const title = document.createElement('h2');
    title.textContent = 'Draw';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dp-close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._deactivate();
      container.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
    });
    header.append(title, closeBtn);

    // ── Mode buttons ─────────────────────────────────────────────────
    const modeRow = document.createElement('div');
    modeRow.className = 'dp-mode-row';
    this._modeBtns = {};
    [
      { id: 'point',      icon: '●', title: 'Point'   },
      { id: 'linestring', icon: '╱', title: 'Line'    },
      { id: 'circle',     icon: '○', title: 'Circle'  },
      { id: 'polygon',    icon: '⬡', title: 'Polygon' },
      { id: 'select',     icon: '↖', title: 'Select'  },
    ].forEach(({ id, icon, title: t }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dp-mode-btn';
      btn.textContent = icon;
      btn.title = t;
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleMode(id); });
      modeRow.appendChild(btn);
      this._modeBtns[id] = btn;
    });

    // ── Style controls area ───────────────────────────────────────────
    this._styleArea = document.createElement('div');
    this._styleArea.className = 'dp-styles';

    panel.append(header, modeRow, this._styleArea);
    container.appendChild(panel);

    _registry.set(this._map, this);

    new MutationObserver(() => {
      if (!container.classList.contains('open') && this._active) this._deactivate();
    }).observe(container, { attributes: true, attributeFilter: ['class'] });

    if (this._map.loaded()) {
      this._initDraw();
    } else {
      this._map.once('load', () => this._initDraw());
    }
  }

  // ── Terra-draw setup ───────────────────────────────────────────────────────

  _initDraw() {
    this._draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({
        map: this._map,
        minPixelDragDistance:          8,
        minPixelDragDistanceDrawing:   8,
        minPixelDragDistanceSelecting: 8,
      }),
      modes: [
        new TerraDrawPointMode({
          styles: {
            // Read stored per-feature value first; fall back to global default
            pointColor:        (f) => f.properties.pointColor        ?? STYLES.point.color,
            pointWidth:        (f) => f.properties.pointWidth        ?? STYLES.point.width,
            pointOutlineColor: (f) => f.properties.pointOutlineColor ?? STYLES.point.outlineColor,
            pointOutlineWidth: 1,
          },
        }),
        new TerraDrawLineStringMode({
          editable: false,
          styles: {
            lineStringColor: (f) => f.properties.lineStringColor ?? STYLES.linestring.color,
            lineStringWidth: (f) => f.properties.lineStringWidth ?? STYLES.linestring.width,
          },
        }),
        new TerraDrawPolygonMode({
          styles: {
            fillColor:    (f) => f.properties.polygonFillColor    ?? STYLES.polygon.fillColor,
            fillOpacity:  (f) => f.properties.polygonFillOpacity  ?? STYLES.polygon.fillOpacity,
            outlineColor: (f) => f.properties.polygonOutlineColor ?? STYLES.polygon.outlineColor,
            outlineWidth: (f) => f.properties.polygonOutlineWidth ?? STYLES.polygon.outlineWidth,
          },
        }),
        new TerraDrawCircleMode({
          styles: {
            fillColor:    (f) => f.properties.polygonFillColor    ?? STYLES.circle.fillColor,
            fillOpacity:  (f) => f.properties.polygonFillOpacity  ?? STYLES.circle.fillOpacity,
            outlineColor: (f) => f.properties.polygonOutlineColor ?? STYLES.circle.outlineColor,
            outlineWidth: (f) => f.properties.polygonOutlineWidth ?? STYLES.circle.outlineWidth,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon:    { feature: { draggable: true, rotateable: true, scaleable: true,
                            coordinates: { midpoints: true, draggable: true, deletable: true } } },
            linestring: { feature: { draggable: true,
                            coordinates: { midpoints: true, draggable: true, deletable: true } } },
            point:      { feature: { draggable: true } },
            circle:     { feature: { draggable: true } },
          },
        }),
      ],
    });

    this._draw.start();

    // MapLibre ≥5.8 sets line-dasharray:[] which makes lines invisible
    try { this._map.setPaintProperty('td-linestring', 'line-dasharray', null); } catch (_) {}

    // ── Bake current styles into each feature when it is committed ─────────
    this._draw.on('finish', (id) => {
      const feature = this._draw.getSnapshotFeature(id);
      if (feature) this._bakeStyleToFeature(id, feature.properties?.mode);
    });

    // ── When a feature is selected: sync style panel to its stored values ──
    this._draw.on('select', (id) => {
      this._selectedId = id;
      const feature = this._draw.getSnapshotFeature(id);
      if (!feature) return;
      const mode = feature.properties?.mode;
      if (!PROP_MAP[mode]) return;  // ignore helper/guidance features
      this._syncStylesFromFeature(feature);
      this._renderStyleControls(mode);
    });

    // ── When deselected: clear selection and reset style area ──────────────
    this._draw.on('deselect', () => {
      this._selectedId = null;
      if (this._active === 'select') {
        this._styleArea.innerHTML = '';
        const hint = document.createElement('p');
        hint.className = 'dp-hint';
        hint.textContent = 'Click a feature to edit its style.';
        this._styleArea.appendChild(hint);
      }
    });
  }

  // ── Bake current STYLES into a committed feature's GeoJSON properties ──────

  _bakeStyleToFeature(id, mode) {
    if (!mode || !PROP_MAP[mode]) return;
    const s = STYLES[mode];
    const props = {};
    for (const [stylesKey, tdKey] of Object.entries(PROP_MAP[mode])) {
      props[tdKey] = s[stylesKey];
    }
    try { this._draw.updateFeatureProperties(id, props); } catch (_) {}
  }

  // ── Read a feature's stored style back into the global STYLES defaults ─────

  _syncStylesFromFeature(feature) {
    const p    = feature.properties;
    const mode = p?.mode;
    if (!mode) return;
    if (mode === 'point') {
      if (p.pointColor        != null) STYLES.point.color        = p.pointColor;
      if (p.pointWidth        != null) STYLES.point.width        = p.pointWidth;
      if (p.pointOutlineColor != null) STYLES.point.outlineColor = p.pointOutlineColor;
    } else if (mode === 'linestring') {
      if (p.lineStringColor != null) STYLES.linestring.color = p.lineStringColor;
      if (p.lineStringWidth != null) STYLES.linestring.width = p.lineStringWidth;
    } else if (mode === 'polygon' || mode === 'circle') {
      if (p.polygonFillColor    != null) STYLES[mode].fillColor    = p.polygonFillColor;
      if (p.polygonFillOpacity  != null) STYLES[mode].fillOpacity  = p.polygonFillOpacity;
      if (p.polygonOutlineColor != null) STYLES[mode].outlineColor = p.polygonOutlineColor;
      if (p.polygonOutlineWidth != null) STYLES[mode].outlineWidth = p.polygonOutlineWidth;
    }
  }

  // ── Mode toggling ──────────────────────────────────────────────────────────

  _toggleMode(mode) {
    if (!this._draw) return;
    if (this._active === mode) { this._deactivate(); return; }
    if (this._active) this._modeBtns[this._active].classList.remove('dp-mode-active');
    this._active     = mode;
    this._selectedId = null;
    this._draw.setMode(mode);
    this._modeBtns[mode].classList.add('dp-mode-active');
    if (mode === 'select') {
      this._styleArea.innerHTML = '';
      const hint = document.createElement('p');
      hint.className = 'dp-hint';
      hint.textContent = 'Click a feature to edit its style.';
      this._styleArea.appendChild(hint);
    } else {
      this._renderStyleControls(mode);
    }
  }

  _deactivate() {
    if (this._active) {
      this._modeBtns[this._active].classList.remove('dp-mode-active');
      this._active     = null;
      this._selectedId = null;
      if (this._draw) this._draw.setMode('static');
    }
    this._styleArea.innerHTML = '';
  }

  // ── Style controls ─────────────────────────────────────────────────────────

  _renderStyleControls(mode) {
    this._styleArea.innerHTML = '';
    if (mode === 'select') return;

    const s = STYLES[mode];

    // Called whenever a control changes value
    const onChange = (stylesKey, value) => {
      s[stylesKey] = value;
      if (this._selectedId) {
        // Edit the selected feature in-place
        const tdKey = PROP_MAP[mode]?.[stylesKey];
        if (tdKey) {
          try { this._draw.updateFeatureProperties(this._selectedId, { [tdKey]: value }); } catch (_) {}
        }
        // updateFeatureProperties triggers terra-draw's own re-render; no mode bounce needed
      } else {
        this._refreshStyles();
      }
    };

    const row = (label, control) => {
      const r   = document.createElement('div');  r.className = 'dp-row';
      const lbl = document.createElement('label'); lbl.className = 'dp-label'; lbl.textContent = label;
      r.append(lbl, control);
      this._styleArea.appendChild(r);
    };

    const colorPicker = (label, stylesKey) => {
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = s[stylesKey]; inp.className = 'dp-color';
      inp.addEventListener('input', () => onChange(stylesKey, inp.value));
      return inp;
    };

    const slider = (label, stylesKey, min, max, step, suffix = '') => {
      const wrap = document.createElement('div'); wrap.className = 'dp-slider-wrap';
      const inp  = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = s[stylesKey];
      inp.className = 'dp-slider';
      const val = document.createElement('span');
      val.className = 'dp-slider-val'; val.textContent = s[stylesKey] + suffix;
      inp.addEventListener('input', () => {
        val.textContent = inp.value + suffix;
        onChange(stylesKey, Number(inp.value));
      });
      wrap.append(inp, val);
      return wrap;
    };

    if (mode === 'point') {
      row('Color', colorPicker('Color', 'color'));
      row('Size',  slider('Size', 'width', 2, 20, 1, 'px'));
    }
    if (mode === 'linestring') {
      row('Color', colorPicker('Color', 'color'));
      row('Width', slider('Width', 'width', 1, 12, 0.5, 'px'));
    }
    if (mode === 'polygon' || mode === 'circle') {
      row('Fill',    colorPicker('Fill',    'fillColor'));
      row('Opacity', slider('Opacity',      'fillOpacity',  0,  1, 0.05));
      row('Border',  colorPicker('Border',  'outlineColor'));
      row('B.Width', slider('B.Width',      'outlineWidth', 0, 10, 0.5, 'px'));
    }
  }

  // ── Export snapshot ────────────────────────────────────────────────────────
  // Returns committed features, each enriched with its stored per-feature style
  // properties (falling back to the global STYLES defaults for older features).

  getSnapshot() {
    if (!this._draw) return [];
    return this._draw.getSnapshot()
      .filter(f => {
        const mode = f.properties?.mode;
        return (mode === 'point' || mode === 'linestring' ||
                mode === 'polygon' || mode === 'circle') &&
               !f.properties?.CURRENTLY_DRAWING;
      })
      .map(f => {
        const mode = f.properties.mode;
        const p    = f.properties;
        let styleProps = {};
        if (mode === 'point') {
          styleProps = {
            pointColor:          p.pointColor         ?? STYLES.point.color,
            pointWidth:          p.pointWidth         ?? STYLES.point.width,
            pointOutlineColor:   p.pointOutlineColor  ?? STYLES.point.outlineColor,
            pointOutlineWidth:   1,
            pointOpacity:        1,
            pointOutlineOpacity: 1,
          };
        } else if (mode === 'linestring') {
          styleProps = {
            lineStringColor:   p.lineStringColor   ?? STYLES.linestring.color,
            lineStringWidth:   p.lineStringWidth   ?? STYLES.linestring.width,
            lineStringOpacity: 1,
          };
        } else { // polygon / circle
          styleProps = {
            polygonFillColor:      p.polygonFillColor    ?? STYLES[mode].fillColor,
            polygonFillOpacity:    p.polygonFillOpacity  ?? STYLES[mode].fillOpacity,
            polygonOutlineColor:   p.polygonOutlineColor ?? STYLES[mode].outlineColor,
            polygonOutlineWidth:   p.polygonOutlineWidth ?? STYLES[mode].outlineWidth,
            polygonOutlineOpacity: 1,
          };
        }
        return { ...f, properties: { ...f.properties, ...styleProps } };
      });
  }

  // Force terra-draw to re-render in-progress drawing with updated style closures.
  // Only needed for drawing modes — select mode updates via setFeatureProperty.
  _refreshStyles() {
    if (!this._draw || !this._active || this._active === 'select') return;
    this._draw.setMode('static');
    this._draw.setMode(this._active);
  }
}
