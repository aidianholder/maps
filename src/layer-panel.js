/**
 * Layer panel — shows all layers from the active style with checkboxes.
 * Removed layers are cached so they can be re-inserted at the correct position.
 */
export class LayerPanel {
  constructor(map) {
    this._map = map;
    // layerId -> { layer, beforeId } for removed layers
    this._removed = new Map();
  }

  mount(container) {
    this._el = document.createElement('div');
    this._el.id = 'layer-panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Layers';
    this._el.appendChild(heading);

    this._list = document.createElement('ul');
    this._list.id = 'layer-list';
    this._el.appendChild(this._list);

    container.appendChild(this._el);

    this._map.on('style.load', () => this._rebuild());
    if (this._map.isStyleLoaded()) this._rebuild();
  }

  _rebuild() {
    this._removed.clear();
    this._list.innerHTML = '';
    const layers = this._map.getStyle()?.layers ?? [];

    for (const layer of layers) {
      this._list.appendChild(this._makeRow(layer.id));
    }
  }

  _makeRow(layerId) {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `layer-cb-${CSS.escape(layerId)}`;
    cb.checked = true;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        this._showLayer(layerId);
      } else {
        this._hideLayer(layerId);
      }
    });

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.textContent = layerId;
    label.title = layerId;

    li.appendChild(cb);
    li.appendChild(label);
    return li;
  }

  _hideLayer(layerId) {
    const style = this._map.getStyle();
    const layers = style.layers;
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;

    const layer = layers[idx];
    // record what comes after so we can re-insert at the same position
    const beforeId = layers[idx + 1]?.id ?? null;
    this._removed.set(layerId, { layer, beforeId });
    this._map.removeLayer(layerId);
  }

  _showLayer(layerId) {
    const cached = this._removed.get(layerId);
    if (!cached) return;

    const { layer, beforeId } = cached;
    this._removed.delete(layerId);

    // beforeId may itself have been removed; walk forward to find a visible anchor
    const visibleBefore = this._findVisibleAnchor(beforeId);
    this._map.addLayer(layer, visibleBefore ?? undefined);
  }

  _findVisibleAnchor(beforeId) {
    if (!beforeId) return null;
    const style = this._map.getStyle();
    const ids = new Set(style.layers.map(l => l.id));
    if (ids.has(beforeId)) return beforeId;
    // That layer is also removed — look at what was originally after it
    const cached = this._removed.get(beforeId);
    if (cached) return this._findVisibleAnchor(cached.beforeId);
    return null;
  }
}
