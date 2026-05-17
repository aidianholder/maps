// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

/**
 * Layer panel — collapsible sidebar with folder-tree sections and per-layer checkboxes.
 */
export class LayerPanel {
  constructor(map, styleConfigs = []) {
    this._map = map;
    this._styleConfigs = styleConfigs;
    this._removed = new Map(); // layerId -> { layer, beforeId }
  }

  mount(container) {
    // ── Panel ──────────────────────────────────────────────────────────────
    this._el = document.createElement('div');
    this._el.id = 'layer-panel';

    // Header row with title + close button
    const header = document.createElement('div');
    header.id = 'panel-header';

    const title = document.createElement('h2');
    title.textContent = 'Layers';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'panel-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    this._el.appendChild(header);

    this._list = document.createElement('ul');
    this._list.id = 'layer-list';
    this._el.appendChild(this._list);

    container.appendChild(this._el);

    this._map.on('style.load', () => this._rebuild());
    if (this._map.isStyleLoaded()) this._rebuild();
  }

  // ── Config lookup ─────────────────────────────────────────────────────────

  _getConfig() {
    const style = this._map.getStyle();
    if (!style) return { groups: [], hidden: [], hiddenPrefixes: [], sections: [] };
    for (const config of this._styleConfigs) {
      if (config.test(style)) return config;
    }
    return { groups: [], hidden: [], hiddenPrefixes: [], sections: [] };
  }

  // ── Rebuild ───────────────────────────────────────────────────────────────

  _rebuild() {
    this._removed.clear();
    this._list.innerHTML = '';

    const { groups, hidden = [], hiddenPrefixes = [], sections = [] } = this._getConfig();
    const hiddenSet     = new Set(hidden);
    const styleLayers   = this._map.getStyle()?.layers ?? [];
    const styleLayerIds = new Set(styleLayers.map(l => l.id));

    // layerId → group
    const layerToGroup = new Map();
    for (const group of groups) {
      for (const lid of group.layers) layerToGroup.set(lid, group);
    }

    // displayName → section name
    const nameToSection = new Map();
    for (const sec of sections) {
      for (const entry of sec.entries) nameToSection.set(entry, sec.name);
    }

    // Build ordered display rows, preserving style layer order
    const renderedGroups   = new Set();
    const rows = []; // { displayName, present:string[], type:'group'|'single' }

    for (const layer of styleLayers) {
      if (hiddenSet.has(layer.id)) continue;
      if (!layerToGroup.has(layer.id) && hiddenPrefixes.some(p => layer.id.startsWith(p))) continue;

      const group = layerToGroup.get(layer.id);
      if (group) {
        if (renderedGroups.has(group.displayName)) continue;
        renderedGroups.add(group.displayName);
        const present = group.layers.filter(id => styleLayerIds.has(id));
        rows.push({ displayName: group.displayName, present, type: 'group' });
      } else {
        rows.push({ displayName: layer.id, present: [layer.id], type: 'single' });
      }
    }

    if (sections.length > 0) {
      this._renderSections(rows, sections, nameToSection);
    } else {
      for (const row of rows) {
        this._list.appendChild(this._makeRowEl(row.displayName, row.present));
      }
    }
  }

  _renderSections(rows, sections, nameToSection) {
    // Group rows by section
    const sectionMap = new Map(); // sectionName → rows[]
    const unsectioned = [];

    for (const sec of sections) sectionMap.set(sec.name, []);

    for (const row of rows) {
      const sec = nameToSection.get(row.displayName);
      if (sec && sectionMap.has(sec)) {
        sectionMap.get(sec).push(row);
      } else {
        unsectioned.push(row);
      }
    }

    for (const sec of sections) {
      const secRows = sectionMap.get(sec.name);
      if (secRows.length === 0) continue;
      this._list.appendChild(this._makeSectionEl(sec.name, secRows));
    }

    for (const row of unsectioned) {
      this._list.appendChild(this._makeRowEl(row.displayName, row.present));
    }
  }

  _makeSectionEl(name, rows) {
    const li = document.createElement('li');
    li.className = 'layer-section';

    const details = document.createElement('details');
    details.open = true;

    const summary = document.createElement('summary');
    summary.className = 'section-header';
    summary.textContent = name;

    const ul = document.createElement('ul');
    ul.className = 'section-items';
    for (const row of rows) {
      ul.appendChild(this._makeRowEl(row.displayName, row.present));
    }

    details.appendChild(summary);
    details.appendChild(ul);
    li.appendChild(details);
    return li;
  }

  _makeRowEl(displayName, presentLayers) {
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

  // ── Layer show/hide ───────────────────────────────────────────────────────

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
