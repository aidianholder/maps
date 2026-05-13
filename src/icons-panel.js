import maplibregl from 'maplibre-gl';
import makiLayout from 'maki/layouts/all.json';

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
    collapseBtn.addEventListener('click', () => this._collapse());

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

    // Deselect on map click outside an icon
    this._map.on('click', (e) => {
      if (!e.originalEvent.target.closest?.('.map-icon')) this._deselectIcon();
    });

    // Collapsed tab
    this._tab = document.createElement('div');
    this._tab.id = 'icons-tab';
    this._tab.innerHTML = `<span class="it-label">ICONS</span><span class="it-arrow">‹</span>`;
    this._tab.title = 'Expand icons panel';
    this._tab.addEventListener('click', () => this._expand());
    container.appendChild(this._tab);
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
  }

  _deselectIcon() {
    if (this._activeEl) {
      this._activeEl.classList.remove('map-icon-selected');
      this._activeEl = null;
    }
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
