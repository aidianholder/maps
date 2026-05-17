// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

/**
 * LocatorPanel — right-side panel for placing styled, editable, draggable text
 * markers on the map.  Uses maplibregl.Marker with custom HTML elements.
 */
import maplibregl from 'maplibre-gl';

// ─── Google Fonts ─────────────────────────────────────────────────────────────

const FONTS = [
  { label: 'Inter',             value: 'Inter' },
  { label: 'Roboto',            value: 'Roboto' },
  { label: 'Oswald',            value: 'Oswald' },
  { label: 'Montserrat',        value: 'Montserrat' },
  { label: 'Raleway',           value: 'Raleway' },
  { label: 'Lato',              value: 'Lato' },
  { label: 'Playfair Display',  value: 'Playfair+Display' },
  { label: 'Merriweather',      value: 'Merriweather' },
  { label: 'Source Sans 3',     value: 'Source+Sans+3' },
  { label: 'Bebas Neue',        value: 'Bebas+Neue' },
];

function loadFont(value) {
  const id = `gf-${value}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${value}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

// Pre-load all fonts on startup
FONTS.forEach(f => loadFont(f.value));

// ─── Anchor → CSS pre-transform (mirrors MapLibre's internal `gs` object) ────────
// Applied BEFORE the translate(x,y) so the anchor point sits on the coordinate.
const ANCHOR_TRANSFORMS = {
  center:         'translate(-50%,-50%)',
  top:            'translate(-50%,0)',
  'top-left':     'translate(0,0)',
  'top-right':    'translate(-100%,0)',
  bottom:         'translate(-50%,-100%)',
  'bottom-left':  'translate(0,-100%)',
  'bottom-right': 'translate(-100%,-100%)',
  left:           'translate(0,-50%)',
  right:          'translate(-100%,-50%)',
};

// ─── Marker style definitions ──────────────────────────────────────────────────

const STYLES = [
  // ── Dark bubble (white text on black) ────────────────────────────────────
  { id: 'dark-down-left',    theme: 'dark',  tail: 'down', pos: 'left',   anchor: 'bottom-left', offset: [18.5, 0] },
  { id: 'dark-down-center',  theme: 'dark',  tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'dark-down-right',   theme: 'dark',  tail: 'down', pos: 'right',  anchor: 'bottom-right', offset: [-18.5, 0] },
  { id: 'dark-up-left',      theme: 'dark',  tail: 'up',   pos: 'left',   anchor: 'top-left',    offset: [18.5, 0] },
  { id: 'dark-up-center',    theme: 'dark',  tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'dark-up-right',     theme: 'dark',  tail: 'up',   pos: 'right',  anchor: 'top-right',   offset: [-18.5, 0] },
  // ── White bubble (black text on white) ───────────────────────────────────
  { id: 'white-down-left',   theme: 'white', tail: 'down', pos: 'left',   anchor: 'bottom-left', offset: [18.5, 0] },
  { id: 'white-down-center', theme: 'white', tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'white-down-right',  theme: 'white', tail: 'down', pos: 'right',  anchor: 'bottom-right', offset: [-18.5, 0] },
  { id: 'white-up-left',     theme: 'white', tail: 'up',   pos: 'left',   anchor: 'top-left',    offset: [18.5, 0] },
  { id: 'white-up-center',   theme: 'white', tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'white-up-right',    theme: 'white', tail: 'up',   pos: 'right',  anchor: 'top-right',   offset: [-18.5, 0] },
  // ── Line callout (no box, thin leader line) ───────────────────────────────
  { id: 'line-down-left',    theme: 'line',  tail: 'down', pos: 'left',   anchor: 'bottom-left', offset: [18.5, 0] },
  { id: 'line-down-center',  theme: 'line',  tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'line-down-right',   theme: 'line',  tail: 'down', pos: 'right',  anchor: 'bottom-right', offset: [-18.5, 0] },
  { id: 'line-up-left',      theme: 'line',  tail: 'up',   pos: 'left',   anchor: 'top-left',    offset: [18.5, 0] },
  { id: 'line-up-center',    theme: 'line',  tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'line-up-right',     theme: 'line',  tail: 'up',   pos: 'right',  anchor: 'top-right',   offset: [-18.5, 0] },
];

// ─── Build marker element ──────────────────────────────────────────────────────

function buildMarkerEl(style, fontFamily, fontSize, text = 'Label', isThumb = false) {
  const wrap = document.createElement('div');
  wrap.className = `lm lm-${style.theme}` +
    (style.tail ? ` lm-tail-${style.tail} lm-pos-${style.pos}` : '');
  wrap.dataset.styleId = style.id;

  const displayFont = fontFamily.replace(/\+/g, ' ');

  if (style.tail === 'up') {
    // Arrow comes first (above box)
    const arrow = document.createElement('div');
    arrow.className = 'lm-arrow';
    wrap.appendChild(arrow);
  }

  const body = document.createElement('div');
  body.className = 'lm-body';
  body.style.fontFamily = `"${displayFont}", sans-serif`;
  body.style.fontSize   = `${fontSize}px`;

  const textEl = document.createElement('span');
  textEl.className = 'lm-text';
  textEl.textContent = text;

  if (!isThumb) {
    textEl.contentEditable = 'true';
    textEl.spellcheck = false;
    textEl.setAttribute('data-placeholder', 'Type label…');
  }

  body.appendChild(textEl);

  if (!isThumb) {
    const del = document.createElement('button');
    del.className = 'lm-del';
    del.type = 'button';
    del.title = 'Remove marker';
    del.textContent = '✕';
    body.appendChild(del);
  }

  wrap.appendChild(body);

  if (style.tail === 'down' || style.tail === null) {
    if (style.tail === 'down') {
      const arrow = document.createElement('div');
      arrow.className = 'lm-arrow';
      wrap.appendChild(arrow);
    }
  }

  return wrap;
}

// ─── LocatorPanel class ────────────────────────────────────────────────────────

export class LocatorPanel {
  constructor(map) {
    this._map = map;
    this._markers = [];          // { marker, el, style }
    this._activeEl = null;       // currently-selected marker element
    this._font  = FONTS[0].value; // default font
    this._size  = 14;             // default px
    this._align = 'left';         // default text alignment
  }

  mount(container) {
    // ── Outer wrapper ──────────────────────────────────────────────
    this._panel = document.createElement('div');
    this._panel.id = 'locator-panel';

    // ── Header ───────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'lp-header';

    const title = document.createElement('h2');
    title.textContent = 'Locators';

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'lp-collapse-btn';
    collapseBtn.type = 'button';
    collapseBtn.textContent = '✕';
    collapseBtn.title = 'Close panel';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
    });

    header.appendChild(title);
    header.appendChild(collapseBtn);

    // ── Font controls ────────────────────────────────────────────
    const controls = document.createElement('div');
    controls.className = 'lp-controls';

    // Font family
    const fontRow = document.createElement('div');
    fontRow.className = 'lp-row';
    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font';
    const fontSel = document.createElement('select');
    fontSel.className = 'lp-select';
    FONTS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = `"${f.label}", sans-serif`;
      fontSel.appendChild(opt);
    });
    fontSel.addEventListener('change', () => {
      this._font = fontSel.value;
      this._updateActive();
    });
    fontRow.appendChild(fontLabel);
    fontRow.appendChild(fontSel);

    // Font size
    const sizeRow = document.createElement('div');
    sizeRow.className = 'lp-row';
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Size';
    const sizeWrap = document.createElement('div');
    sizeWrap.className = 'lp-size-wrap';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = 8;
    sizeInput.max = 72;
    sizeInput.value = this._size;
    sizeInput.className = 'lp-size-input';
    sizeInput.addEventListener('change', () => {
      this._size = Math.max(8, Math.min(72, Number(sizeInput.value)));
      sizeInput.value = this._size;
      this._updateActive();
    });
    const sizeUnit = document.createElement('span');
    sizeUnit.className = 'lp-unit';
    sizeUnit.textContent = 'px';
    sizeWrap.appendChild(sizeInput);
    sizeWrap.appendChild(sizeUnit);
    sizeRow.appendChild(sizeLabel);
    sizeRow.appendChild(sizeWrap);

    // Text alignment
    const alignRow = document.createElement('div');
    alignRow.className = 'lp-row';
    const alignLabel = document.createElement('label');
    alignLabel.textContent = 'Align';

    const alignWrap = document.createElement('div');
    alignWrap.className = 'lp-align-wrap';

    this._alignBtns = {};
    for (const [val, label] of [['left', 'L'], ['center', 'C'], ['right', 'R']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.className = 'lp-align-btn' + (val === this._align ? ' lp-align-active' : '');
      btn.title = `Align ${val}`;
      btn.addEventListener('click', () => {
        this._align = val;
        Object.values(this._alignBtns).forEach(b => b.classList.remove('lp-align-active'));
        btn.classList.add('lp-align-active');
        this._updateActive();
      });
      alignWrap.appendChild(btn);
      this._alignBtns[val] = btn;
    }

    alignRow.appendChild(alignLabel);
    alignRow.appendChild(alignWrap);

    controls.appendChild(fontRow);
    controls.appendChild(sizeRow);
    controls.appendChild(alignRow);

    // ── Style grid ───────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'lp-grid';

    STYLES.forEach(style => {
      const cell = document.createElement('div');
      cell.className = 'lp-cell';
      cell.title = `Add ${style.id} label`;

      // Build thumbnail
      const thumb = buildMarkerEl(style, this._font, 11, 'Label', true);
      thumb.classList.add('lm-thumb');
      cell.appendChild(thumb);

      cell.addEventListener('click', () => this._addMarker(style));
      grid.appendChild(cell);
    });

    // ── Assemble ─────────────────────────────────────────────────
    this._panel.appendChild(header);
    this._panel.appendChild(controls);
    this._panel.appendChild(grid);
    container.appendChild(this._panel);

    // Deselect on map click
    this._map.on('click', (e) => {
      if (!e.originalEvent.target.closest?.('.lm')) {
        this._deselect();
      }
    });

    // Invisible collision layer — keeps map labels from overlapping locators
    if (this._map.loaded()) {
      this._initCollisionLayer();
    } else {
      this._map.once('load', () => this._initCollisionLayer());
    }
  }

  // ── Add marker ───────────────────────────────────────────────────────────────

  _addMarker(style) {
    const center = this._map.getCenter();
    const el = buildMarkerEl(style, this._font, this._size, '', false);

    // Use draggable:false — we implement drag ourselves so a short press
    // edits the text while a real drag moves the marker.
    const marker = new maplibregl.Marker({
      element: el,
      anchor: style.anchor,
      offset: style.offset || [0, 0],
      draggable: false,
    })
    .setLngLat(center)
    .addTo(this._map);

    // ── Override MapLibre's async _update chain ────────────────────────────
    // MapLibre's _update schedules secondary updates via frameAsync → once('render'),
    // creating a race condition that fights with our syncPositions.  We disable it
    // and take direct, synchronous control of the CSS transform instead.
    marker._update = () => {};

    // Store lng/lat as data attributes for reliable export & syncPositions
    el.setAttribute('data-lng', center.lng.toString());
    el.setAttribute('data-lat', center.lat.toString());

    const entry = { marker, el, style, font: this._font, size: this._size };
    this._markers.push(entry);

    // Apply initial transform directly (bypass MapLibre's now-disabled _update)
    this._applyTransform(el, style, center.lng, center.lat);

    // ── Delete button ──────────────────────────────────────────────────────
    el.querySelector('.lm-del').addEventListener('click', (e) => {
      e.stopPropagation();
      marker.remove();
      this._markers = this._markers.filter(m => m !== entry);
      if (this._activeEl === el) this._activeEl = null;
      this._syncCollisionLayer();
    });

    // ── Text edits → update collision box ─────────────────────────────────
    el.querySelector('.lm-text').addEventListener('input', () => this._syncCollisionLayer());

    // ── Custom drag ────────────────────────────────────────────────────────
    // Any mousedown on the marker body triggers either a drag (if the pointer
    // moves > 4 px) or a click-to-edit (if it stays still).
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();   // stop map pan
      e.preventDefault();    // stop browser text-selection

      this._select(el, entry);

      const startLngLat  = marker.getLngLat();
      const startProject = this._map.project(startLngLat);
      const startMouse   = { x: e.clientX, y: e.clientY };
      let   dragging     = false;

      const onMove = (me) => {
        const dx = me.clientX - startMouse.x;
        const dy = me.clientY - startMouse.y;
        if (!dragging && Math.hypot(dx, dy) > 4) {
          dragging = true;
          // Blur text so cursor doesn't flicker during drag
          el.querySelector('.lm-text').blur();
          el.classList.add('lm-dragging');
        }
        if (dragging) {
          const newLngLat = this._map.unproject([startProject.x + dx, startProject.y + dy]);
          // Update geographic coordinate on the marker object (for getLngLat() callers)
          marker._lngLat = newLngLat;
          // Store in data attributes (export compositor reads these)
          el.setAttribute('data-lng', newLngLat.lng.toString());
          el.setAttribute('data-lat', newLngLat.lat.toString());
          // Set transform directly — no async _update chain
          this._applyTransform(el, style, newLngLat.lng, newLngLat.lat);
        }
      };

      const onUp = (ue) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        el.classList.remove('lm-dragging');

        // Force a map-level move event to trigger syncAllMarkers
        this._map.fire('move');
        if (dragging) this._syncCollisionLayer();

        if (!dragging) {
          // It was a tap/click — focus text for editing if pointer stayed on text
          if (ue.target.closest('.lm-text')) {
            const textEl = el.querySelector('.lm-text');
            textEl.focus();
            // Place caret at click position using the mouse-up coordinates
            const range = document.caretRangeFromPoint?.(ue.clientX, ue.clientY);
            if (range) {
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Prevent map 'click' event from deselecting when clicking the marker
    el.addEventListener('click', (e) => e.stopPropagation());

    // ── Auto-focus on creation ─────────────────────────────────────────────
    this._select(el, entry);
    requestAnimationFrame(() => {
      const textEl = el.querySelector('.lm-text');
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    this._syncCollisionLayer();
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  _select(el, entry) {
    if (this._activeEl && this._activeEl !== el) {
      this._activeEl.classList.remove('lm-selected');
    }
    this._activeEl = el;
    el.classList.add('lm-selected');

    // Sync alignment buttons to this marker's current alignment
    if (this._alignBtns) {
      const align = el.querySelector('.lm-text')?.dataset?.align || 'left';
      this._align = align;
      Object.entries(this._alignBtns).forEach(([val, btn]) => {
        btn.classList.toggle('lp-align-active', val === align);
      });
    }
  }

  _deselect() {
    if (this._activeEl) {
      this._activeEl.classList.remove('lm-selected');
      this._activeEl = null;
    }
  }

  // Update font/size/alignment on currently-selected marker
  _updateActive() {
    if (!this._activeEl) return;
    const body   = this._activeEl.querySelector('.lm-body');
    const textEl = this._activeEl.querySelector('.lm-text');
    if (!body) return;
    const displayFont = this._font.replace(/\+/g, ' ');
    body.style.fontFamily    = `"${displayFont}", sans-serif`;
    body.style.fontSize      = `${this._size}px`;
    if (textEl) {
      textEl.style.textAlign = this._align;
      textEl.dataset.align   = this._align;
    }
  }

  // ── Collision layer ──────────────────────────────────────────────────────────

  _getStyleFont() {
    try {
      for (const layer of (this._map.getStyle()?.layers ?? [])) {
        if (layer.type !== 'symbol') continue;
        const tf = layer.layout?.['text-font'];
        if (!tf) continue;
        if (Array.isArray(tf) && typeof tf[0] === 'string') return tf;
        if (Array.isArray(tf) && tf[0] === 'literal' && Array.isArray(tf[1])) return tf[1];
      }
    } catch (_) { /* ignore */ }
    return ['Noto Sans Regular', 'Arial Unicode MS Regular'];
  }

  _initCollisionLayer() {
    if (this._map.getSource('lm-collision')) return;
    this._map.addSource('lm-collision', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this._map.addLayer({
      id: 'lm-collision',
      type: 'symbol',
      source: 'lm-collision',
      layout: {
        'text-field':             ['get', 'text'],
        'text-size':              ['get', 'fontSize'],
        'text-font':              this._getStyleFont(),
        'text-allow-overlap':     true,   // locators are always shown
        'text-ignore-placement':  false,  // they DO block other map labels
        'text-padding':           10,
      },
      paint: { 'text-opacity': 0 },
    });
    this._collisionReady = true;
    this._syncCollisionLayer();
  }

  _syncCollisionLayer() {
    if (!this._collisionReady) return;
    const src = this._map.getSource('lm-collision');
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: this._markers.map(({ el }) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(el.getAttribute('data-lng')),
            parseFloat(el.getAttribute('data-lat')),
          ],
        },
        properties: {
          text:     (el.querySelector('.lm-text')?.innerText ?? '').trim(),
          fontSize: parseFloat(el.querySelector('.lm-body')?.style.fontSize) || 14,
        },
      })),
    });
  }


  /**
   * Re-project all markers from their stored lng/lat to screen coords and set
   * the CSS transform directly.  Called on every map move/zoom event so markers
   * stay locked to their geographic coordinates without relying on MapLibre's
   * async _update chain.
   */
  syncPositions() {
    for (const { el, style } of this._markers) {
      const lng = parseFloat(el.getAttribute('data-lng'));
      const lat = parseFloat(el.getAttribute('data-lat'));
      if (!isNaN(lng) && !isNaN(lat)) {
        this._applyTransform(el, style, lng, lat);
      }
    }
  }

  /**
   * Directly set the marker element's CSS transform based on current map projection.
   * Mirrors MapLibre's internal formula: anchorOffset + translate(projectedX, projectedY).
   */
  _applyTransform(el, style, lng, lat) {
    const pt      = this._map.project([lng, lat]);
    const off     = style.offset || [0, 0];
    const prefix  = ANCHOR_TRANSFORMS[style.anchor] || 'translate(-50%,-100%)';
    el.style.transform =
      `${prefix} translate(${pt.x + off[0]}px,${pt.y + off[1]}px) rotateX(0deg) rotateZ(0deg)`;
  }
}
