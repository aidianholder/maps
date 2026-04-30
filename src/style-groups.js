/**
 * Layer grouping / renaming config per style.
 * Keyed by a source name that uniquely identifies the style at runtime.
 *
 * Each entry: { displayName: string, layers: string[] }
 * - Single-item arrays act as renames.
 * - Multi-item arrays combine all listed layers under one checkbox.
 * - Layers absent from this config appear unchanged with their raw ID.
 */

const PROTO_GROUPS = [
  // ── Renames ──────────────────────────────────────────────────────────────
  { displayName: 'parks',              layers: ['landuse_park'] },
  { displayName: 'building footprints', layers: ['buildings'] },
  { displayName: 'boundaries: country',  layers: ['boundaries_country'] },
  { displayName: 'labels: major roads',  layers: ['roads_labels_major'] },
  { displayName: 'one way arrows',       layers: ['roads_oneway'] },
  { displayName: 'labels: minor roads',  layers: ['roads_labels_minor'] },
  { displayName: 'neighborhoods',       layers: ['places_subplace'] },
  { displayName: 'labels: states',     layers: ['places_region'] },
  { displayName: 'labels: country',    layers: ['places_country'] },
  { displayName: 'labels: water',      layers: ['water_waterway_label', 'water_label_lakes'] },

  // ── Explicit groups ───────────────────────────────────────────────────────
  {
    displayName: 'airports',
    layers: ['landuse_aerodrome', 'roads_runway', 'roads_taxiway', 'landuse_runway'],
  },
  {
    displayName: 'water',
    layers: ['water', 'water_stream', 'water_river'],
  },

  // ── Road groups (line layers only) ────────────────────────────────────────
  {
    displayName: 'highways',
    layers: [
      'roads_highway_casing_early', 'roads_highway_casing_late',
      'roads_highway',
      'roads_tunnels_highway_casing', 'roads_tunnels_highway',
      'roads_bridges_highway_casing', 'roads_bridges_highway',
    ],
  },
  {
    displayName: 'major roads',
    layers: [
      'roads_major_casing_early', 'roads_major_casing_late',
      'roads_major',
      'roads_tunnels_major_casing', 'roads_tunnels_major',
      'roads_bridges_major_casing', 'roads_bridges_major',
    ],
  },
  {
    displayName: 'minor roads',
    layers: [
      'roads_minor_casing', 'roads_minor',
      'roads_tunnels_minor_casing', 'roads_tunnels_minor',
      'roads_bridges_minor_casing', 'roads_bridges_minor',
    ],
  },
  {
    displayName: 'ramps/interchanges',
    layers: [
      'roads_link_casing', 'roads_link',
      'roads_tunnels_link_casing', 'roads_tunnels_link',
      'roads_bridges_link_casing', 'roads_bridges_link',
    ],
  },
  {
    displayName: 'service roads/alleys/etc',
    layers: ['roads_minor_service_casing', 'roads_minor_service'],
  },
  {
    displayName: 'paths/trails',
    layers: [
      'roads_other',
      'roads_tunnels_other_casing', 'roads_tunnels_other',
      'roads_bridges_other_casing', 'roads_bridges_other',
    ],
  },
  {
    displayName: 'rail',
    layers: ['roads_rail'],
  },
  {
    displayName: 'pier roads',
    layers: ['roads_pier'],
  },
];

/**
 * Maps a source key (present in map.getStyle().sources) to its style config.
 * The panel checks each key in order; first match wins.
 *
 * Shape: { groups: GroupConfig[], hidden: string[] }
 *   hidden — layer IDs that should not appear in the panel at all.
 */
export const STYLE_GROUPS_BY_SOURCE = {
  protomaps: {
    groups: PROTO_GROUPS,
    hidden: ['background', 'earth', 'landcover', 'address_label', 'water_label_ocean', 'earth_label_islands', 'roads_pier'],
    hiddenPrefixes: ['landuse_'],
  },
};
