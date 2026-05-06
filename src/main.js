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
  { title: 'Proto',     uri: '/styles/protostyle2.json' },
  { title: 'Bright',    uri: '/styles/osmbright.json' },
  { title: 'Positron',  uri: '/styles/positron.json' },
  { title: 'AWS',       uri: '/styles/aws.json' },
  { title: 'Newsprint', uri: '/styles/newsprint.json' },
];

const DEFAULT_STYLE = 'Proto';

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
    PageSize: 'LETTER',
    PageOrientation: 'Landscape',
    Format: 'PDF',
    DPI: 150,
    Filename: 'map-export',
  }),
  'top-right'
);

const layerPanel = new LayerPanel(map, STYLE_CONFIGS);
layerPanel.mount(document.getElementById('sidebar'));

const locatorPanel = new LocatorPanel(map);
locatorPanel.mount(document.getElementById('locator-root'));

const iconsPanel = new IconsPanel(map);
iconsPanel.mount(document.getElementById('icons-root'));

// Global sync for markers on map move/zoom to prevent drift
const syncAllMarkers = () => {
  locatorPanel.syncPositions();
  iconsPanel.syncPositions();
};

map.on('move', syncAllMarkers);
map.on('zoom', syncAllMarkers);
