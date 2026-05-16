import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { StyleSwitcherControl } from './style-switcher.js';
import { LayerPanel } from './layer-panel.js';
import { STYLE_CONFIGS } from './style-groups.js';
import { CustomExportControl } from './custom-export-control.js';
import { LocatorPanel } from './locator-panel.js';
import { IconsPanel } from './icons-panel.js';
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

// Little Rock, Arkansas
const CENTER = [-92.2896, 34.7465];
const ZOOM = 10;

const map = new maplibregl.Map({
  container: 'map',
  style: STYLES.find(s => s.title === DEFAULT_STYLE).uri,
  center: CENTER,
  zoom: ZOOM,
});

map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right');

map.addControl(new StyleSwitcherControl(STYLES, DEFAULT_STYLE), 'bottom-left');

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

// ── Toolbar dropdown logic ─────────────────────────────────────────────────

function closeAllDropdowns() {
  document.querySelectorAll('.panel-dropdown').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
}

[
  ['btn-layers',   'panel-layers'],
  ['btn-locators', 'panel-locators'],
  ['btn-icons',    'panel-icons'],
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

// Click anywhere outside a dropdown or toolbar button closes all
document.addEventListener('click', closeAllDropdowns);

// Global sync for markers on map move/zoom to prevent drift
const syncAllMarkers = () => {
  locatorPanel.syncPositions();
  iconsPanel.syncPositions();
};

map.on('move', syncAllMarkers);
map.on('zoom', syncAllMarkers);
