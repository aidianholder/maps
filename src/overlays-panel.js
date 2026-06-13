// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

import maplibregl from 'maplibre-gl';
import { FONTS, loadFont } from './locator-panel.js';

// ─── Text overlay element builder ─────────────────────────────────────────────
// Builds a geographically-anchored, left-anchored text element. Mirrors the
// `buildMarkerEl` pattern in locator-panel.js — a contenteditable span wrapped
// in a positioning div, plus a delete button.
function buildTextEl(opts, isThumb = false) {
  const {
    font, size, color, bold, italic, underline,
    border, borderColor, background, bgColor,
    text = '',
  } = opts;
  const wrap = document.createElement('div');
  wrap.className = 'map-text' +
    (bold       ? ' mt-bold'      : '') +
    (italic     ? ' mt-italic'    : '') +
    (underline  ? ' mt-underline' : '') +
    (border     ? ' mt-border'    : '') +
    (background ? ' mt-bg'        : '');

  const displayFont = font.replace(/\+/g, ' ');
  const textEl = document.createElement('span');
  textEl.className = 'mt-text';
  textEl.style.fontFamily = `"${displayFont}", sans-serif`;
  textEl.style.fontSize   = `${size}px`;
  textEl.style.color      = color;
  textEl.style.borderColor = borderColor || '#1a1a1a';
  textEl.style.backgroundColor = background ? (bgColor || '#ffffff') : '';
  textEl.textContent      = text;

  if (!isThumb) {
    textEl.contentEditable = 'true';
    textEl.spellcheck = false;
    textEl.setAttribute('data-placeholder', 'Type text…');
  }

  wrap.appendChild(textEl);

  if (!isThumb) {
    const del = document.createElement('button');
    del.className = 'mt-del';
    del.type = 'button';
    del.title = 'Remove text';
    del.textContent = '✕';
    wrap.appendChild(del);
  }

  return wrap;
}

// POI groups — classes and subclasses drawn from POI_groups.txt.
// Each entry's `id` becomes the MapLibre layer ID; `classes` and `subclasses`
// drive the filter so only matching features from the poi source-layer appear.
const POI_GROUPS = [
  {
    id:         'poi_government',
    label:      'Government',
    classes:    ['town_hall', 'police', 'post'],
    subclasses: [
      'courthouse', 'townhall', 'public_building', 'community_centre',
      'police', 'post_box', 'post_office', 'parcel_locker',
      'government', 'political_party', 'diplomatic', 'lawyer', 'notary',
      'quango', 'union', 'foundation', 'association', 'ngo',
    ],
  },
  {
    id:         'poi_education',
    label:      'Education',
    classes:    ['school', 'college', 'library'],
    subclasses: [
      'school', 'kindergarten', 'college', 'university', 'books', 'library',
      'educational_institution', 'tutoring', 'research',
    ],
  },
  {
    id:         'poi_arts_culture',
    label:      'Arts & Culture',
    classes:    ['art_gallery', 'music', 'attraction', 'castle'],
    subclasses: [
      'art', 'arts_centre', 'artwork', 'gallery',
      'music', 'musical_instrument',
      'attraction', 'viewpoint',
      'castle', 'ruins',
      'theatre', 'cinema',
    ],
  },
  {
    id:         'poi_amenities',
    label:      'Amenities & Attractions',
    classes:    ['park', 'zoo', 'cemetery', 'golf', 'swimming', 'stadium'],
    subclasses: [
      'park', 'bbq',
      'zoo', 'aviary', 'birds', 'butterfly', 'enclosure', 'falconry',
      'petting_zoo', 'reptile', 'safari_park', 'terrarium', 'wildlife_park',
      'cemetery', 'grave_yard',
      'golf', 'golf_course', 'miniature_golf',
      'swimming', 'swimming_area',
      'american_football', 'soccer', 'stadium',
      'dog_park', 'place_of_worship', 'recycling', 'toilets', 'shelter',
    ],
  },
  {
    id:         'poi_eat_drink',
    label:      'Eat & Drink',
    classes:    ['bar', 'beer', 'cafe', 'fast_food', 'ice_cream', 'alcohol_shop'],
    subclasses: [
      'bar', 'nightclub',
      'biergarten', 'pub',
      'cafe',
      'fast_food', 'food_court',
      'ice_cream',
      'alcohol', 'beverages', 'wine',
      'restaurant',
      'chocolate', 'coffee', 'confectionery', 'frozen_food', 'tobacco',
    ],
  },
  {
    id:         'poi_hospitality',
    label:      'Hospitality',
    classes:    ['lodging', 'campsite'],
    subclasses: [
      'hotel', 'motel', 'hostel', 'guest_house', 'bed_and_breakfast',
      'chalet', 'alpine_hut', 'dormitory',
      'camp_site', 'caravan_site',
    ],
  },
  {
    id:         'poi_healthcare',
    label:      'Healthcare',
    classes:    ['hospital'],
    subclasses: [
      'hospital', 'clinic', 'nursing_home',
      'pharmacy', 'dentist', 'doctors', 'veterinary',
      'physician', 'therapist', 'health_insurance',
    ],
  },
  {
    id:         'poi_business_shopping',
    label:      'Business & Shopping',
    classes:    ['shop', 'grocery', 'clothing_store', 'laundry', 'office', 'atm', 'fuel'],
    subclasses: [
      'fuel', 'charging_station',
      'supermarket', 'greengrocer', 'marketplace', 'department_store', 'deli', 'delicatessen',
      'accessories', 'antiques', 'beauty', 'bed', 'boutique', 'camera', 'carpet',
      'chemist', 'chocolate', 'coffee', 'computer', 'confectionery', 'convenience',
      'copyshop', 'cosmetics', 'doityourself', 'electronics', 'erotic', 'fabric',
      'florist', 'frozen_food', 'furniture', 'garden_centre', 'general', 'gift',
      'hardware', 'hearing_aids', 'hifi', 'interior_decoration', 'jewelry', 'kiosk',
      'lamps', 'locksmith', 'mall', 'massage', 'mobile_phone', 'motorcycle',
      'newsagent', 'optician', 'outdoor', 'paint', 'perfume', 'perfumery', 'pet',
      'photo', 'second_hand', 'shoes', 'sports', 'stationery', 'tailor', 'tattoo',
      'ticket', 'tobacco', 'toys', 'travel_agency', 'video', 'video_games', 'watches',
      'weapons', 'wholesale',
      'bag', 'clothes',
      'laundry', 'dry_cleaning',
      'atm', 'bank',
      'accountant', 'advertising_agency', 'architect', 'company',
      'construction_company', 'consulting', 'cooperative', 'courier', 'coworking',
      'employment_agency', 'energy_supplier', 'engineer', 'estate_agent',
      'financial', 'financial_advisor', 'forestry', 'geodesist', 'graphic_design',
      'guide', 'harbour_master', 'insurance', 'interior_design', 'it', 'logistics',
      'marketing', 'moving_company', 'newspaper', 'ngo', 'property_management',
      'publisher', 'private_investigator', 'research', 'security', 'surveyor',
      'tax_advisor', 'telecommunication', 'translator', 'travel_agent',
      'water_utility', 'web_design', 'wedding_planner',
    ],
  },
  {
    id:         'poi_transportation',
    label:      'Transportation',
    classes:    ['bus', 'railway', 'harbor', 'car', 'fuel'],
    subclasses: [
      'bus_stop', 'bus_station',
      'halt', 'station', 'subway', 'tram_stop',
      'dock', 'marina',
      'car', 'car_parts', 'car_repair', 'taxi',
      'fuel', 'charging_station',
    ],
  },
  {
    id:         'poi_uncategorized',
    label:      'Uncategorized',
    classes:    ['aerialway', 'entrance'],
    subclasses: [
      'station', 'subway_entrance', 'train_station_entrance',
      'recycling', 'toilets', 'shelter',
    ],
  },
];

// Build the MapLibre layer definition for a POI group.
function buildPoiLayer(group) {
  return {
    id:             group.id,
    type:           'symbol',
    source:         'openmaptiles',
    'source-layer': 'poi',
    minzoom:        14,
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['any',
        ['in', 'class',    ...group.classes],
        ['in', 'subclass', ...group.subclasses],
      ],
    ],
    layout: {
      'icon-image': [
        'coalesce',
        ['image', ['concat', 'icons:', ['get', 'subclass']]],
        ['image', ['concat', 'icons:', ['get', 'class']]],
      ],
      'text-anchor':    'top',
      'text-field':     ['coalesce', ['get', 'name:latin'], ['get', 'name']],
      'text-font':      ['Noto Sans Regular'],
      'text-max-width': 9,
      'text-offset':    [0, 0.6],
      'text-padding':   2,
      'text-size':      12,
      'visibility':     'visible',
      'icon-size':      1.5,
    },
    paint: {
      'text-color':      '#666',
      'text-halo-blur':  0.5,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  };
}

// Boundaries submenu — each entry loads a GeoJSON polygon layer (US counties
// or counties_by_state) with configurable fill/line styling and an optional name label.
const BOUNDARY_CONFIGS = [
  { id: 'counties', label: 'Counties', url: '/geojson/US_counties.json', nameProp: 'NAME' },
  { id: 'states',   label: 'States',   url: '/geojson/US_states.json',   nameProp: 'NAME' },
];

// State/territory identifiers — one per file in public/geojson/counties_by_state/.
const STATE_CODES = [
  'AK', 'AL', 'AR', 'AS', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'GU',
  'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN',
  'MO', 'MP', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH',
  'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VI', 'VT',
  'WA', 'WI', 'WV', 'WY',
];

// The per-state county files aren't standard GeoJSON FeatureCollections —
// `features` is a single Feature whose `counties` array holds one
// {name, geographicRegion, geometry} entry per county. Reshape that into a
// proper FeatureCollection of per-county polygon Features.
async function fetchStateCountiesGeoJSON(code) {
  const resp = await fetch(`/geojson/counties_by_state/${code}.json`);
  const raw  = await resp.json();
  const counties = raw.features?.counties ?? [];
  return {
    type: 'FeatureCollection',
    features: counties.map(c => ({
      type:       'Feature',
      properties: { name: c.name, geographicRegion: c.geographicRegion, state: code },
      geometry:   c.geometry,
    })),
  };
}

export class OverlaysPanel {
  constructor(map) {
    this._map      = map;
    this._active   = new Set();   // layer IDs currently on the map
    this._btnEls   = {};          // groupId → button element

    // ── Text overlay state ─────────────────────────────────────────────────
    this._textEls       = [];     // { marker, el }
    this._activeTextEl  = null;
    this._textFont      = FONTS[0].value;
    this._textSize      = 18;
    this._textColor     = '#1a1a1a';
    this._textBold      = false;
    this._textItalic    = false;
    this._textUnderline = false;
    this._textBorder      = false;
    this._textBorderColor = '#1a1a1a';
    this._textBackground  = false;
    this._textBgColor     = '#ffffff';
    this._placeArmed    = false;
    this._placementHandler = null;

    // ── Boundaries overlay state ───────────────────────────────────────────
    this._boundaries = {};
    BOUNDARY_CONFIGS.forEach(cfg => {
      this._boundaries[cfg.id] = {
        active:      false,
        lineColor:   '#1a1a1a',
        lineWidth:   1.5,
        fillColor:   '#3388ff',
        fillOpacity: 0.1,
        showNames:   false,
      };
    });

    // ── Per-state county overlay state ─────────────────────────────────────
    this._activeCountyStates = new Set();   // state codes currently on the map
    this._countyGeoCache      = {};         // code → transformed FeatureCollection

    // Re-register the sprite and restore any active layers whenever a new
    // style loads (initial load or after style switching).
    this._map.on('style.load', () => this._onStyleLoad());
  }

  _onStyleLoad() {
    // Re-add any layers that were active before the style switch.
    // (The sprite lives in the style JSON itself, so no addSprite call needed.)
    for (const id of this._active) {
      const group = POI_GROUPS.find(g => g.id === id);
      if (group) this._addLayer(group);
    }

    BOUNDARY_CONFIGS.forEach(cfg => {
      if (cfg.id === 'counties') return;
      if (this._boundaries[cfg.id].active) this._addBoundaryLayer(cfg);
    });

    for (const code of this._activeCountyStates) this._addCountyStateLayer(code);
  }

  // ── Boundaries: layer management ─────────────────────────────────────────

  _boundaryLayerIds(cfg) {
    const base = `boundary-${cfg.id}`;
    return { fill: `${base}-fill`, line: `${base}-line`, label: `${base}-label` };
  }

  _addBoundaryLayer(cfg) {
    const state = this._boundaries[cfg.id];
    const srcId = `boundary-${cfg.id}-src`;
    const ids   = this._boundaryLayerIds(cfg);

    if (!this._map.getSource(srcId)) {
      this._map.addSource(srcId, { type: 'geojson', data: cfg.url });
    }
    if (!this._map.getLayer(ids.fill)) {
      this._map.addLayer({
        id: ids.fill, type: 'fill', source: srcId,
        paint: { 'fill-color': state.fillColor, 'fill-opacity': state.fillOpacity },
      });
    }
    if (!this._map.getLayer(ids.line)) {
      this._map.addLayer({
        id: ids.line, type: 'line', source: srcId,
        paint: { 'line-color': state.lineColor, 'line-width': state.lineWidth },
      });
    }
    if (!this._map.getLayer(ids.label)) {
      this._map.addLayer({
        id: ids.label, type: 'symbol', source: srcId,
        layout: {
          'text-field':  ['get', cfg.nameProp],
          'text-font':   ['Noto Sans Regular'],
          'text-size':   11,
          'visibility':  state.showNames ? 'visible' : 'none',
        },
        paint: {
          'text-color':      '#333333',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
        },
      });
    }
  }

  _removeBoundaryLayer(cfg) {
    const srcId = `boundary-${cfg.id}-src`;
    const ids   = this._boundaryLayerIds(cfg);
    [ids.label, ids.line, ids.fill].forEach(id => {
      if (this._map.getLayer(id)) this._map.removeLayer(id);
    });
    if (this._map.getSource(srcId)) this._map.removeSource(srcId);
  }

  _updateBoundaryPaint(cfg) {
    if (cfg.id === 'counties') { this._updateCountyStateLayers(); return; }

    const state = this._boundaries[cfg.id];
    const ids   = this._boundaryLayerIds(cfg);
    if (this._map.getLayer(ids.fill)) {
      this._map.setPaintProperty(ids.fill, 'fill-color',   state.fillColor);
      this._map.setPaintProperty(ids.fill, 'fill-opacity', state.fillOpacity);
    }
    if (this._map.getLayer(ids.line)) {
      this._map.setPaintProperty(ids.line, 'line-color', state.lineColor);
      this._map.setPaintProperty(ids.line, 'line-width', state.lineWidth);
    }
    if (this._map.getLayer(ids.label)) {
      this._map.setLayoutProperty(ids.label, 'visibility', state.showNames ? 'visible' : 'none');
    }
  }

  // ── Boundaries: per-state county layers ──────────────────────────────────

  _countyStateLayerIds(code) {
    const base = `county-${code}`;
    return { fill: `${base}-fill`, line: `${base}-line`, label: `${base}-label` };
  }

  async _addCountyStateLayer(code) {
    const srcId = `county-${code}-src`;
    if (this._map.getSource(srcId)) return;

    let data = this._countyGeoCache[code];
    if (!data) {
      data = await fetchStateCountiesGeoJSON(code);
      this._countyGeoCache[code] = data;
    }
    // The panel may have been closed (and the layer removed) while we awaited.
    if (!this._activeCountyStates.has(code) || this._map.getSource(srcId)) return;

    const state = this._boundaries.counties;
    const ids   = this._countyStateLayerIds(code);

    this._map.addSource(srcId, { type: 'geojson', data });
    this._map.addLayer({
      id: ids.fill, type: 'fill', source: srcId,
      paint: { 'fill-color': state.fillColor, 'fill-opacity': state.fillOpacity },
    });
    this._map.addLayer({
      id: ids.line, type: 'line', source: srcId,
      paint: { 'line-color': state.lineColor, 'line-width': state.lineWidth },
    });
    this._map.addLayer({
      id: ids.label, type: 'symbol', source: srcId,
      layout: {
        'text-field': ['get', 'name'],
        'text-font':  ['Noto Sans Regular'],
        'text-size':  11,
        'visibility': state.showNames ? 'visible' : 'none',
      },
      paint: {
        'text-color':      '#333333',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    });
  }

  _removeCountyStateLayer(code) {
    const srcId = `county-${code}-src`;
    const ids   = this._countyStateLayerIds(code);
    [ids.label, ids.line, ids.fill].forEach(id => {
      if (this._map.getLayer(id)) this._map.removeLayer(id);
    });
    if (this._map.getSource(srcId)) this._map.removeSource(srcId);
  }

  _updateCountyStateLayers() {
    const state = this._boundaries.counties;
    for (const code of this._activeCountyStates) {
      const ids = this._countyStateLayerIds(code);
      if (this._map.getLayer(ids.fill)) {
        this._map.setPaintProperty(ids.fill, 'fill-color',   state.fillColor);
        this._map.setPaintProperty(ids.fill, 'fill-opacity', state.fillOpacity);
      }
      if (this._map.getLayer(ids.line)) {
        this._map.setPaintProperty(ids.line, 'line-color', state.lineColor);
        this._map.setPaintProperty(ids.line, 'line-width', state.lineWidth);
      }
      if (this._map.getLayer(ids.label)) {
        this._map.setLayoutProperty(ids.label, 'visibility', state.showNames ? 'visible' : 'none');
      }
    }
  }

  _addLayer(group) {
    if (!this._map.getLayer(group.id)) {
      this._map.addLayer(buildPoiLayer(group));
    }
  }

  _removeLayer(group) {
    if (this._map.getLayer(group.id)) {
      this._map.removeLayer(group.id);
    }
  }

  _toggleGroup(group, btn) {
    if (this._active.has(group.id)) {
      // Turn off
      this._removeLayer(group);
      this._active.delete(group.id);
      btn.classList.remove('active');
    } else {
      // Turn on
      this._addLayer(group);
      this._active.add(group.id);
      btn.classList.add('active');
    }
  }

  mount(container) {
    this._panel = document.createElement('div');
    this._panel.id = 'overlays-panel';

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'ovr-header';

    const title = document.createElement('h2');
    title.textContent = 'Overlays';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ovr-close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close panel';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.dispatchEvent(new CustomEvent('panel-close', { bubbles: true }));
    });

    header.append(title, closeBtn);
    this._panel.appendChild(header);

    // ── Submenus list ────────────────────────────────────────────────────────
    const menuList = document.createElement('ul');
    menuList.className = 'ovr-menu-list';

    // ── POIs submenu ─────────────────────────────────────────────────────────
    const poisItem = document.createElement('li');
    poisItem.className = 'ovr-menu-item';

    const poisDetails = document.createElement('details');

    const poisSummary = document.createElement('summary');
    poisSummary.className = 'ovr-submenu-header';
    poisSummary.textContent = 'POIs';

    const groupList = document.createElement('ul');
    groupList.className = 'ovr-group-list';

    POI_GROUPS.forEach(group => {
      const li = document.createElement('li');
      li.className = 'ovr-group-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ovr-group-btn';
      btn.textContent = group.label;

      // Restore active state if already on (e.g. panel reopened)
      if (this._active.has(group.id)) btn.classList.add('active');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleGroup(group, btn);
      });

      this._btnEls[group.id] = btn;

      li.appendChild(btn);
      groupList.appendChild(li);
    });

    poisDetails.append(poisSummary, groupList);
    poisItem.appendChild(poisDetails);
    menuList.appendChild(poisItem);

    // ── Text submenu ─────────────────────────────────────────────────────────
    const textItem = document.createElement('li');
    textItem.className = 'ovr-menu-item';

    const textDetails = document.createElement('details');
    this._textDetails = textDetails;

    const textSummary = document.createElement('summary');
    textSummary.className = 'ovr-submenu-header';
    textSummary.textContent = 'Text';

    const textControls = document.createElement('div');
    textControls.className = 'ovr-text-controls';

    const stopClick = el => el.addEventListener('click', e => e.stopPropagation());

    // Font
    const fontRow = document.createElement('div');
    fontRow.className = 'ovr-text-row';
    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font';
    const fontSel = document.createElement('select');
    fontSel.className = 'ovr-text-select';
    FONTS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = `"${f.label}", sans-serif`;
      fontSel.appendChild(opt);
    });
    fontSel.value = this._textFont;
    stopClick(fontSel);
    fontSel.addEventListener('change', () => {
      loadFont(fontSel.value);
      this._textFont = fontSel.value;
      this._updateActiveText();
    });
    fontRow.append(fontLabel, fontSel);
    this._textFontSel = fontSel;

    // Size
    const sizeRow = document.createElement('div');
    sizeRow.className = 'ovr-text-row';
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Size';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = 8;
    sizeInput.max = 96;
    sizeInput.value = this._textSize;
    sizeInput.className = 'ovr-text-size-input';
    stopClick(sizeInput);
    sizeInput.addEventListener('change', () => {
      this._textSize = Math.max(8, Math.min(96, Number(sizeInput.value) || 18));
      sizeInput.value = this._textSize;
      this._updateActiveText();
    });
    sizeRow.append(sizeLabel, sizeInput);
    this._textSizeInput = sizeInput;

    // Style — Bold / Italic / Underline toggles
    const styleRow = document.createElement('div');
    styleRow.className = 'ovr-text-row';
    const styleLabel = document.createElement('label');
    styleLabel.textContent = 'Style';
    const styleWrap = document.createElement('div');
    styleWrap.className = 'ovr-text-style-wrap';

    const makeStyleBtn = (html, title, key) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = html;
      btn.title = title;
      btn.className = 'ovr-text-style-btn';
      if (this[key]) btn.classList.add('ovr-text-style-active');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this[key] = !this[key];
        btn.classList.toggle('ovr-text-style-active', this[key]);
        this._updateActiveText();
      });
      styleWrap.appendChild(btn);
      return btn;
    };
    this._textBoldBtn      = makeStyleBtn('<b>B</b>', 'Bold',      '_textBold');
    this._textItalicBtn    = makeStyleBtn('<i>I</i>', 'Italic',    '_textItalic');
    this._textUnderlineBtn = makeStyleBtn('<u>U</u>', 'Underline', '_textUnderline');
    styleRow.append(styleLabel, styleWrap);

    // Color
    const colorRow = document.createElement('div');
    colorRow.className = 'ovr-text-row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'ovr-text-color';
    colorInput.value = this._textColor;
    stopClick(colorInput);
    colorInput.addEventListener('input', () => {
      this._textColor = colorInput.value;
      this._updateActiveText();
    });
    colorRow.append(colorLabel, colorInput);
    this._textColorInput = colorInput;

    // Border checkbox + color
    const borderRow = document.createElement('div');
    borderRow.className = 'ovr-text-row';
    const borderLabel = document.createElement('label');
    borderLabel.className = 'ovr-text-checkbox-label';
    const borderCheckbox = document.createElement('input');
    borderCheckbox.type = 'checkbox';
    borderCheckbox.className = 'ovr-text-checkbox';
    stopClick(borderCheckbox);
    borderCheckbox.addEventListener('change', () => {
      this._textBorder = borderCheckbox.checked;
      this._updateActiveText();
    });
    borderLabel.append(borderCheckbox, document.createTextNode(' Border'));
    borderRow.appendChild(borderLabel);

    const borderColorInput = document.createElement('input');
    borderColorInput.type = 'color';
    borderColorInput.className = 'ovr-text-color';
    borderColorInput.value = this._textBorderColor;
    stopClick(borderColorInput);
    borderColorInput.addEventListener('input', () => {
      this._textBorderColor = borderColorInput.value;
      this._updateActiveText();
    });
    borderRow.appendChild(borderColorInput);
    this._textBorderCheckbox   = borderCheckbox;
    this._textBorderColorInput = borderColorInput;

    // Background checkbox + color
    const bgRow = document.createElement('div');
    bgRow.className = 'ovr-text-row';
    const bgLabel = document.createElement('label');
    bgLabel.className = 'ovr-text-checkbox-label';
    const bgCheckbox = document.createElement('input');
    bgCheckbox.type = 'checkbox';
    bgCheckbox.className = 'ovr-text-checkbox';
    stopClick(bgCheckbox);
    bgCheckbox.addEventListener('change', () => {
      this._textBackground = bgCheckbox.checked;
      this._updateActiveText();
    });
    bgLabel.append(bgCheckbox, document.createTextNode(' Background'));
    bgRow.appendChild(bgLabel);

    const bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    bgColorInput.className = 'ovr-text-color';
    bgColorInput.value = this._textBgColor;
    stopClick(bgColorInput);
    bgColorInput.addEventListener('input', () => {
      this._textBgColor = bgColorInput.value;
      this._updateActiveText();
    });
    bgRow.appendChild(bgColorInput);
    this._textBgCheckbox    = bgCheckbox;
    this._textBgColorInput  = bgColorInput;

    // Place button — arms "click map to place" mode
    const placeRow = document.createElement('div');
    placeRow.className = 'ovr-text-row';
    const placeBtn = document.createElement('button');
    placeBtn.type = 'button';
    placeBtn.className = 'ovr-text-place-btn';
    placeBtn.textContent = 'Click map to place text';
    placeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._placeArmed) this._disarmPlacement();
      else this._armPlacement();
    });
    placeRow.appendChild(placeBtn);
    this._textPlaceBtn = placeBtn;

    textControls.append(fontRow, sizeRow, styleRow, colorRow, borderRow, bgRow, placeRow);
    textDetails.append(textSummary, textControls);
    textItem.appendChild(textDetails);
    menuList.appendChild(textItem);

    // ── Boundaries submenu ────────────────────────────────────────────────
    const boundariesItem = document.createElement('li');
    boundariesItem.className = 'ovr-menu-item';

    const boundariesDetails = document.createElement('details');

    const boundariesSummary = document.createElement('summary');
    boundariesSummary.className = 'ovr-submenu-header';
    boundariesSummary.textContent = 'Boundaries';

    const boundariesList = document.createElement('ul');
    boundariesList.className = 'ovr-group-list';

    BOUNDARY_CONFIGS.forEach(cfg => {
      const state = this._boundaries[cfg.id];

      const subItem = document.createElement('li');
      const subDetails = document.createElement('details');

      const subSummary = document.createElement('summary');
      subSummary.className = 'ovr-submenu-header';
      subSummary.textContent = cfg.label;

      const controls = document.createElement('div');
      controls.className = 'ovr-text-controls';

      // Show <States> checkbox — Counties uses the per-state side panel instead.
      let showRow = null;
      if (cfg.id !== 'counties') {
        showRow = document.createElement('div');
        showRow.className = 'ovr-text-row';
        const showLabel = document.createElement('label');
        showLabel.className = 'ovr-text-checkbox-label';
        const showCheckbox = document.createElement('input');
        showCheckbox.type = 'checkbox';
        showCheckbox.className = 'ovr-text-checkbox';
        stopClick(showCheckbox);
        showCheckbox.addEventListener('change', () => {
          state.active = showCheckbox.checked;
          if (state.active) this._addBoundaryLayer(cfg);
          else this._removeBoundaryLayer(cfg);
        });
        showLabel.append(showCheckbox, document.createTextNode(` Show ${cfg.label}`));
        showRow.appendChild(showLabel);
      }

      // Line color
      const lineColorRow = document.createElement('div');
      lineColorRow.className = 'ovr-text-row';
      const lineColorLabel = document.createElement('label');
      lineColorLabel.textContent = 'Line color';
      const lineColorInput = document.createElement('input');
      lineColorInput.type = 'color';
      lineColorInput.className = 'ovr-text-color';
      lineColorInput.value = state.lineColor;
      stopClick(lineColorInput);
      lineColorInput.addEventListener('input', () => {
        state.lineColor = lineColorInput.value;
        this._updateBoundaryPaint(cfg);
      });
      lineColorRow.append(lineColorLabel, lineColorInput);

      // Line width
      const lineWidthRow = document.createElement('div');
      lineWidthRow.className = 'ovr-text-row';
      const lineWidthLabel = document.createElement('label');
      lineWidthLabel.textContent = 'Line width';
      const lineWidthInput = document.createElement('input');
      lineWidthInput.type = 'number';
      lineWidthInput.min = 0;
      lineWidthInput.max = 10;
      lineWidthInput.step = 0.5;
      lineWidthInput.value = state.lineWidth;
      lineWidthInput.className = 'ovr-text-size-input';
      stopClick(lineWidthInput);
      lineWidthInput.addEventListener('change', () => {
        state.lineWidth = Math.max(0, Math.min(10, Number(lineWidthInput.value) || 0));
        lineWidthInput.value = state.lineWidth;
        this._updateBoundaryPaint(cfg);
      });
      lineWidthRow.append(lineWidthLabel, lineWidthInput);

      // Fill color
      const fillColorRow = document.createElement('div');
      fillColorRow.className = 'ovr-text-row';
      const fillColorLabel = document.createElement('label');
      fillColorLabel.textContent = 'Fill color';
      const fillColorInput = document.createElement('input');
      fillColorInput.type = 'color';
      fillColorInput.className = 'ovr-text-color';
      fillColorInput.value = state.fillColor;
      stopClick(fillColorInput);
      fillColorInput.addEventListener('input', () => {
        state.fillColor = fillColorInput.value;
        this._updateBoundaryPaint(cfg);
      });
      fillColorRow.append(fillColorLabel, fillColorInput);

      // Fill opacity
      const fillOpacityRow = document.createElement('div');
      fillOpacityRow.className = 'ovr-text-row';
      const fillOpacityLabel = document.createElement('label');
      fillOpacityLabel.textContent = 'Fill opacity';
      const fillOpacityInput = document.createElement('input');
      fillOpacityInput.type = 'number';
      fillOpacityInput.min = 0;
      fillOpacityInput.max = 1;
      fillOpacityInput.step = 0.05;
      fillOpacityInput.value = state.fillOpacity;
      fillOpacityInput.className = 'ovr-text-size-input';
      stopClick(fillOpacityInput);
      fillOpacityInput.addEventListener('change', () => {
        state.fillOpacity = Math.max(0, Math.min(1, Number(fillOpacityInput.value) || 0));
        fillOpacityInput.value = state.fillOpacity;
        this._updateBoundaryPaint(cfg);
      });
      fillOpacityRow.append(fillOpacityLabel, fillOpacityInput);

      // Show names checkbox
      const namesRow = document.createElement('div');
      namesRow.className = 'ovr-text-row';
      const namesLabel = document.createElement('label');
      namesLabel.className = 'ovr-text-checkbox-label';
      const namesCheckbox = document.createElement('input');
      namesCheckbox.type = 'checkbox';
      namesCheckbox.className = 'ovr-text-checkbox';
      stopClick(namesCheckbox);
      namesCheckbox.addEventListener('change', () => {
        state.showNames = namesCheckbox.checked;
        this._updateBoundaryPaint(cfg);
      });
      namesLabel.append(namesCheckbox, document.createTextNode(' Show names'));
      namesRow.appendChild(namesLabel);

      if (showRow) controls.appendChild(showRow);
      controls.append(lineColorRow, lineWidthRow, fillColorRow, fillOpacityRow, namesRow);
      subDetails.append(subSummary, controls);
      subItem.appendChild(subDetails);
      boundariesList.appendChild(subItem);

      // ── Counties: per-state side panel ─────────────────────────────────
      if (cfg.id === 'counties') {
        const statesPanel = document.createElement('div');
        statesPanel.className = 'ovr-states-panel';

        const statesList = document.createElement('ul');
        statesList.className = 'ovr-states-list';

        STATE_CODES.forEach(code => {
          const li = document.createElement('li');
          const label = document.createElement('label');
          label.className = 'ovr-state-label';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'ovr-text-checkbox';
          stopClick(checkbox);
          checkbox.addEventListener('change', () => {
            label.classList.toggle('active', checkbox.checked);
            if (checkbox.checked) {
              this._activeCountyStates.add(code);
              this._addCountyStateLayer(code);
            } else {
              this._activeCountyStates.delete(code);
              this._removeCountyStateLayer(code);
            }
          });

          label.append(checkbox, document.createTextNode(` ${code}`));
          li.appendChild(label);
          statesList.appendChild(li);
        });

        statesPanel.appendChild(statesList);
        document.body.appendChild(statesPanel);
        this._countiesStatesPanel = statesPanel;

        // Open/close the side panel in lock-step with the Counties submenu,
        // positioning it just to the right of the Overlays panel (appended to
        // <body> so it isn't clipped by the panel's overflow:auto).
        subDetails.addEventListener('toggle', () => {
          if (subDetails.open) {
            const rect = this._panel.getBoundingClientRect();
            statesPanel.style.left = `${rect.right + 4}px`;
            statesPanel.style.top  = `${rect.top}px`;
          }
          statesPanel.classList.toggle('open', subDetails.open);
        });
        this._countiesSubDetails = subDetails;
      }
    });

    boundariesDetails.append(boundariesSummary, boundariesList);
    boundariesItem.appendChild(boundariesDetails);
    menuList.appendChild(boundariesItem);

    this._panel.appendChild(menuList);
    container.appendChild(this._panel);

    // Disarm placement mode if the panel is closed mid-arm
    container.addEventListener('panel-close', () => this._disarmPlacement());

    // Close the per-state counties side panel if the Overlays panel closes
    container.addEventListener('panel-close', () => this._closeCountiesStates());

    // The Overlays panel can also be closed by clicking another toolbar menu
    // or anywhere outside it (main.js's closeAllDropdowns, which just removes
    // the 'open' class without firing 'panel-close'). Watch for that too, so
    // the per-state side panel never stays visible after the Overlays panel
    // itself has closed.
    new MutationObserver(() => {
      if (!container.classList.contains('open')) this._closeCountiesStates();
    }).observe(container, { attributes: true, attributeFilter: ['class'] });

    // Collapsing the "Boundaries" submenu (without closing the whole panel)
    // should also close the Counties side panel.
    boundariesDetails.addEventListener('toggle', () => {
      if (!boundariesDetails.open) this._closeCountiesStates();
    });

    // Escape key disarms placement mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._placeArmed) this._disarmPlacement();
    });

    // Deselect text overlay on map click outside any text element
    this._map.on('click', (e) => {
      if (!e.originalEvent.target.closest?.('.map-text')) this._deselectText();
    });
  }

  // ── Text overlay: placement arming ───────────────────────────────────────────

  _armPlacement() {
    if (this._placeArmed) return;
    this._placeArmed = true;
    this._textPlaceBtn.classList.add('ovr-text-place-active');
    this._textPlaceBtn.textContent = 'Click the map to place…';
    this._map.getCanvas().style.cursor = 'text';

    this._placementHandler = (e) => {
      this._resetPlacementUI();
      this._placementHandler = null;
      this._placeText(e.lngLat);
    };
    this._map.once('click', this._placementHandler);
  }

  /**
   * Collapse the Counties submenu and hide its per-state side panel. The side
   * panel must never be visible without the Counties submenu open, and the
   * Counties submenu must never be open while the Overlays panel is closed.
   */
  _closeCountiesStates() {
    if (this._countiesSubDetails) this._countiesSubDetails.open = false;
    if (this._countiesStatesPanel) this._countiesStatesPanel.classList.remove('open');
  }

  _disarmPlacement() {
    if (!this._placeArmed) return;
    this._resetPlacementUI();
    if (this._placementHandler) {
      this._map.off('click', this._placementHandler);
      this._placementHandler = null;
    }
  }

  _resetPlacementUI() {
    this._placeArmed = false;
    this._textPlaceBtn.classList.remove('ovr-text-place-active');
    this._textPlaceBtn.textContent = 'Click map to place text';
    this._map.getCanvas().style.cursor = '';
  }

  // ── Text overlay: placement ───────────────────────────────────────────────────

  _placeText(lngLat) {
    const opts = {
      font: this._textFont, size: this._textSize, color: this._textColor,
      bold: this._textBold, italic: this._textItalic, underline: this._textUnderline,
      border: this._textBorder, borderColor: this._textBorderColor,
      background: this._textBackground, bgColor: this._textBgColor,
      text: '',
    };
    const el = buildTextEl(opts, false);

    // Use draggable:false — we implement drag ourselves so a short press
    // edits the text while a real drag moves the element (mirrors LocatorPanel).
    const marker = new maplibregl.Marker({
      element: el,
      anchor: 'left',
      draggable: false,
    })
    .setLngLat(lngLat)
    .addTo(this._map);

    // Disable MapLibre's native _update — we manage the CSS transform ourselves
    // so the element's left edge stays pinned to the geographic anchor.
    const _originalUpdate = marker._update;
    this._map.off('move',                 _originalUpdate);
    this._map.off('moveend',              _originalUpdate);
    this._map.off('terrain',              _originalUpdate);
    this._map.off('projectiontransition', _originalUpdate);
    marker._update = () => {};

    el.setAttribute('data-lng', lngLat.lng.toString());
    el.setAttribute('data-lat', lngLat.lat.toString());
    el.dataset.font  = opts.font;
    el.dataset.size  = String(opts.size);
    el.dataset.color = opts.color;
    el.dataset.borderColor = opts.borderColor;
    el.dataset.bgColor     = opts.bgColor;

    const entry = { marker, el };
    this._textEls.push(entry);

    this._applyTextTransform(el, lngLat.lng, lngLat.lat);

    // ── Delete button ──────────────────────────────────────────────────────
    el.querySelector('.mt-del').addEventListener('click', (e) => {
      e.stopPropagation();
      marker.remove();
      this._textEls = this._textEls.filter(t => t !== entry);
      if (this._activeTextEl === el) this._activeTextEl = null;
    });

    // ── Custom drag (mirrors LocatorPanel) ─────────────────────────────────
    // A short press focuses the text for editing; a real drag (>4px) moves it.
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      this._selectText(el);

      const startLngLat  = marker.getLngLat();
      const startProject = this._map.project(startLngLat);
      const startMouse   = { x: e.clientX, y: e.clientY };
      let   dragging     = false;

      const onMove = (me) => {
        const dx = me.clientX - startMouse.x;
        const dy = me.clientY - startMouse.y;
        if (!dragging && Math.hypot(dx, dy) > 4) {
          dragging = true;
          el.querySelector('.mt-text').blur();
          el.classList.add('mt-dragging');
        }
        if (dragging) {
          const newLngLat = this._map.unproject([startProject.x + dx, startProject.y + dy]);
          marker._lngLat = newLngLat;
          el.setAttribute('data-lng', newLngLat.lng.toString());
          el.setAttribute('data-lat', newLngLat.lat.toString());
          this._applyTextTransform(el, newLngLat.lng, newLngLat.lat);
        }
      };

      const onUp = (ue) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        el.classList.remove('mt-dragging');
        this._map.fire('move');

        if (!dragging) {
          if (ue.target.closest('.mt-text')) {
            const textEl = el.querySelector('.mt-text');
            textEl.focus();
            const range = document.caretRangeFromPoint?.(ue.clientX, ue.clientY);
            if (range) {
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Prevent map 'click' from deselecting when clicking the element
    el.addEventListener('click', (e) => e.stopPropagation());

    // ── Auto-focus on creation ─────────────────────────────────────────────
    this._selectText(el);
    requestAnimationFrame(() => {
      el.querySelector('.mt-text')?.focus();
    });
  }

  // ── Text overlay: selection & live editing ────────────────────────────────────

  _selectText(el) {
    if (this._activeTextEl === el) return;
    this._deselectText();
    this._activeTextEl = el;
    el.classList.add('mt-selected');

    // Sync controls to this element's current style
    this._textFont      = el.dataset.font  || FONTS[0].value;
    this._textSize      = parseFloat(el.dataset.size) || 18;
    this._textColor     = el.dataset.color || '#1a1a1a';
    this._textBold      = el.classList.contains('mt-bold');
    this._textItalic    = el.classList.contains('mt-italic');
    this._textUnderline = el.classList.contains('mt-underline');
    this._textBorder      = el.classList.contains('mt-border');
    this._textBorderColor = el.dataset.borderColor || '#1a1a1a';
    this._textBackground  = el.classList.contains('mt-bg');
    this._textBgColor     = el.dataset.bgColor || '#ffffff';

    if (this._textFontSel)      this._textFontSel.value = this._textFont;
    if (this._textSizeInput)    this._textSizeInput.value = this._textSize;
    if (this._textColorInput)   this._textColorInput.value = this._textColor;
    if (this._textBoldBtn)      this._textBoldBtn.classList.toggle('ovr-text-style-active', this._textBold);
    if (this._textItalicBtn)    this._textItalicBtn.classList.toggle('ovr-text-style-active', this._textItalic);
    if (this._textUnderlineBtn) this._textUnderlineBtn.classList.toggle('ovr-text-style-active', this._textUnderline);
    if (this._textBorderCheckbox)   this._textBorderCheckbox.checked = this._textBorder;
    if (this._textBorderColorInput) this._textBorderColorInput.value = this._textBorderColor;
    if (this._textBgCheckbox)       this._textBgCheckbox.checked = this._textBackground;
    if (this._textBgColorInput)     this._textBgColorInput.value = this._textBgColor;
  }

  _deselectText() {
    if (this._activeTextEl) {
      this._activeTextEl.classList.remove('mt-selected');
      this._activeTextEl = null;
    }
  }

  // Apply the current style controls to the selected text element
  _updateActiveText() {
    if (!this._activeTextEl) return;
    const el     = this._activeTextEl;
    const textEl = el.querySelector('.mt-text');
    if (!textEl) return;

    const displayFont = this._textFont.replace(/\+/g, ' ');
    textEl.style.fontFamily = `"${displayFont}", sans-serif`;
    textEl.style.fontSize   = `${this._textSize}px`;
    textEl.style.color      = this._textColor;
    textEl.style.borderColor     = this._textBorderColor;
    textEl.style.backgroundColor = this._textBackground ? this._textBgColor : '';

    el.classList.toggle('mt-bold',      this._textBold);
    el.classList.toggle('mt-italic',    this._textItalic);
    el.classList.toggle('mt-underline', this._textUnderline);
    el.classList.toggle('mt-border',    this._textBorder);
    el.classList.toggle('mt-bg',        this._textBackground);

    el.dataset.font  = this._textFont;
    el.dataset.size  = String(this._textSize);
    el.dataset.color = this._textColor;
    el.dataset.borderColor = this._textBorderColor;
    el.dataset.bgColor     = this._textBgColor;
  }

  // ── Text overlay: positioning across pan/zoom ─────────────────────────────────

  /**
   * Directly set the text element's CSS transform from its stored lng/lat.
   * Mirrors LocatorPanel._applyTransform but always anchors at the left-center
   * (the element's left edge sits on the geographic point).
   */
  _applyTextTransform(el, lng, lat) {
    const pt = this._map.project([lng, lat]);
    el.style.transform = `translate(0,-50%) translate(${pt.x}px,${pt.y}px) rotateX(0deg) rotateZ(0deg)`;
  }

  /**
   * Whether the "Text" submenu is currently expanded. Used by the toolbar's
   * outside-click handler to keep the Overlays panel open when the user
   * clicks the map to place text — the panel should only close via an
   * explicit action (another menu button, the submenu header, or the "x").
   */
  isTextSubmenuOpen() {
    return this._textDetails?.open ?? false;
  }

  /** Hide all text overlays during zoom to prevent pipeline-mismatch drift. */
  hideAll() {
    this._textEls.forEach(({ el }) => { el.style.visibility = 'hidden'; });
  }

  /** Re-project every text overlay to its correct post-zoom position and reveal it. */
  showAll() {
    for (const { el } of this._textEls) {
      const lng = parseFloat(el.getAttribute('data-lng'));
      const lat = parseFloat(el.getAttribute('data-lat'));
      if (!isNaN(lng) && !isNaN(lat)) this._applyTextTransform(el, lng, lat);
      el.style.visibility = '';
    }
  }

  /** Re-project all text overlays from stored lng/lat on every map move/zoom. */
  syncPositions() {
    for (const { el } of this._textEls) {
      const lng = parseFloat(el.getAttribute('data-lng'));
      const lat = parseFloat(el.getAttribute('data-lat'));
      if (!isNaN(lng) && !isNaN(lat)) this._applyTextTransform(el, lng, lat);
    }
  }
}
