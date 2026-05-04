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

// ─── Marker style definitions ──────────────────────────────────────────────────

const STYLES = [
  // ── Dark bubble (white text on black) ────────────────────────────────────
  { id: 'dark-down-left',    theme: 'dark',  tail: 'down', pos: 'left',   anchor: 'bottom' },
  { id: 'dark-down-center',  theme: 'dark',  tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'dark-down-right',   theme: 'dark',  tail: 'down', pos: 'right',  anchor: 'bottom' },
  { id: 'dark-up-left',      theme: 'dark',  tail: 'up',   pos: 'left',   anchor: 'top' },
  { id: 'dark-up-center',    theme: 'dark',  tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'dark-up-right',     theme: 'dark',  tail: 'up',   pos: 'right',  anchor: 'top' },
  // ── White bubble (black text on white) ───────────────────────────────────
  { id: 'white-down-left',   theme: 'white', tail: 'down', pos: 'left',   anchor: 'bottom' },
  { id: 'white-down-center', theme: 'white', tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'white-down-right',  theme: 'white', tail: 'down', pos: 'right',  anchor: 'bottom' },
  { id: 'white-up-left',     theme: 'white', tail: 'up',   pos: 'left',   anchor: 'top' },
  { id: 'white-up-center',   theme: 'white', tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'white-up-right',    theme: 'white', tail: 'up',   pos: 'right',  anchor: 'top' },
  // ── Line callout (no box, thin leader line) ───────────────────────────────
  { id: 'line-down-left',    theme: 'line',  tail: 'down', pos: 'left',   anchor: 'bottom' },
  { id: 'line-down-center',  theme: 'line',  tail: 'down', pos: 'center', anchor: 'bottom' },
  { id: 'line-down-right',   theme: 'line',  tail: 'down', pos: 'right',  anchor: 'bottom' },
  { id: 'line-up-left',      theme: 'line',  tail: 'up',   pos: 'left',   anchor: 'top' },
  { id: 'line-up-center',    theme: 'line',  tail: 'up',   pos: 'center', anchor: 'top' },
  { id: 'line-up-right',     theme: 'line',  tail: 'up',   pos: 'right',  anchor: 'top' },
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
    this._font = FONTS[0].value; // default font
    this._size = 14;             // default px
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
    collapseBtn.title = 'Collapse panel';
    collapseBtn.addEventListener('click', () => this._collapse());

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

    controls.appendChild(fontRow);
    controls.appendChild(sizeRow);

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

    // ── Collapsed tab ────────────────────────────────────────────
    this._tab = document.createElement('div');
    this._tab.id = 'locator-tab';
    this._tab.innerHTML = `<span class="lt-label">LOCATORS</span><span class="lt-arrow">‹</span>`;
    this._tab.title = 'Expand locators panel';
    this._tab.addEventListener('click', () => this._expand());
    container.appendChild(this._tab);

    // Deselect on map click
    this._map.on('click', (e) => {
      if (!e.originalEvent.target.closest?.('.lm')) {
        this._deselect();
      }
    });
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
      draggable: false,
    })
    .setLngLat(center)
    .addTo(this._map);

    // Store lng/lat as data attributes for reliable export
    el.setAttribute('data-lng', center.lng.toString());
    el.setAttribute('data-lat', center.lat.toString());

    const entry = { marker, el, style, font: this._font, size: this._size };
    this._markers.push(entry);

    // ── Delete button ──────────────────────────────────────────────────────
    el.querySelector('.lm-del').addEventListener('click', (e) => {
      e.stopPropagation();
      marker.remove();
      this._markers = this._markers.filter(m => m !== entry);
      if (this._activeEl === el) this._activeEl = null;
    });

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
          marker.setLngLat(newLngLat);
          el.setAttribute('data-lng', newLngLat.lng.toString());
          el.setAttribute('data-lat', newLngLat.lat.toString());
        }
      };

      const onUp = (ue) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        el.classList.remove('lm-dragging');

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
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  _select(el, entry) {
    if (this._activeEl && this._activeEl !== el) {
      this._activeEl.classList.remove('lm-selected');
    }
    this._activeEl = el;
    el.classList.add('lm-selected');

    // Sync controls to this marker's settings
    // (future: update font/size selectors to reflect this marker)
  }

  _deselect() {
    if (this._activeEl) {
      this._activeEl.classList.remove('lm-selected');
      this._activeEl = null;
    }
  }

  // Update font/size on currently-selected marker
  _updateActive() {
    if (!this._activeEl) return;
    const body = this._activeEl.querySelector('.lm-body');
    if (!body) return;
    const displayFont = this._font.replace(/\+/g, ' ');
    body.style.fontFamily = `"${displayFont}", sans-serif`;
    body.style.fontSize = `${this._size}px`;
  }

  // ── Collapse / expand ────────────────────────────────────────────────────────

  _collapse() {
    this._panel.style.display = 'none';
    this._tab.style.display = 'flex';
    this._tab.parentElement.style.width = '2em';
  }

  _expand() {
    this._panel.style.display = '';
    this._tab.style.display = 'none';
    this._tab.parentElement.style.width = '';
  }
}
