import maplibregl from 'maplibre-gl';
import makiLayout from 'maki/layouts/all.json';

// Use 15px icons by default
const ICON_SIZE = 15;

export class IconsPanel {
  constructor(map) {
    this._map = map;
    this._icons = []; // { marker, el, iconName }
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
    this._panel.appendChild(grid);
    container.appendChild(this._panel);

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
    el.style.width = `${ICON_SIZE}px`;
    el.style.height = `${ICON_SIZE}px`;
    
    const img = document.createElement('img');
    img.src = `/icons/${iconName}-${ICON_SIZE}.svg`;
    img.style.width = `${ICON_SIZE}px`;
    img.style.height = `${ICON_SIZE}px`;
    el.appendChild(img);

    const del = document.createElement('button');
    del.className = 'mi-del';
    del.type = 'button';
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
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

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      el.setAttribute('data-lng', lngLat.lng.toString());
      el.setAttribute('data-lat', lngLat.lat.toString());
    });

    this._icons.push({ marker, el, iconName });
  }

  /**
   * Re-sync all icon positions based on their data-lng/data-lat attributes.
   * This ensures they stay anchored even if MapLibre's internal state drifts.
   */
  syncPositions() {
    this._icons.forEach(({ marker, el }) => {
      const lng = el.getAttribute('data-lng');
      const lat = el.getAttribute('data-lat');
      if (lng && lat) {
        marker.setLngLat([parseFloat(lng), parseFloat(lat)]);
      }
    });
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
