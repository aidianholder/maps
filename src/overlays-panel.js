// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

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

export class OverlaysPanel {
  constructor(map) {
    this._map      = map;
    this._active   = new Set();   // layer IDs currently on the map
    this._btnEls   = {};          // groupId → button element

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

    this._panel.appendChild(menuList);
    container.appendChild(this._panel);
  }
}
