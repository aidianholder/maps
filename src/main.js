// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { StyleSwitcherControl } from './style-switcher.js';
import { LayerPanel } from './layer-panel.js';
import { STYLE_CONFIGS } from './style-groups.js';
import { CustomExportControl } from './custom-export-control.js';
import { LocatorPanel } from './locator-panel.js';
import { IconsPanel } from './icons-panel.js';
import { DrawPanel }     from './draw-panel.js';
import { OverlaysPanel } from './overlays-panel.js';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import '@watergis/maplibre-gl-export/dist/maplibre-gl-export.css';
import './style.css';

// Register PMTiles protocol so pmtiles:// sources resolve
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

const STYLES = [
  { title: 'Newsprint', uri: '/styles/newsprint.json' },
  { title: 'AWS',       uri: '/styles/aws.json' },
  { title: 'Proto',     uri: '/styles/protostyle2.json' },
  { title: 'Positron',  uri: '/styles/positron.json' },
  { title: 'Bright',    uri: '/styles/osmbright.json' },
];

const DEFAULT_STYLE = 'Newsprint';

// Fall back to Little Rock, Arkansas if no site config is injected
const CENTER = window.MAPAPP_CONFIG?.center ?? [-92.2896, 34.7465];
const ZOOM   = window.MAPAPP_CONFIG?.zoom   ?? 10;

const map = new maplibregl.Map({
  container: 'map',
  style: STYLES.find(s => s.title === DEFAULT_STYLE).uri,
  center: CENTER,
  zoom: ZOOM,
});
window.__map = map;

map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');

map.addControl(new StyleSwitcherControl(STYLES, DEFAULT_STYLE), 'bottom-left');

// ── Geocoder (Nominatim) ───────────────────────────────────────────────────
const geocoderApi = {
  forwardGeocode: async (config) => {
    const features = [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${
        encodeURIComponent(config.query)
      }&format=geojson&polygon_geojson=1&addressdetails=1`;
      const geojson = await fetch(url).then(r => r.json());
      for (const feature of geojson.features) {
        const center = [
          feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
          feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2,
        ];
        features.push({
          type:       'Feature',
          geometry:   { type: 'Point', coordinates: center },
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text:       feature.properties.display_name,
          place_type: ['place'],
          center,
        });
      }
    } catch (e) {
      console.error('Geocoder error:', e);
    }
    return { features };
  },
};

map.addControl(
  new MaplibreGeocoder(geocoderApi, { maplibregl }),
  'top-right'
);

map.addControl(
  new CustomExportControl({
    PageSize: 'A6',
    PageOrientation: 'Portrait',
    Format: 'PDF',
    DPI: 150,
    Filename: 'map-export',
    StyleURL: STYLES.find(s => s.title === DEFAULT_STYLE).uri,
    StyleURLMap: {
      '/styles/aws.json':         'https://vectortiles.nyc3.cdn.digitaloceanspaces.com/aws.json',
      '/styles/newsprint.json':   'https://vectortiles.nyc3.cdn.digitaloceanspaces.com/newsprint.json',
      '/styles/osmbright.json':   'https://vectortiles.nyc3.cdn.digitaloceanspaces.com/osmbright.json',
      '/styles/protostyle2.json': 'https://vectortiles.nyc3.cdn.digitaloceanspaces.com/protostyle2.json',
      '/styles/positron.json':    'https://vectortiles.nyc3.cdn.digitaloceanspaces.com/positron.json',
    },
  }),
  'top-right'
);

const layerPanel = new LayerPanel(map, STYLE_CONFIGS);
layerPanel.mount(document.getElementById('panel-layers'));

const locatorPanel = new LocatorPanel(map);
locatorPanel.mount(document.getElementById('panel-locators'));

const iconsPanel = new IconsPanel(map);
iconsPanel.mount(document.getElementById('panel-icons'));

const drawPanel = new DrawPanel(map);
drawPanel.mount(document.getElementById('panel-draw'));

const overlaysPanel = new OverlaysPanel(map);
overlaysPanel.mount(document.getElementById('panel-overlays'));


// ── Toolbar dropdown logic ─────────────────────────────────────────────────

function closeAllDropdowns() {
  document.querySelectorAll('.panel-dropdown').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
}

[
  ['btn-layers',   'panel-layers'],
  ['btn-locators', 'panel-locators'],
  ['btn-icons',    'panel-icons'],
  ['btn-draw',     'panel-draw'],
  ['btn-overlays', 'panel-overlays'],
].forEach(([btnId, panelId]) => {
  const btn   = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) { panel.classList.add('open'); btn.classList.add('active'); }
  });
  panel.addEventListener('panel-close', closeAllDropdowns);
});

// Click anywhere outside a dropdown or toolbar button closes all panels.
// Three exceptions:
//   1. Clicks inside an already-open panel keep that panel open (e.g. color
//      pickers, sliders, checkboxes — all live inside the panel).
//   2. Map-canvas clicks never close the draw panel so the user can place
//      vertices while the panel stays visible.
//   3. Map-canvas clicks never close the Overlays panel while its "Text"
//      submenu is expanded, so the user can click the map to place text
//      without losing the submenu — it only closes via an explicit action
//      (another toolbar menu, the submenu header, or the panel's "x").
document.addEventListener('click', (e) => {
  const drawPanel     = document.getElementById('panel-draw');
  const overlaysPanelEl = document.getElementById('panel-overlays');
  const inMap         = document.getElementById('map').contains(e.target);

  // Exception 2 — map click while draw panel is open
  if (inMap && drawPanel.classList.contains('open')) {
    document.querySelectorAll('.panel-dropdown:not(#panel-draw)').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.tb-btn:not(#btn-draw)').forEach(b => b.classList.remove('active'));
    return;
  }

  // Exception 3 — map click while the Overlays panel's Text submenu is open
  if (inMap && overlaysPanelEl.classList.contains('open') && overlaysPanel.isTextSubmenuOpen()) {
    document.querySelectorAll('.panel-dropdown:not(#panel-overlays)').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.tb-btn:not(#btn-overlays)').forEach(b => b.classList.remove('active'));
    return;
  }

  // Exception 1 — click is inside an already-open panel
  const inOpenPanel = [...document.querySelectorAll('.panel-dropdown.open')]
    .some(p => p.contains(e.target));
  if (inOpenPanel) return;

  closeAllDropdowns();
});

// Sync locator label positions on every map move/zoom.
// (Icon markers use MapLibre's native Marker positioning and need no manual sync.)
map.on('move', () => { locatorPanel.syncPositions(); overlaysPanel.syncPositions(); });
map.on('zoom', () => { locatorPanel.syncPositions(); overlaysPanel.syncPositions(); });

// Hide icon markers during zoom so pipeline-mismatch drift is never visible,
// then reveal them once the animation is fully at rest.
//
// The _mapZooming guard prevents a stale rAF (queued by a previous zoomend)
// from unhiding markers while a new zoom has already started — which would
// make the drift visible mid-animation.
//
// setLngLat is intentionally NOT called in showAll(): MapLibre's own
// moveend → _update() fires synchronously before the rAF and has already
// projected every marker to the correct pixel position.
let _mapZooming = false;
map.on('zoomstart', () => { _mapZooming = true;  iconsPanel.hideAll();  locatorPanel.hideAll();  overlaysPanel.hideAll(); });
map.on('zoomend',   () => { _mapZooming = false; requestAnimationFrame(() => { if (!_mapZooming) { iconsPanel.showAll(); locatorPanel.showAll(); overlaysPanel.showAll(); } }); });

// ── Map HUD (coordinates + zoom) ──────────────────────────────────────────
const hudCoords = document.getElementById('hud-coords');
const hudZoom   = document.getElementById('hud-zoom');

function hudFmtCoord(val, pos, neg) {
  return `${Math.abs(val).toFixed(4)}° ${val >= 0 ? pos : neg}`;
}
function hudUpdateZoom() {
  hudZoom.textContent = map.getZoom().toFixed(2);
}

map.on('mousemove', (e) => {
  hudCoords.textContent =
    `${hudFmtCoord(e.lngLat.lat, 'N', 'S')},  ${hudFmtCoord(e.lngLat.lng, 'E', 'W')}`;
});
map.on('zoom',    hudUpdateZoom);
map.on('zoomend', hudUpdateZoom);
hudUpdateZoom();
