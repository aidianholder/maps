# MapApp

Copyright (C) 2026 Aidian Holder

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

---

An interactive map editing and export tool built on MapLibre GL JS. Users can toggle map layers, place and style locator labels and icons, draw and style vector features, geocode addresses, and export the current view as PDF, PNG, JPEG, SVG, or an embeddable HTML slippy map.

---

## Features

### Map & Base Styles
- Five vector tile base styles: **Newsprint**, **AWS**, **Proto**, **Positron**, **Bright**
- Style switcher in the bottom-left corner; switching styles preserves all user-added content
- PMTiles protocol support for local tile archives

### Layer Panel
- Collapsible panel listing every layer in the current style, organised into named folder sections
- Per-layer visibility toggle with styled checkboxes
- Layer groups and hidden-layer lists are configured per style in `src/style-groups.js`

### Locator Labels
- Fifteen label styles: boxed dark/white/plain with optional up/down tails, positioned left/centre/right
- Draggable markers anchored to geographic coordinates; position synced on every map move/zoom
- Per-label font family, size, and text alignment (L/C/R)
- Multi-line text support (Enter key in the label)
- Labels composite on top of PDF/PNG/JPEG/SVG exports via 2D canvas rendering

### Map Icons
- Full Maki icon set (~200 icons), browsable in a 4-column grid
- Per-icon size control via a slider; individual icons can be resized after placement
- Click to select; selection indicated by a blue outline box
- Icons composite on top of PDF/PNG/JPEG/SVG exports

### Draw Panel
- Five modes via terra-draw: **Point**, **Line**, **Circle**, **Polygon**, **Select**
- Independent styling per committed feature — draw a blue polygon, change the style, draw a red polygon; both retain their original colours
- Style panel changes dynamically based on active mode:
  - Point: fill colour, size
  - Line: colour, width
  - Circle/Polygon: fill colour, fill opacity, border colour, border width
- Select mode: click any drawn feature to load its style into the panel and edit it live
- Drawn features composite on top of PDF/PNG/JPEG/SVG exports
- Terra-draw layers are automatically rebuilt when the base style is switched

### Geocoder
- Nominatim-backed address / place search in the top-right toolbar
- Flies to the result on selection

### Export Control
- Always-visible export overlay showing the exact printable area (A6 Portrait by default)
- Drag the overlay corners to set a custom export size
- Output formats: PDF, PNG, JPEG, SVG
- DPI options: 72, 96, 150, 300
- **HTML export** — generates a self-contained MapLibre embed with:
  - Correct CDN base-style URL mapped from the local dev style path
  - Locator labels rendered as MapLibre popups
  - Icons as symbol layers (PNG sprites from the CDN)
  - Drawn features as GeoJSON sources and appropriate line/fill/circle layers
  - Map dimensions and centre/zoom matched to the export overlay

---

## Architecture

### Stack

| Layer | Technology |
|---|---|
| Bundler | Vite 6 (ES modules) |
| Map engine | MapLibre GL JS 5 |
| Tile protocol | PMTiles (`pmtiles` package) |
| Drawing | terra-draw 1.30 + terra-draw-maplibre-gl-adapter 1.4 |
| Geocoder | @maplibre/maplibre-gl-geocoder (Nominatim backend) |
| PDF/raster export | @watergis/maplibre-gl-export 4 |
| Icon set | Maki 2 |

### Source Files

```
src/
  main.js                   Entry point; map init, control wiring, toolbar logic
  style.css                 All UI styles (light theme)
  style-groups.js           Per-basestyle layer grouping & visibility config
  style-switcher.js         Base-style dropdown control
  layer-panel.js            Layer visibility panel
  locator-panel.js          Locator label panel and marker management
  icons-panel.js            Map icon panel and marker management
  draw-panel.js             Terra-draw integration (modes, per-feature styling, export snapshot)
  custom-export-control.js  Export overlay, PDF/PNG/SVG export, HTML embed export
```

### UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  [+][-][↑]  [🗺][A][🖼][✏]        [🔍 Search]   [🖨]   │  ← top bar
│  zoom       toolbar                geocoder    export   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Full-viewport MapLibre canvas                         │
│                                                         │
│   ┌─────────────────────────┐                           │
│   │  Export overlay         │  ← draggable corner       │
│   │  (A6 portrait default)  │    handles                │
│   └─────────────────────────┘                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
│ [🗂 Style switcher]              [Scale bar]            │  ← bottom bar
└─────────────────────────────────────────────────────────┘
```

The three toolbar dropdowns (Layers, Labels, Icons) and the side-mounted Draw button each open a `panel-dropdown` div that overlays the map without affecting the viewport. The draw button sits below the zoom controls on the left edge.

### Export Architecture

PDF/PNG/JPEG/SVG exports are produced by `MapGenerator` (a subclass of `MapGeneratorBase` from `@watergis/maplibre-gl-export`). A hidden off-screen MapLibre instance is created, fitted to the geographic bounds of the export overlay, and rendered to canvas. Three compositing passes are then applied before the final image is encoded:

1. **`_compositeLocators`** — reprojects each locator marker's lng/lat into the hidden map's coordinate space and draws labels using the 2D canvas API
2. **`_compositeIcons`** — same for map icons
3. **`_compositeDrawFeatures`** — draws terra-draw vector features (points, lines, polygons) using the GeoJSON snapshot from `DrawPanel.getSnapshot()`

The HTML export does not use the hidden-map rendering path; instead it generates a standalone MapLibre script using CDN tile URLs, with locators as popups and all other features as GeoJSON sources and symbol/line/fill layers.

### Style URL Mapping (HTML Export)

Local dev style paths are mapped to public CDN URLs in `main.js`:

| Local path | CDN URL |
|---|---|
| `/styles/aws.json` | `https://vectortiles.nyc3.cdn.digitaloceanspaces.com/aws.json` |
| `/styles/newsprint.json` | `https://vectortiles.nyc3.cdn.digitaloceanspaces.com/newsprint.json` |
| `/styles/osmbright.json` | `https://vectortiles.nyc3.cdn.digitaloceanspaces.com/osmbright.json` |
| `/styles/protostyle2.json` | `https://vectortiles.nyc3.cdn.digitaloceanspaces.com/protostyle2.json` |
| `/styles/positron.json` | `https://vectortiles.nyc3.cdn.digitaloceanspaces.com/positron.json` |

Icon PNGs in the HTML embed are loaded from `https://mapicons.nyc3.cdn.digitaloceanspaces.com/png/maki/<name>.png`.

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run

```bash
npm install
npm run dev
```

Vite starts a dev server at `http://localhost:5173`.

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Preview the production build locally:

```bash
npm run preview
```

---

## Deployment

The app is a fully static single-page application — `npm run build` produces a `dist/` folder that can be served from any static host or CDN with no server-side logic required.

### Nginx example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/mapapp/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache hashed assets aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### DigitalOcean App Platform

1. Connect the repository.
2. Set the build command to `npm run build`.
3. Set the output directory to `dist`.
4. Deploy — the platform serves the static files automatically.

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Environment notes

- All map tile data is fetched from external CDN endpoints at runtime; no tile server is bundled with the app.
- Style JSON files under `public/styles/` are loaded at runtime relative to the app origin, so they must be present in the deployed `dist/` folder (Vite copies the entire `public/` directory automatically).
- The Nominatim geocoder calls `https://nominatim.openstreetmap.org` directly from the browser; no proxy is needed.

---

## Adding a New Base Style

1. Place the MapLibre style JSON in `public/styles/`.
2. Add an entry to the `STYLES` array in `src/main.js`.
3. Add a corresponding entry to `StyleURLMap` in `src/main.js` pointing to the production CDN URL for the HTML export.
4. If the new style has layer IDs that should be grouped or hidden in the layer panel, add a config block in `src/style-groups.js`.
