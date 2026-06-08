// Copyright (C) 2026 Aidian Holder
// SPDX-License-Identifier: GPL-3.0-only

/**
 * Per-style layer panel config.
 *
 * Each entry has:
 *   test(style)      — returns true when this config matches the loaded style
 *   groups           — [{ displayName, layers[] }] renames / multi-layer groups
 *   hidden           — layer IDs to hide from the panel
 *   hiddenPrefixes   — layer ID prefixes to hide (overridden by explicit groups)
 */

// ─── Protomaps / Proto style ────────────────────────────────────────────────

const PROTO_GROUPS = [
  // Renames
  { displayName: 'parks',               layers: ['landuse_park'] },
  { displayName: 'building footprints', layers: ['buildings'] },
  { displayName: 'boundaries: country', layers: ['boundaries_country'] },
  { displayName: 'labels: major roads', layers: ['roads_labels_major'] },
  { displayName: 'labels: minor roads', layers: ['roads_labels_minor'] },
  { displayName: 'labels: states',      layers: ['places_region'] },
  { displayName: 'labels: country',     layers: ['places_country'] },
  { displayName: 'labels: water',       layers: ['water_waterway_label', 'water_label_lakes'] },
  { displayName: 'one way arrows',      layers: ['roads_oneway'] },
  { displayName: 'neighborhoods',       layers: ['places_subplace'] },
  { displayName: 'highway shields',     layers: ['highway shields'] },

  // Groups
  { displayName: 'airports',
    layers: ['landuse_aerodrome', 'roads_runway', 'roads_taxiway', 'landuse_runway'] },
  { displayName: 'water',
    layers: ['water', 'water_stream', 'water_river'] },
  { displayName: 'highways',
    layers: [
      'roads_highway_casing_early', 'roads_highway_casing_late',
      'roads_highway',
      'roads_tunnels_highway_casing', 'roads_tunnels_highway',
      'roads_bridges_highway_casing', 'roads_bridges_highway',
    ] },
  { displayName: 'major roads',
    layers: [
      'roads_major_casing_early', 'roads_major_casing_late',
      'roads_major',
      'roads_tunnels_major_casing', 'roads_tunnels_major',
      'roads_bridges_major_casing', 'roads_bridges_major',
    ] },
  { displayName: 'minor roads',
    layers: [
      'roads_minor_casing', 'roads_minor',
      'roads_tunnels_minor_casing', 'roads_tunnels_minor',
      'roads_bridges_minor_casing', 'roads_bridges_minor',
    ] },
  { displayName: 'ramps/interchanges',
    layers: [
      'roads_link_casing', 'roads_link',
      'roads_tunnels_link_casing', 'roads_tunnels_link',
      'roads_bridges_link_casing', 'roads_bridges_link',
    ] },
  { displayName: 'service roads/alleys/etc',
    layers: ['roads_minor_service_casing', 'roads_minor_service'] },
  { displayName: 'paths/trails',
    layers: [
      'roads_other',
      'roads_tunnels_other_casing', 'roads_tunnels_other',
      'roads_bridges_other_casing', 'roads_bridges_other',
    ] },
  { displayName: 'rail',          layers: ['roads_rail'] },
];

// ─── OSM Bright ─────────────────────────────────────────────────────────────

const BRIGHT_GROUPS = [
  // Renames / single-layer groups
  { displayName: 'parks',               layers: ['park', 'park_outline'] },
  { displayName: 'woodland',            layers: ['landcover_wood'] },
  { displayName: 'grassland',           layers: ['landcover_grass'] },
  { displayName: 'ice/snow',            layers: ['landcover_ice'] },
  { displayName: 'wetlands',            layers: ['landcover_wetland'] },
  { displayName: 'sand/beach',          layers: ['landcover_sand'] },
  { displayName: 'sports facilities',   layers: ['landuse_pitch', 'landuse_track'] },
  { displayName: 'cemeteries',          layers: ['landuse_cemetery'] },
  { displayName: 'water',               layers: ['water'] },
  { displayName: 'waterways',           layers: ['waterway_tunnel', 'waterway_river', 'waterway_other'] },
  { displayName: 'building footprints', layers: ['building', 'building-3d'] },
  { displayName: 'one way arrows',      layers: ['road_one_way_arrow', 'road_one_way_arrow_opposite'] },
  { displayName: 'boundaries: state',   layers: ['boundary_3'] },
  { displayName: 'boundaries: country', layers: ['boundary_2'] },
  { displayName: 'boundaries: disputed', layers: ['boundary_disputed'] },
  { displayName: 'labels: water',
    layers: ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'] },
  { displayName: 'labels: minor roads', layers: ['highway-name-minor'] },
  { displayName: 'labels: major roads', layers: ['highway-name-major'] },
  { displayName: 'highway shields',
    layers: ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us'] },
  { displayName: 'points of interest',  layers: ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit'] },
  { displayName: 'airport labels',      layers: ['airport'] },
  { displayName: 'neighborhoods',        layers: ['label_other'] },
  { displayName: 'villages',            layers: ['label_village'] },
  { displayName: 'towns',               layers: ['label_town'] },
  { displayName: 'cities',              layers: ['label_city', 'label_city_capital'] },
  { displayName: 'labels: states',      layers: ['label_state'] },
  { displayName: 'labels: country',
    layers: ['label_country_1', 'label_country_2', 'label_country_3'] },

  // Airport fill/line
  { displayName: 'airports',
    layers: ['aeroway_fill', 'aeroway_runway', 'aeroway_taxiway'] },

  // Road groups
  { displayName: 'highways',
    layers: [
      'tunnel_motorway_link_casing', 'tunnel_motorway_casing',
      'tunnel_motorway_link',        'tunnel_motorway',
      'road_motorway_link_casing',   'road_motorway_casing',
      'road_motorway_link',          'road_motorway',
      'bridge_motorway_link_casing', 'bridge_motorway_casing',
      'bridge_motorway_link',        'bridge_motorway',
    ] },
  { displayName: 'major roads',
    layers: [
      'tunnel_trunk_primary_casing', 'tunnel_trunk_primary',
      'road_trunk_primary_casing',   'road_trunk_primary',
      'bridge_trunk_primary_casing', 'bridge_trunk_primary',
    ] },
  { displayName: 'secondary/tertiary roads',
    layers: [
      'tunnel_secondary_tertiary_casing', 'tunnel_secondary_tertiary',
      'road_secondary_tertiary_casing',   'road_secondary_tertiary',
      'bridge_secondary_tertiary_casing', 'bridge_secondary_tertiary',
    ] },
  { displayName: 'minor roads',
    layers: [
      'tunnel_street_casing', 'tunnel_minor',
      'road_minor_casing',    'road_minor',
      'bridge_street_casing', 'bridge_street',
    ] },
  { displayName: 'ramps/interchanges',
    layers: [
      'tunnel_link_casing', 'tunnel_link',
      'road_link_casing',   'road_link',
      'bridge_link_casing', 'bridge_link',
    ] },
  { displayName: 'service roads/alleys/etc',
    layers: [
      'tunnel_service_track_casing', 'tunnel_service_track',
      'road_service_track_casing',   'road_service_track',
      'bridge_service_track_casing', 'bridge_service_track',
    ] },
  { displayName: 'paths/trails',
    layers: [
      'tunnel_path_pedestrian',
      'road_path_pedestrian',
      'bridge_path_pedestrian_casing', 'bridge_path_pedestrian',
    ] },
  { displayName: 'rail',
    layers: [
      'tunnel_major_rail', 'tunnel_major_rail_hatching',
      'road_major_rail',   'road_major_rail_hatching',
      'bridge_major_rail', 'bridge_major_rail_hatching',
    ] },
  { displayName: 'transit rail',
    layers: [
      'tunnel_transit_rail', 'tunnel_transit_rail_hatching',
      'road_transit_rail',   'road_transit_rail_hatching',
      'bridge_transit_rail', 'bridge_transit_rail_hatching',
    ] },
];

// ─── Positron ────────────────────────────────────────────────────────────────

const POSITRON_GROUPS = [
  { displayName: 'parks',               layers: ['park'] },
  { displayName: 'woodland',            layers: ['landcover_wood'] },
  { displayName: 'ice/glaciers',        layers: ['landcover_ice_shelf', 'landcover_glacier'] },
  { displayName: 'water',               layers: ['water'] },
  { displayName: 'waterways',           layers: ['waterway'] },
  { displayName: 'building footprints', layers: ['building'] },
  { displayName: 'airports',
    layers: ['aeroway-area', 'aeroway-runway-casing', 'aeroway-runway', 'aeroway-taxiway'] },
  { displayName: 'boundaries: state',   layers: ['boundary_3'] },
  { displayName: 'boundaries: country', layers: ['boundary_2'] },
  { displayName: 'boundaries: disputed', layers: ['boundary_disputed'] },
  { displayName: 'labels: water',
    layers: ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'] },
  { displayName: 'labels: minor roads', layers: ['highway-name-minor'] },
  { displayName: 'labels: major roads', layers: ['highway-name-major'] },
  { displayName: 'highway shields',
    layers: ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us'] },
  { displayName: 'airport labels',      layers: ['airport'] },
  { displayName: 'neighborhoods',        layers: ['label_other'] },
  { displayName: 'villages',            layers: ['label_village'] },
  { displayName: 'towns',               layers: ['label_town'] },
  { displayName: 'cities',              layers: ['label_city', 'label_city_capital'] },
  { displayName: 'labels: states',      layers: ['label_state'] },
  { displayName: 'labels: country',
    layers: ['label_country_1', 'label_country_2', 'label_country_3'] },

  // Road groups
  { displayName: 'highways',
    layers: [
      'tunnel_motorway_casing',          'tunnel_motorway_inner',
      'highway_motorway_casing',         'highway_motorway_inner', 'highway_motorway_subtle',
      'highway_motorway_bridge_casing',  'highway_motorway_bridge_inner',
    ] },
  { displayName: 'major roads',
    layers: ['highway_major_casing', 'highway_major_inner', 'highway_major_subtle'] },
  { displayName: 'minor roads',         layers: ['highway_minor'] },
  { displayName: 'paths/trails',        layers: ['highway_path'] },
  { displayName: 'rail',
    layers: ['railway', 'railway_dashline', 'railway_service', 'railway_service_dashline'] },
  { displayName: 'transit rail',
    layers: ['railway_transit', 'railway_transit_dashline'] },
];

const NEWSPRINT_GROUPS = [
  { displayName: 'terrain',             layers: ['Terrain'], defaultOff: true },
  { displayName: 'parks',               layers: ['park'] },
  { displayName: 'woodland',            layers: ['landcover_wood'] },
  { displayName: 'ice/glaciers',        layers: ['landcover_ice_shelf', 'landcover_glacier'] },
  { displayName: 'water',               layers: ['water'] },
  { displayName: 'waterways',           layers: ['waterway'] },
  { displayName: 'building footprints', layers: ['building'] },
  { displayName: 'airports',
    layers: ['aeroway-area', 'aeroway-runway-casing', 'aeroway-runway', 'aeroway-taxiway'] },
  { displayName: 'boundaries: state',   layers: ['boundary_3'] },
  { displayName: 'boundaries: country', layers: ['boundary_2'] },
  { displayName: 'boundaries: disputed', layers: ['boundary_disputed'] },
  { displayName: 'labels: water',
    layers: ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'] },
  { displayName: 'labels: minor roads', layers: ['highway-name-minor'] },
  { displayName: 'labels: major roads', layers: ['highway-name-major'] },
  { displayName: 'highway shields',
    layers: ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us'] },
  { displayName: 'airport labels',      layers: ['airport'] },
  { displayName: 'neighborhoods',        layers: ['label_other'] },
  { displayName: 'villages',            layers: ['label_village'] },
  { displayName: 'towns',               layers: ['label_town'] },
  { displayName: 'cities',              layers: ['label_city', 'label_city_capital'] },
  { displayName: 'labels: states',      layers: ['label_state'] },
  { displayName: 'labels: country',
    layers: ['label_country_1', 'label_country_2', 'label_country_3'] },

  // Road groups
  { displayName: 'highways',
    layers: [
      'tunnel_motorway_casing',          'tunnel_motorway_inner',
      'highway_motorway_casing',         'highway_motorway_inner', 'highway_motorway_subtle',
      'highway_motorway_bridge_casing',  'highway_motorway_bridge_inner',
      'highway_motorway_inner-copy',      'highway_ramps',
    ] },
  { displayName: 'major roads',
    layers: ['highway_major_casing', 'highway_major_inner', 'highway_major_subtle'] },
  { displayName: 'minor roads',         layers: ['highway_minor'] },
  { displayName: 'paths/trails',        layers: ['highway_path'] },
  { displayName: 'rail',
    layers: ['railway', 'railway_dashline', 'railway_service', 'railway_service_dashline'] },
  { displayName: 'transit rail',
    layers: ['railway_transit', 'railway_transit_dashline'] },
  { displayName: 'park labels',         layers: ['label_park'] },
];

// ─── AWS ─────────────────────────────────────────────────────────────────────

const AWS_GROUPS = [
  // Landuse / base
  { displayName: 'parks/greenspace',     layers: ['landuse_greenspace', 'landuse_public-complex', 'landuse_public-complex-above'] },
  { displayName: 'reservations',         layers: ['landuse_reservation'] },
  { displayName: 'beach/sand',           layers: ['landuse_beach'] },
  { displayName: 'ice/glaciers',         layers: ['landuse_glacier'] },
  { displayName: 'water',                layers: ['water_fill', 'water_ocean'] },
  { displayName: 'waterways',            layers: ['water_waterway'] },
  { displayName: 'ferry routes',         layers: ['ferry_line', 'ferry_label'] },
  { displayName: 'airports',
    layers: ['landuse_aerodrome', 'landuse_runway', 'airport_runway-casing', 'airport_runway'] },
  { displayName: 'building footprints',
    layers: ['building_fill', 'building_fill-above-tunnel', 'building_line'] },

  // Boundaries
  { displayName: 'boundaries: state',    layers: ['admin_region'] },
  { displayName: 'boundaries: country',  layers: ['admin_country'] },
  { displayName: 'boundaries: disputed',
    layers: ['admin_region-disputed-mask', 'admin_region-disputed',
             'admin_country-disputed-mask', 'admin_country-disputed'] },

  // Roads — highways (motorway + trunk + links)
  { displayName: 'highways',
    layers: [
      'tunnel_motorway-trunk-link-casing', 'tunnel_motorway-trunk-casing',
      'tunnel_motorway-trunk-link',        'tunnel_motorway-trunk',
      'road_motorway-trunk-link-casing',   'road_motorway-trunk-casing',
      'road_motorway-trunk-link',          'road_motorway-trunk',
      'bridge_motorway-trunk-link-shadow', 'bridge_motorway-trunk-shadow',
      'bridge_motorway-trunk-link-casing', 'bridge_motorway-trunk-casing',
      'bridge_motorway-trunk-link',        'bridge_motorway-trunk',
    ] },
  { displayName: 'major roads',
    layers: [
      'tunnel_primary-link-casing', 'tunnel_primary-casing',
      'tunnel_primary-link',        'tunnel_primary',
      'road_primary-link-casing',   'road_primary-casing',
      'road_primary-link',          'road_primary',
      'bridge_primary-secondary-link-shadow', 'bridge_primary-secondary-shadow',
      'bridge_primary-link-casing', 'bridge_primary-casing',
      'bridge_primary-link',        'bridge_primary',
    ] },
  { displayName: 'secondary/tertiary roads',
    layers: [
      'tunnel_tertiary-link-casing', 'tunnel_tertiary-casing',
      'tunnel_tertiary-link',        'tunnel_tertiary',
      'road_tertiary-link-casing',   'road_tertiary-casing',
      'road_tertiary-link',          'road_tertiary',
      'bridge_tertiary-link-shadow', 'bridge_tertiary-shadow',
      'bridge_tertiary-link-casing', 'bridge_tertiary-casing',
      'bridge_tertiary-link',        'bridge_tertiary',
    ] },
  { displayName: 'minor roads',
    layers: [
      'tunnel_minor-casing', 'tunnel_minor',
      'road_minor-casing',   'road_minor',
      'bridge_minor-shadow', 'bridge_minor-casing', 'bridge_minor',
    ] },
  { displayName: 'service roads/alleys/etc',
    layers: [
      'tunnel_service-casing', 'tunnel_service',
      'road_service-casing',   'road_service',
      'bridge_service-shadow', 'bridge_service-casing', 'bridge_service',
    ] },
  { displayName: 'paths/trails',         layers: ['road_path', 'bridge_path-under', 'bridge_path'] },
  { displayName: 'one way arrows',
    layers: ['tunnel_oneway-arrow', 'road_oneway-arrow', 'bridge_oneway-arrow'] },
  { displayName: 'rail',
    layers: ['rail_tunnel', 'rail_tie_tunnel', 'rail_road', 'rail_tie', 'rail_bridge', 'rail_tie_bridge'] },

  // Labels
  { displayName: 'labels: water',        layers: ['water_label-point', 'water_label-line'] },
  { displayName: 'labels: roads',        layers: ['road_label_small', 'road_label_medium', 'road_label_large'] },
  { displayName: 'highway shields',
    layers: [
      'shield_generic', 'shield_yellow', 'shield_green', 'shield_blue', 'shield_red',
      'shield_green-hexagon', 'shield_au', 'shield_be', 'shield_in', 'shield_it-blue',
      'shield_autostrade', 'shield_jp-expressway', 'shield_kr-expressway', 'shield_mashreq',
      'shield_md', 'shield_mx', 'shield_my', 'shield_na', 'shield_nl-s-road',
      'shield_us-state', 'shield_ve', 'shield_blue-pentagon', 'shield_green-square-kite',
      'shield_white-square-kite', 'shield_white-red-square-kite', 'shield_green-red-kite',
      'shield_blue-red-kite', 'shield_network', 'shield_white-kite',
    ] },
  { displayName: 'points of interest',
    layers: [
      'poi_700_business_services_generic', 'poi_800_facilities_generic',
      'poi_100_food_drink', 'poi_500_accommodations', 'poi_600_shopping',
      'poi_550_leisure_outdoor', 'poi_800_facilities', 'poi_300_sights_museums',
      'poi_200_going_out_entertainment', 'poi_700_business_services',
      'poi_900_areas_buildings', 'poi_400_transit_small', 'poi_400_transit',
    ] },
  { displayName: 'labels: parks & areas',
    layers: [
      'landuse_reservation_label', 'poi_landuse_park_lowzoom', 'poi_landuse_park',
      'poi_landuse_public_complex', 'nationalpark_label_lowzoom', 'nationalpark_label',
    ] },
  { displayName: 'airport labels',       layers: ['airport_label'] },
  { displayName: 'villages',             layers: ['place_label_locality_settlement_small'] },
  { displayName: 'towns',                layers: ['place_label_locality_settlement'] },
  { displayName: 'cities',               layers: ['place_label_locality_city'] },
  { displayName: 'labels: states',       layers: ['admin_label_region'] },
  { displayName: 'labels: country',      layers: ['admin_label_country'] },
];

// ─── Basic (Klokantech Basic) style ─────────────────────────────────────────

const BASIC_GROUPS = [
  // Land cover / land use
  { displayName: 'agriculture',           layers: ['landuse'] },
  { displayName: 'landuse: residential',  layers: ['landuse-residential'] },
  { displayName: 'national parks',        layers: ['landuse_overlay_national_park'] },
  { displayName: 'woodland',              layers: ['landcover_wood'] },
  { displayName: 'grassland',             layers: ['landcover_grass'] },
  { displayName: 'sand/beach',            layers: ['landcover_sand'] },
  { displayName: 'ice/glaciers',          layers: ['landcover-ice-shelf', 'landcover-glacier'] },

  // Water
  { displayName: 'water',                 layers: ['water'] },
  { displayName: 'waterways',
    layers: ['waterway-tunnel', 'waterway', 'waterway-bridge-case', 'waterway-bridge'] },

  // Built environment
  { displayName: 'building footprints',   layers: ['building'] },
  { displayName: 'house numbers',         layers: ['housenumber'] },
  { displayName: 'piers',                 layers: ['road_area_pier', 'road_pier'] },
  { displayName: 'bridges',               layers: ['road_bridge_area'] },
  { displayName: 'airports',
    layers: ['aeroway-area', 'aeroway-taxiway', 'aeroway-runway'] },

  // Roads & transit
  { displayName: 'one way arrows',        layers: ['road_oneway_opposite'] },
  { displayName: 'highways',              layers: ['road_major_motorway'] },
  { displayName: 'major roads',
    layers: ['road_trunk_primary', 'road_secondary_tertiary', 'tunnel_major', 'bridge_major case', 'bridge_major'] },
  { displayName: 'minor roads',
    layers: ['road_minor', 'tunnel_minor', 'bridge_minor case', 'bridge_minor'] },
  { displayName: 'paths/trails',          layers: ['road_path'] },
  { displayName: 'rail',                  layers: ['railway'] },
  { displayName: 'transit rail',          layers: ['railway-transit', 'tunnel_railway_transit'] },

  // Boundaries
  { displayName: 'boundaries: country',     layers: ['admin_country'] },
  { displayName: 'boundaries: sub-national', layers: ['admin_sub'] },

  // Places & labels
  { displayName: 'points of interest',    layers: ['poi_label'] },
  { displayName: 'airport labels',        layers: ['airport-label'] },
  { displayName: 'labels: major roads',   layers: ['road_major_label'] },
  { displayName: 'neighborhoods',         layers: ['place_label_other'] },
  { displayName: 'cities',                layers: ['place_label_city'] },
  { displayName: 'labels: country',       layers: ['country_label-other', 'country_label'] },
];

// ─── Exported config array ───────────────────────────────────────────────────

const PROTO_SECTIONS = [
  { name: 'Natural & Land', entries: ['parks', 'water', 'airports', 'building footprints'] },
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'minor roads', 'ramps/interchanges',
    'service roads/alleys/etc', 'paths/trails', 'rail', 'one way arrows',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: state', 'boundaries: county', 'boundaries: city',
  ]},
  { name: 'Places & Labels', entries: [
    'pois', 'neighborhoods', 'cities', 'towns', 'villages',
    'labels: states', 'labels: country',
    'labels: water', 'labels: minor roads', 'labels: major roads', 'highway shields',
  ]},
];

const BRIGHT_SECTIONS = [
  { name: 'Natural & Land', entries: [
    'parks', 'woodland', 'grassland', 'ice/snow', 'wetlands', 'sand/beach',
    'sports facilities', 'cemeteries', 'water', 'waterways', 'airports', 'building footprints',
  ]},
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'secondary/tertiary roads', 'minor roads', 'ramps/interchanges',
    'service roads/alleys/etc', 'paths/trails', 'rail', 'transit rail', 'one way arrows',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: state', 'boundaries: disputed',
  ]},
  { name: 'Places & Labels', entries: [
    'points of interest', 'airport labels', 'neighborhoods', 'cities', 'towns', 'villages',
    'labels: states', 'labels: country',
    'labels: water', 'labels: minor roads', 'labels: major roads', 'highway shields',
  ]},
];

const POSITRON_SECTIONS = [
  { name: 'Natural & Land', entries: [
    'parks', 'woodland', 'ice/glaciers', 'water', 'waterways', 'airports', 'building footprints',
  ]},
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'minor roads', 'paths/trails', 'rail', 'transit rail',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: state', 'boundaries: disputed',
  ]},
  { name: 'Places & Labels', entries: [
    'airport labels', 'neighborhoods', 'cities', 'towns', 'villages',
    'labels: states', 'labels: country',
    'labels: water', 'labels: minor roads', 'labels: major roads', 'highway shields',
  ]},
];

const NEWSPRINT_SECTIONS = [
  { name: 'Natural & Land', entries: [
    'terrain', 'parks', 'woodland', 'ice/glaciers', 'water', 'waterways', 'airports', 'building footprints',
  ]},
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'minor roads', 'paths/trails', 'rail', 'transit rail',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: state', 'boundaries: disputed',
  ]},
  { name: 'Places & Labels', entries: [
    'airport labels', 'neighborhoods', 'park labels', 'cities', 'towns', 'villages',
    'labels: states', 'labels: country',
    'labels: water', 'labels: minor roads', 'labels: major roads', 'highway shields',
  ]},
];

const AWS_SECTIONS = [
  { name: 'Natural & Land', entries: [
    'parks/greenspace', 'reservations', 'beach/sand', 'ice/glaciers',
    'water', 'waterways', 'ferry routes', 'airports', 'building footprints',
  ]},
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'secondary/tertiary roads', 'minor roads',
    'service roads/alleys/etc', 'paths/trails', 'rail', 'one way arrows',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: state', 'boundaries: disputed',
  ]},
  { name: 'Places & Labels', entries: [
    'points of interest', 'labels: parks & areas', 'airport labels',
    'cities', 'towns', 'villages',
    'labels: states', 'labels: country',
    'labels: water', 'labels: roads', 'highway shields',
  ]},
];

const BASIC_SECTIONS = [
  { name: 'Natural & Land', entries: [
    'agriculture', 'landuse: residential', 'national parks',
    'woodland', 'grassland', 'sand/beach', 'ice/glaciers',
    'water', 'waterways', 'building footprints', 'house numbers',
    'piers', 'bridges', 'airports',
  ]},
  { name: 'Roads & Transit', entries: [
    'highways', 'major roads', 'minor roads', 'paths/trails',
    'rail', 'transit rail', 'one way arrows',
  ]},
  { name: 'Boundaries', entries: [
    'boundaries: country', 'boundaries: sub-national',
  ]},
  { name: 'Places & Labels', entries: [
    'points of interest', 'airport labels', 'neighborhoods', 'cities',
    'labels: country', 'labels: major roads',
  ]},
];

export const STYLE_CONFIGS = [
  {
    test: style => 'protomaps' in (style.sources ?? {}),
    groups: PROTO_GROUPS,
    sections: PROTO_SECTIONS,
    hidden: [
      'background', 'earth', 'landcover',
      'address_label', 'water_label_ocean', 'earth_label_islands',
      'roads_pier',
    ],
    hiddenPrefixes: ['landuse_'],
  },
  {
    // Bright has natural_earth raster; use that to distinguish from Positron
    test: style => 'openmaptiles' in (style.sources ?? {}) &&
                   (style.layers ?? []).some(l => l.id === 'natural_earth'),
    groups: BRIGHT_GROUPS,
    sections: BRIGHT_SECTIONS,
    hidden: [
      'background', 'natural_earth', 'road_area_pattern',
      'landuse_residential', 'landuse_hospital', 'landuse_school',
      'highway-name-path',
    ],
    hiddenPrefixes: [],
  },
  {
    test: style => 'aws' in (style.sources ?? {}),
    groups: AWS_GROUPS,
    sections: AWS_SECTIONS,
    hidden: [
      'land', 'landuse_urban', 'landuse_misc', 'landuse_desert',
      'admin_label_continent', 'building_label_number', 'road_label_service',
      'water_pier-line', 'water_pier-polygon',
    ],
    hiddenPrefixes: [],
  },
  {
    // Klokantech Basic — identified by its name field; must be tested before
    // the generic openmaptiles catch-all (Positron) below.
    test: style => style.name === 'Klokantech Basic',
    groups: BASIC_GROUPS,
    sections: BASIC_SECTIONS,
    hidden: ['background'],
    hiddenPrefixes: [],
  },
  {
    // Newsprint: same layer structure as Positron, identified by its name field
    test: style => style.name === 'newsprint',
    groups: NEWSPRINT_GROUPS,
    sections: NEWSPRINT_SECTIONS,
    hidden: [
      'background',
      'landuse_residential',
      'road_area_pier', 'road_pier',
      'highway-name-path',
    ],
    hiddenPrefixes: [],
  },
  {
    test: style => 'openmaptiles' in (style.sources ?? {}),
    groups: POSITRON_GROUPS,
    sections: POSITRON_SECTIONS,
    hidden: [
      'background',
      'landuse_residential',
      'road_area_pier', 'road_pier',
      'highway-name-path',
    ],
    hiddenPrefixes: [],
  },
];
