/**
 * Layer panel — shows all layers from the active style with checkboxes.
 * Supports grouping multiple layers under one display name via styleGroupsMap.
 * Removed layers are cached so they can be re-inserted at the correct position.
 */
export class LayerPanel {
  constructor(map, styleGroupsMap = {}) {
    this._map = map;
    this._styleGroupsMap = styleGroupsMap; // { sourceKey: groupConfig[] }
    this._removed = new Map(); // layerId -> { layer, beforeId }
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

  // ── Private ───────────────────────────────────────────────────────────────

  _getConfig() {
    const sources = this._map.getStyle()?.sources ?? {};
    for (const [sourceKey, config] of Object.entries(this._styleGroupsMap)) {
      if (sourceKey in sources) return config;
    }
    return { groups: [], hidden: [] };
  }

  _rebuild() {
    this._removed.clear();
    this._list.innerHTML = '';

    const { groups, hidden = [], hiddenPrefixes = [] } = this._getConfig();
    const hiddenSet = new Set(hidden);
    const styleLayers = this._map.getStyle()?.layers ?? [];
    const styleLayerIds = new Set(styleLayers.map(l => l.id));

    // Build layerId -> group lookup
    const layerToGroup = new Map();
    for (const group of groups) {
      for (const lid of group.layers) {
        layerToGroup.set(lid, group);
      }
    }

    const renderedGroups = new Set();

    for (const layer of styleLayers) {
      if (hiddenSet.has(layer.id)) continue;
      const group = layerToGroup.get(layer.id);
      // Grouped layers bypass prefix-based hiding (explicit group = explicit opt-in)
      if (!group && hiddenPrefixes.some(p => layer.id.startsWith(p))) continue;

      if (group) {
        if (!renderedGroups.has(group.displayName)) {
          renderedGroups.add(group.displayName);
          const presentLayers = group.layers.filter(id => styleLayerIds.has(id));
          this._list.appendChild(this._makeGroupRow(group.displayName, presentLayers));
        }
      } else {
        this._list.appendChild(this._makeSingleRow(layer.id));
      }
    }
  }

  _makeGroupRow(displayName, presentLayers) {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `layer-cb-${CSS.escape(displayName)}`;
    cb.checked = true;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        for (const lid of presentLayers) {
          if (this._removed.has(lid)) this._showLayer(lid);
        }
      } else {
        for (const lid of presentLayers) {
          if (!this._removed.has(lid)) this._hideLayer(lid);
        }
      }
    });

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.textContent = displayName;
    label.title = displayName;

    li.appendChild(cb);
    li.appendChild(label);
    return li;
  }

  _makeSingleRow(layerId) {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `layer-cb-${CSS.escape(layerId)}`;
    cb.checked = true;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (this._removed.has(layerId)) this._showLayer(layerId);
      } else {
        if (!this._removed.has(layerId)) this._hideLayer(layerId);
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
    const layers = this._map.getStyle()?.layers ?? [];
    const idx = layers.findIndex(l => l.id === layerId);
    if (idx === -1) return;
    const beforeId = layers[idx + 1]?.id ?? null;
    this._removed.set(layerId, { layer: layers[idx], beforeId });
    this._map.removeLayer(layerId);
  }

  _showLayer(layerId) {
    const cached = this._removed.get(layerId);
    if (!cached) return;
    const { layer, beforeId } = cached;
    this._removed.delete(layerId);
    const anchor = this._findVisibleAnchor(beforeId);
    this._map.addLayer(layer, anchor ?? undefined);
  }

  _findVisibleAnchor(beforeId) {
    if (!beforeId) return null;
    const ids = new Set((this._map.getStyle()?.layers ?? []).map(l => l.id));
    if (ids.has(beforeId)) return beforeId;
    const cached = this._removed.get(beforeId);
    if (cached) return this._findVisibleAnchor(cached.beforeId);
    return null;
  }
}
