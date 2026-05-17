import { TerraDraw } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  TerraDrawPointMode,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawCircleMode,
  TerraDrawSelectMode,
} from 'terra-draw';

// ── Style state (mutable; style functions close over this) ─────────────────

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

// ── Per-map registry (lets the export control find the panel at export time) ─

const _registry = new WeakMap();
export function getDrawPanel(map) { return _registry.get(map); }

// ── DrawPanel ──────────────────────────────────────────────────────────────

export class DrawPanel {
  constructor(map) {
    this._map    = map;
    this._draw   = null;
    this._active = null;   // currently active mode name, or null
  }

  mount(container) {
    this._container = container;

    // ── Panel wrapper ──────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'draw-panel';

    // ── Header ─────────────────────────────────────────────────────
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

    // ── Mode buttons ───────────────────────────────────────────────
    const modeRow = document.createElement('div');
    modeRow.className = 'dp-mode-row';

    this._modeBtns = {};
    [
      { id: 'point',      icon: '●',  title: 'Point'   },
      { id: 'linestring', icon: '╱',  title: 'Line'    },
      { id: 'circle',     icon: '○',  title: 'Circle'  },
      { id: 'polygon',    icon: '⬡',  title: 'Polygon' },
      { id: 'select',     icon: '↖',  title: 'Select'  },
    ].forEach(({ id, icon, title: t }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dp-mode-btn';
      btn.textContent = icon;
      btn.title = t;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleMode(id);
      });
      modeRow.appendChild(btn);
      this._modeBtns[id] = btn;
    });

    // ── Style controls area ────────────────────────────────────────
    this._styleArea = document.createElement('div');
    this._styleArea.className = 'dp-styles';

    panel.append(header, modeRow, this._styleArea);
    container.appendChild(panel);

    // Register so the export control can find us
    _registry.set(this._map, this);

    // Deactivate when dropdown is closed from outside (toolbar click-away)
    new MutationObserver(() => {
      if (!container.classList.contains('open') && this._active) {
        this._deactivate();
      }
    }).observe(container, { attributes: true, attributeFilter: ['class'] });

    // Init terra-draw once the map is ready
    if (this._map.loaded()) {
      this._initDraw();
    } else {
      this._map.once('load', () => this._initDraw());
    }
  }

  // ── Terra-draw setup ───────────────────────────────────────────────────────

  _initDraw() {
    const s = STYLES;

    this._draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({
        map: this._map,
        // Default threshold of 1px treats nearly every click as a drag.
        // Raise it so normal user clicks reliably fire onClick.
        minPixelDragDistance:         8,
        minPixelDragDistanceDrawing:  8,
        minPixelDragDistanceSelecting: 8,
      }),
      modes: [
        new TerraDrawPointMode({
          styles: {
            pointColor:        () => s.point.color,
            pointWidth:        () => s.point.width,
            pointOutlineColor: () => s.point.outlineColor,
            pointOutlineWidth: 1,
          },
        }),
        new TerraDrawLineStringMode({
          editable: false,   // prevent drag-edit from interfering with click-to-place
          styles: {
            lineStringColor: () => s.linestring.color,
            lineStringWidth: () => s.linestring.width,
          },
        }),
        new TerraDrawPolygonMode({
          styles: {
            fillColor:    () => s.polygon.fillColor,
            fillOpacity:  () => s.polygon.fillOpacity,
            outlineColor: () => s.polygon.outlineColor,
            outlineWidth: () => s.polygon.outlineWidth,
          },
        }),
        new TerraDrawCircleMode({
          styles: {
            fillColor:    () => s.circle.fillColor,
            fillOpacity:  () => s.circle.fillOpacity,
            outlineColor: () => s.circle.outlineColor,
            outlineWidth: () => s.circle.outlineWidth,
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

    // In MapLibre ≥5.8 the adapter sets line-dasharray:[] on the td-linestring
    // layer which makes lines invisible (empty dash pattern = nothing rendered).
    // Remove the property so the line renders solid.
    try { this._map.setPaintProperty('td-linestring', 'line-dasharray', null); } catch (_) {}
  }

  // ── Mode toggling ──────────────────────────────────────────────────────────

  _toggleMode(mode) {
    if (!this._draw) return;

    if (this._active === mode) {
      this._deactivate();
      return;
    }

    // Deactivate previous
    if (this._active) {
      this._modeBtns[this._active].classList.remove('dp-mode-active');
    }

    this._active = mode;
    this._draw.setMode(mode);
    this._modeBtns[mode].classList.add('dp-mode-active');
    this._renderStyleControls(mode);
  }

  _deactivate() {
    if (this._active) {
      this._modeBtns[this._active].classList.remove('dp-mode-active');
      this._active = null;
      if (this._draw) this._draw.setMode('static');
    }
    this._styleArea.innerHTML = '';
  }

  // ── Style controls ─────────────────────────────────────────────────────────

  _renderStyleControls(mode) {
    this._styleArea.innerHTML = '';

    if (mode === 'select') return; // no style controls for select

    const s = STYLES[mode];

    const row = (label, control) => {
      const r = document.createElement('div');
      r.className = 'dp-row';
      const lbl = document.createElement('label');
      lbl.className = 'dp-label';
      lbl.textContent = label;
      r.append(lbl, control);
      this._styleArea.appendChild(r);
    };

    const colorPicker = (key, stateObj) => {
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = stateObj[key];
      inp.className = 'dp-color';
      inp.addEventListener('input', () => {
        stateObj[key] = inp.value;
        this._refreshStyles();
      });
      return inp;
    };

    const slider = (key, stateObj, min, max, step, suffix = '') => {
      const wrap = document.createElement('div');
      wrap.className = 'dp-slider-wrap';
      const inp = document.createElement('input');
      inp.type  = 'range';
      inp.min   = min;
      inp.max   = max;
      inp.step  = step;
      inp.value = stateObj[key];
      inp.className = 'dp-slider';
      const val = document.createElement('span');
      val.className = 'dp-slider-val';
      val.textContent = stateObj[key] + suffix;
      inp.addEventListener('input', () => {
        stateObj[key] = Number(inp.value);
        val.textContent = inp.value + suffix;
        this._refreshStyles();
      });
      wrap.append(inp, val);
      return wrap;
    };

    if (mode === 'point') {
      row('Color',   colorPicker('color',        s));
      row('Size',    slider('width',             s, 2, 20, 1, 'px'));
    }

    if (mode === 'linestring') {
      row('Color',   colorPicker('color',        s));
      row('Width',   slider('width',             s, 1, 12, 0.5, 'px'));
    }

    if (mode === 'polygon' || mode === 'circle') {
      row('Fill',    colorPicker('fillColor',    s));
      row('Opacity', slider('fillOpacity',       s, 0, 1, 0.05, ''));
      row('Border',  colorPicker('outlineColor', s));
      row('B.Width', slider('outlineWidth',      s, 0, 10, 0.5, 'px'));
    }
  }

  // Return user-drawn features enriched with the current style state.
  // terra-draw only stores geometry + mode in the store; style values are computed
  // during rendering into temporary copies that never make it back to the store.
  // We apply them here so the HTML export has all the paint properties it needs.
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
        const s    = STYLES[mode];
        let styleProps = {};
        if (mode === 'point') {
          styleProps = {
            pointColor:         s.color,
            pointWidth:         s.width,
            pointOutlineColor:  s.outlineColor,
            pointOutlineWidth:  1,
            pointOpacity:       1,
            pointOutlineOpacity:1,
          };
        } else if (mode === 'linestring') {
          styleProps = {
            lineStringColor:   s.color,
            lineStringWidth:   s.width,
            lineStringOpacity: 1,
          };
        } else { // polygon / circle
          styleProps = {
            polygonFillColor:    s.fillColor,
            polygonFillOpacity:  s.fillOpacity,
            polygonOutlineColor: s.outlineColor,
            polygonOutlineWidth: s.outlineWidth,
            polygonOutlineOpacity: 1,
          };
        }
        return { ...f, properties: { ...f.properties, ...styleProps } };
      });
  }

  // Force terra-draw to re-render features with updated style closures
  _refreshStyles() {
    if (!this._draw || !this._active) return;
    this._draw.setMode('static');
    this._draw.setMode(this._active);
  }
}
