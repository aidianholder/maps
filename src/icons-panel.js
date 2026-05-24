// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

import maplibregl from 'maplibre-gl';
import makiLayout from 'maki/layouts/all.json';
import { FONTS, loadFont } from './locator-panel.js';

// Use 15px icons by default
const ICON_SIZE = 15;

export class IconsPanel {
  constructor(map) {
    this._map = map;
    this._icons    = [];   // { marker, el, iconName }
    this._iconSize = ICON_SIZE;
    this._activeEl = null;
  }

  mount(container) {
    this._panel = document.createElement('div');
    this._panel.id = 'icons-panel';

    const header = document.createElement('div');
    header.className = 'ip-header';

    const title = document.createElement('h2');
    title.textContent = 'Icons';

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ip-collapse-btn';
    collapseBtn.type = 'button';
    collapseBtn.textContent = '✕';
    collapseBtn.title = 'Collapse panel';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
    });

    header.appendChild(title);
    header.appendChild(collapseBtn);

    // ── Size slider ──────────────────────────────────────────────────────────
    const sizeRow = document.createElement('div');
    sizeRow.className = 'ip-size-row';

    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Size';
    sizeLabel.className = 'ip-size-label';

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.min   = 10;
    slider.max   = 60;
    slider.step  = 1;
    slider.value = this._iconSize;
    slider.className = 'ip-size-slider';

    const sizeVal = document.createElement('span');
    sizeVal.className = 'ip-size-val';
    sizeVal.textContent = `${this._iconSize}px`;

    this._sizeSlider = slider;
    this._sizeValEl  = sizeVal;

    slider.addEventListener('input', () => {
      this._iconSize = Number(slider.value);
      sizeVal.textContent = `${this._iconSize}px`;
      if (this._activeEl) this._resizeIcon(this._activeEl, this._iconSize);
    });

    sizeRow.append(sizeLabel, slider, sizeVal);

    const grid = document.createElement('div');
    grid.className = 'ip-grid';

    makiLayout.all.forEach(iconName => {
      const cell = document.createElement('div');
      cell.className = 'ip-cell';
      cell.title = `Add ${iconName} icon`;

      // Use the raw SVG from maki icons
      const img = document.createElement('img');
      img.src = `/icons/${iconName}-${ICON_SIZE}.svg`;
      img.className = 'ip-thumb';
      cell.appendChild(img);

      cell.addEventListener('click', () => this._addIcon(iconName));
      grid.appendChild(cell);
    });

    this._panel.appendChild(header);
    this._panel.appendChild(sizeRow);
    this._panel.appendChild(grid);
    container.appendChild(this._panel);

    // ── Infowindow Editor (Bottom Overlay) ───────────────────────────────────
    this._iwPanel = document.createElement('div');
    this._iwPanel.id = 'iw-editor';
    this._iwPanel.style.display = 'none';

    const iwHeader = document.createElement('div');
    iwHeader.className = 'iw-editor-header';
    iwHeader.textContent = 'Infowindow';
    this._iwPanel.appendChild(iwHeader);

    const fields = document.createElement('div');
    fields.className = 'iw-editor-fields';

    const makeField = (label, tag = 'input') => {
      const row = document.createElement('div');
      row.className = 'iw-editor-row';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const input = document.createElement(tag);
      if (tag === 'input') input.type = 'text';
      input.addEventListener('click', e => e.stopPropagation());
      row.append(lbl, input);
      fields.appendChild(row);
      return input;
    };

    this._iwTitle   = makeField('Title');
    this._iwSubhead = makeField('Subhead', 'textarea');
    this._iwText    = makeField('Text', 'textarea');

    // ── Font controls for Infowindow ──────────────────────────────
    const iwControls = document.createElement('div');
    iwControls.className = 'iw-editor-controls';

    // Font family
    const fontRow = document.createElement('div');
    fontRow.className = 'iw-editor-row';
    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font';
    const fontSel = document.createElement('select');
    fontSel.className = 'iw-select';
    FONTS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = `"${f.label}", sans-serif`;
      fontSel.appendChild(opt);
    });
    fontSel.addEventListener('change', () => {
      loadFont(fontSel.value);
    });
    fontRow.append(fontLabel, fontSel);

    // Font size
    const iwSizeRow = document.createElement('div');
    iwSizeRow.className = 'iw-editor-row';
    const iwSizeLabel = document.createElement('label');
    iwSizeLabel.textContent = 'Size';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = 8;
    sizeInput.max = 72;
    sizeInput.value = 14;
    sizeInput.className = 'iw-size-input';
    iwSizeRow.append(iwSizeLabel, sizeInput);

    // Text alignment
    const alignRow = document.createElement('div');
    alignRow.className = 'iw-editor-row';
    const alignLabel = document.createElement('label');
    alignLabel.textContent = 'Align';
    const alignWrap = document.createElement('div');
    alignWrap.className = 'iw-align-wrap';

    this._iwAlignBtns = {};
    for (const [val, label] of [['left', 'L'], ['center', 'C'], ['right', 'R']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.className = 'iw-align-btn';
      btn.title = `Align ${val}`;
      btn.addEventListener('click', () => {
        Object.values(this._iwAlignBtns).forEach(b => b.classList.remove('iw-align-active'));
        btn.classList.add('iw-align-active');
        this._iwAlign = val;
      });
      alignWrap.appendChild(btn);
      this._iwAlignBtns[val] = btn;
    }
    this._iwAlign = 'left';
    this._iwAlignBtns['left'].classList.add('iw-align-active');
    alignRow.append(alignLabel, alignWrap);

    iwControls.append(fontRow, iwSizeRow, alignRow);
    this._iwFontSel = fontSel;
    this._iwSizeInput = sizeInput;

    const btns = document.createElement('div');
    btns.className = 'iw-editor-btns';

    const enterBtn = document.createElement('button');
    enterBtn.textContent = 'enter';
    enterBtn.className = 'iw-btn-enter';
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this._activeEl) return;
      this._activeEl.dataset.iwTitle   = this._iwTitle.value;
      this._activeEl.dataset.iwSubhead = this._iwSubhead.value;
      this._activeEl.dataset.iwText    = this._iwText.value;
      this._activeEl.dataset.iwFont    = this._iwFontSel.value;
      this._activeEl.dataset.iwSize    = this._iwSizeInput.value;
      this._activeEl.dataset.iwAlign   = this._iwAlign;
    });

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'clear';
    clearBtn.className = 'iw-btn-clear';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this._activeEl) return;
      delete this._activeEl.dataset.iwTitle;
      delete this._activeEl.dataset.iwSubhead;
      delete this._activeEl.dataset.iwText;
      delete this._activeEl.dataset.iwFont;
      delete this._activeEl.dataset.iwSize;
      delete this._activeEl.dataset.iwAlign;

      this._iwTitle.value   = '';
      this._iwSubhead.value = '';
      this._iwText.value    = '';
      this._iwFontSel.value = 'Inter';
      this._iwSizeInput.value = 14;
      this._iwAlign = 'left';
      Object.values(this._iwAlignBtns).forEach(b => b.classList.remove('iw-align-active'));
      this._iwAlignBtns['left'].classList.add('iw-align-active');
    });

    btns.append(enterBtn, clearBtn);
    this._iwPanel.appendChild(fields);
    this._iwPanel.appendChild(iwControls);
    this._iwPanel.appendChild(btns);
    document.body.appendChild(this._iwPanel);

    // Deselect on map click outside an icon
    this._map.on('click', (e) => {
      if (!e.originalEvent.target.closest?.('.map-icon')) this._deselectIcon();
    });

  }

  _addIcon(iconName) {
    const center = this._map.getCenter();
    const el = document.createElement('div');
    el.className = 'map-icon';
    el.dataset.icon = iconName;
    el.style.width  = `${this._iconSize}px`;
    el.style.height = `${this._iconSize}px`;
    el.dataset.size = this._iconSize;

    const img = document.createElement('img');
    img.src = `/icons/${iconName}-${ICON_SIZE}.svg`;
    img.style.width  = `${this._iconSize}px`;
    img.style.height = `${this._iconSize}px`;
    el.appendChild(img);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this._selectIcon(el);
    });

    const del = document.createElement('button');
    del.className = 'mi-del';
    del.type = 'button';
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._activeEl === el) this._deselectIcon();
      marker.remove();
      this._icons = this._icons.filter(i => i.marker !== marker);
    });
    el.appendChild(del);

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true,
      anchor: 'center',
    })
    .setLngLat(center)
    .addTo(this._map);

    // Store lng/lat for export
    el.setAttribute('data-lng', center.lng.toString());
    el.setAttribute('data-lat', center.lat.toString());

    // addTo() does: map.on('move', this._update) — storing the exact function
    // object as the listener.  We must remove those listeners so map zoom/pan
    // can't trigger the percentage-based transform and fight syncPositions.
    // We keep marker._update intact so MapLibre's own drag system (setLngLat →
    // _update) still works while the user is dragging the icon.
    const origUpdate = marker._update;   // exact reference — NOT .bind()
    this._map.off('move',                  origUpdate);
    this._map.off('moveend',               origUpdate);
    this._map.off('terrain',               origUpdate);
    this._map.off('projectiontransition',  origUpdate);

    // Set initial transform via direct projection
    this._applyTransform(el, center.lng, center.lat);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      el.setAttribute('data-lng', lngLat.lng.toString());
      el.setAttribute('data-lat', lngLat.lat.toString());
      this._applyTransform(el, lngLat.lng, lngLat.lat);
    });

    this._icons.push({ marker, el, iconName });
  }

  /**
   * Re-project every icon from its stored lng/lat and set the CSS transform
   * directly — no async _update chain, no race condition.
   */
  syncPositions() {
    this._icons.forEach(({ el }) => {
      const lng = parseFloat(el.getAttribute('data-lng'));
      const lat = parseFloat(el.getAttribute('data-lat'));
      if (!isNaN(lng) && !isNaN(lat)) {
        this._applyTransform(el, lng, lat);
      }
    });
  }

  /**
   * Set the icon element's CSS transform so it is centred on the projected
   * geographic coordinate — matches MapLibre's anchor:'center' formula but
   * computed synchronously from the current map projection.
   */
  _applyTransform(el, lng, lat) {
    const pt = this._map.project([lng, lat]);
    const w  = el.offsetWidth  || 0;
    const h  = el.offsetHeight || 0;
    el.style.transform = `translate(${pt.x - w / 2}px, ${pt.y - h / 2}px)`;
  }

  _selectIcon(el) {
    if (this._activeEl === el) return;
    this._deselectIcon();
    this._activeEl = el;
    el.classList.add('map-icon-selected');
    // Sync slider to this icon's current size
    const size = parseInt(el.dataset.size) || ICON_SIZE;
    this._iconSize = size;
    if (this._sizeSlider) {
      this._sizeSlider.value   = size;
      this._sizeValEl.textContent = `${size}px`;
    }

    // Populate and show Infowindow editor
    this._iwTitle.value   = el.dataset.iwTitle   || '';
    this._iwSubhead.value = el.dataset.iwSubhead || '';
    this._iwText.value    = el.dataset.iwText    || '';
    this._iwFontSel.value = el.dataset.iwFont    || 'Inter';
    this._iwSizeInput.value = el.dataset.iwSize  || 14;
    this._iwAlign = el.dataset.iwAlign || 'left';
    Object.values(this._iwAlignBtns).forEach(b => b.classList.remove('iw-align-active'));
    if (this._iwAlignBtns[this._iwAlign]) {
      this._iwAlignBtns[this._iwAlign].classList.add('iw-align-active');
    }
    this._iwPanel.style.display = 'block';
  }

  _deselectIcon() {
    if (this._activeEl) {
      this._activeEl.classList.remove('map-icon-selected');
      this._activeEl = null;
    }
    if (this._iwPanel) this._iwPanel.style.display = 'none';
  }

  _resizeIcon(el, size) {
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    el.dataset.size = size;
    const img = el.querySelector('img');
    if (img) { img.style.width = `${size}px`; img.style.height = `${size}px`; }
    const lng = parseFloat(el.getAttribute('data-lng'));
    const lat = parseFloat(el.getAttribute('data-lat'));
    if (!isNaN(lng) && !isNaN(lat)) this._applyTransform(el, lng, lat);
  }

}

