# MapApp — User Guide

*A practical guide for journalists building maps for publication.*

---

## Getting oriented

When you open MapApp you'll see a map of Little Rock, Arkansas with a dashed rectangle in the center. That rectangle is your **export frame** — everything inside it is what gets printed or exported. The map itself fills the entire browser window, so you can pan and zoom freely without worrying about the frame moving.

Along the top of the map you'll find a row of tool buttons just to the right of the zoom controls. From left to right:

| Button | What it does |
|--------|-------------|
| 🗺 (grid icon) | Opens the **Layers** panel — show/hide individual map layers |
| **A** | Opens the **Labels** panel — add and style locator callouts |
| 🖼 (icons) | Opens the **Icons** panel — place small map symbols |
| ✏ (pencil, left side) | Opens the **Draw** panel — draw lines, shapes, and points |

The **geocoder search box** sits in the top-right corner. Type any address, city, or place name and the map flies to it.

The **export button** (printer icon, far top-right) opens the export settings.

The **style switcher** sits in the bottom-left corner.

---

## Step 1 — Set the export frame size

Before you start adding content, decide what size and shape your map needs to be. The dashed rectangle shows exactly what will appear in the final export.

### Dragging the corners

Grab any of the four white circles at the corners of the dashed rectangle and drag inward or outward. The label in the bottom center of the frame updates in real time showing the exact dimensions in millimetres.

- **Tall and narrow** works well for a sidebar map in a print layout
- **Wide and short** suits a full-width online graphic
- **Square** is a common choice for social media

### Using the export panel presets

Click the printer icon (top-right) to open the export panel. The **Page Size** dropdown lets you snap the frame to a standard paper size — A6, A5, A4, Letter, and so on. The **Orientation** toggle switches between portrait and landscape.

> **Example — Daily newspaper story:** Your print desk needs a map to run alongside a crime brief. They want it 3 columns wide. Choose *Custom* in the Page Size dropdown and drag the frame to the approximate column width, or ask your designer for the exact millimetre dimensions and drag to match.

> **Example — Online article:** For a web embed you mostly care about the shape. A landscape A6 (148 × 105 mm) is a good starting point for an inline map; a portrait A5 (148 × 210 mm) works well as a feature graphic that readers can scroll past.

---

## Step 2 — Choose a basemap style

The **style switcher** in the bottom-left corner offers five basemap options. Choose the one that fits your story's tone.

| Style | Character | Best used for |
|-------|-----------|---------------|
| **Newsprint** | Muted cream and grey tones, minimal colour | Print stories; anything that needs to feel editorial and restrained |
| **Bright** | Full colour, high contrast street map | Breaking news where readers need to orient quickly; neighbourhood-level detail |
| **Positron** | Light grey, very minimal | Data-heavy maps where your own markers need to stand out; online graphics |
| **AWS** | Satellite-imagery-derived style | Showing physical geography — flood plains, forests, terrain |
| **Proto** | Clean modern style, balanced detail | General-purpose online maps; good default when you're unsure |

> **Example — Neighbourhood shooting:** Start with **Bright**. Readers will recognise the streets and landmarks, helping them place the incident in a neighbourhood they know.

> **Example — Proposed development site:** Use **Positron** or **Newsprint**. The subdued background keeps attention on the polygon and label you'll add to show the site.

> **Example — Wildfire perimeter:** **AWS** gives a sense of the terrain — ridgelines, forests, clearings — that would be invisible on a street map.

---

## Step 3 — Clean up the map layers

Out of the box the basemap shows everything: minor roads, administrative boundaries, place labels at every level, and more. For publication you usually want less.

Click the **grid icon** (top-left of the toolbar) to open the **Layers** panel. You'll see a list of everything the current style draws, organised into sections like *Roads & Transit*, *Boundaries*, and *Places & Labels*.

Uncheck any layer to remove it from the map. The change is instant and reversible — recheck to bring it back.

**Common things to remove:**

- **Airport labels / highway shields** — visual clutter unless your story is specifically about transport
- **Administrative boundaries: disputed** — often irrelevant and politically sensitive
- **Points of interest** — the default POI layer adds hundreds of small symbols that compete with your own markers
- **Labels: minor roads** — at city or county scale these add noise without helping orientation

**Things to turn on:**

- **Terrain** *(Newsprint style only, off by default)* — adds hillshading that shows ridgelines, valleys, and elevation changes. Useful for flood, fire, landslide, or any story where physical geography matters. Find it at the top of the *Natural & Land* section.

> **Example — Tight neighbourhood map:** At a scale where you can see individual blocks, uncheck *Labels: minor roads*, *Highway shields*, and *Airport labels*. Leave *Labels: major roads* and *Neighborhoods* checked so readers can orient themselves.

> **Example — County-level overview:** At this scale, uncheck everything under *Roads & Transit* except *Highways*. Uncheck *Points of interest* and *Building footprints*. The result is a clean outline map that lets your drawn features speak.

---

## Step 4 — Navigate to your story location

Type the address, neighbourhood, city, or place name into the **search box** (top-right). The map flies to the result. From there, use the scroll wheel or the +/− buttons to zoom in or out, and click-and-drag to pan.

Position the map so that the key area of your story sits inside the export frame. You can also drag the export frame's corner handles to reframe without losing your zoom level.

---

## Step 5 — Add locator labels

Locator labels are callout boxes that point to a specific location on the map. They're the clearest way to say *"this is the place the story is about."*

Click the **A button** to open the Labels panel.

### Choosing a label style

The panel shows a grid of 15 label designs. They fall into a few families:

- **Dark box / White box** — solid filled callout with a pointing tail. The tail can point up or down, and the anchor point can be left, centre, or right. Use these for most stories — they're unambiguous and readable at small sizes.
- **Plain text** — no box, just bold text with a white halo. Good when you have multiple labels close together and boxes would crowd the map.
- **Line style** — text with a vertical rule dropping to a point. Works well for labelling buildings, intersections, or small features where a traditional callout box would cover too much.

Click any style thumbnail to place it in the centre of the map. Drag it to its exact location.

### Editing the label text

Double-click the label text to edit it. Press **Enter** for a new line if you need two lines of text (for example, *"Proposed" / "Development Site"*). Click anywhere else to finish editing.

### Styling the label

With a label selected, use the controls at the top of the Labels panel to change:

- **Font** — Inter is a clean modern choice for most maps; try a serif font if your publication uses one
- **Size** — smaller is usually better; 11–13 px works for most print maps, 13–15 px for online
- **Align** — L/C/R text alignment within the label box

### Moving and deleting labels

Drag the label body to reposition it. The small **✕** button that appears when you hover over or select a label deletes it.

---

### Label examples

> **Drive-by shooting on a residential street**
> Place a **dark box, tail-down** label at the intersection or address. Type *"Shooting scene"* or the street address. Keep it short — one line is usually enough. The dark box reads clearly even over busy street-map tiles.

> **Courthouse where a verdict was delivered**
> Place a **line-style** label pointing to the building. Type *"County Courthouse"*. The line style is less visually heavy than a filled box, which suits a named landmark that readers may already know.

> **Proposed housing development**
> You'll draw a polygon over the site (see Step 7). Add a **white box, tail-down** label just above the polygon. Two-line text works well here: first line *"Proposed"*, second line *"Oak Street Apartments"*. The white box distinguishes the label from the polygon fill colour.

> **Flood-prone neighbourhood in a climate story**
> Use **plain text** to label two or three neighbourhood names directly on the map. Plain text is less intrusive than boxed labels and lets you mark several areas without cluttering the frame.

---

## Step 6 — Place icons

Icons are small pictographic markers — an aeroplane for an airport, a hospital cross, a star for a point of interest. They add visual shorthand without requiring words.

Click the **icons button** (second from right in the toolbar) to open the Icons panel. Scroll the grid to find a suitable icon and click it to place it in the centre of the map. Drag it to position.

### Resizing icons

The **Size slider** at the top of the panel sets the size for any icon you place next. You can also resize an already-placed icon: click it to select it (a blue outline box appears), then drag the slider. Click anywhere on the map to deselect.

### Adding an infowindow

Every icon can carry a pop-up information panel that readers see when they click the icon in the **HTML export**. (Infowindows do not appear in PDF or image exports — they can't be clicked.)

Click an icon to select it (a blue outline appears). The **Infowindow** editor slides up at the bottom of the screen with three fields:

- **Title** — the headline, displayed in a larger bold font
- **Subhead** — a secondary line in a slightly smaller, muted style; good for a date, address, or one-line description
- **Text** — a longer body paragraph; can be several sentences

Below the fields, set the **font**, **size**, and **alignment** (L/C/R) for the infowindow text. When you're happy, click **enter** to save the content to that icon. Click **clear** to remove it.

An icon with no infowindow is still clickable in the HTML export — it just won't open a panel.

> **Example — Hospital closure:** Place the hospital icon, click it to select it, and fill in *Title:* "St. Vincent's Medical Center", *Subhead:* "Closing March 31", *Text:* "The only Level II trauma centre within 40 miles. Staff have been offered transfers to Baptist Health." Click **enter**. In the published HTML map, readers who tap the icon will see this context without it cluttering the printed version.

### Choosing the right icon

The panel uses the **Maki** icon set, the same set used by OpenStreetMap and many newsroom mapping tools. A few useful ones for journalism:

| Icon | Typical use |
|------|------------|
| ⚫ dot / circle | Generic location marker; drive-by shooting, crash scene, any incident |
| 🏥 hospital | Medical story; hospital closure, mass casualty event |
| ✈ aeroplane | Airport story; flight disruption, airport expansion |
| 🏛 building / town hall | Government beat; city hall, courthouse |
| ⚠ warning / danger | Hazard or risk zone — use sparingly |
| 🏠 home / residential | Housing story; eviction, affordable housing site |
| 🔥 fire station | Fire story |
| 🎓 school | Education story; school closure, shooting |
| 🌳 park | Parks and greenspace |

> **Example — Drive-by shooting:** Place a solid **dot** or **circle** icon at the shooting address. Keep the icon small (15–18 px). Add a dark-box locator label (Step 5) nearby with the street address or cross-street.

> **Example — Hospital closure:** Place the **hospital** icon on the building. Use a white-box label with the hospital name. Optionally draw a line or polygon (Step 7) to show the service area affected.

> **Example — School shooting:** Place the **school** icon. Add a label with the school name. At a tight zoom level, add a second label with a brief note like *"3 students injured, Nov. 14"* if the map will be used as a standalone graphic rather than alongside body text.

---

## Step 7 — Draw features

The Draw panel lets you add lines, shapes, and points directly onto the map. Use it to show areas, routes, or precise locations that no pre-existing map feature captures.

Click the **✏ pencil button** (left side of the map, below the zoom controls) to open the Draw panel.

### Drawing modes

| Button | Mode | How to use |
|--------|------|-----------|
| ● | **Point** | Click once to place a dot |
| ╱ | **Line** | Click to place each vertex; double-click to finish |
| ○ | **Circle** | Click and drag to set the radius |
| ⬡ | **Polygon** | Click to place each corner; double-click to close and finish |
| ↖ | **Select** | Click a drawn feature to select and edit it |

### Setting the style before you draw

Each mode shows style controls below the buttons. **Set the colour and weight before you start drawing** — the style is baked into the feature when you finish it, so each feature can have an independent style.

- **Point:** fill colour and dot size
- **Line:** colour and width
- **Circle / Polygon:** fill colour, fill opacity, border colour, border width

### Editing a drawn feature's style

After drawing, switch to **Select** mode (↖ button). Click any feature on the map — its style values load into the panel. Adjust the controls to change that specific feature's appearance. Other features on the map are not affected.

### Tips on opacity

For polygons, a fill opacity of **0.2–0.4** lets the map show through, so readers can still see streets and landmarks inside the area. An opacity of **1.0** creates a solid block — useful for a legend swatch but rarely for a map overlay.

For lines, thicker isn't always better. A **2–3 px** line is readable at most map scales. Go up to **4–6 px** only if the line needs to stand out over a busy basemap.

---

### Drawn feature examples

> **Proposed housing development site**
> Switch to **Polygon** mode. Set the fill colour to a light blue or yellow, fill opacity to **0.3**, border colour to a darker shade of the same colour, border width **2 px**. Click around the perimeter of the site — corners of the block, or the parcel boundary if you know it. Double-click to close. Then add a **Label** (Step 5) pointing into the shape. The semi-transparent polygon says *"this area"* clearly without obscuring the underlying street names.

> **Route of a police chase**
> Switch to **Line** mode. Set the colour to red, width to **3 px**. Click along the route the vehicle took, street by street. Double-click to finish. This is clearer than a series of arrows or a verbal description like "the chase travelled north on Main Street before turning east on 5th."

> **Evacuation zone in a flood or fire story**
> **Polygon**, fill colour orange, opacity **0.25**, border **2 px** in a darker orange. Trace the boundary of the zone. Add a plain-text label inside the area: *"Evacuation Zone A"*. If there are multiple zones, draw each as a separate polygon and give each one a different fill colour — change the style between draws.

> **Protest march route**
> **Line**, colour dark blue, width **4 px**. Trace the announced or actual march route. Add a dot (Point mode, same colour) at the start and end. Label the start *"Assembly point"* and the end *"Rally stage."*

> **Crime scene perimeter**
> **Polygon**, red fill, opacity **0.15**, red border **1.5 px**. Draw a rough outline of the police perimeter. Combine with a dot icon or a locator label at the precise incident address inside the zone.

> **Comparing two sites**
> Draw two polygons — one in blue for a current facility, one in green for the proposed replacement site. Each has its own independently set colour because you changed the style between drawing them. Add a label to each.

---

## Step 8 — Export your map

### PDF and image exports

Click the **printer icon** (top-right). In the export panel:

1. Confirm the **Page Size** (or leave it on Custom if you sized the frame by dragging)
2. Choose a **Format**: PDF for print, PNG or JPEG for digital
3. Set the **DPI**: use **150** for web graphics and email, **300** for print
4. Click **Generate** — the file downloads automatically

> **For print:** Use PDF at 300 DPI. Hand the PDF directly to your designer or drop it into InDesign. The export frame corresponds exactly to the artboard size.

> **For web/CMS:** Use PNG at 150 DPI. PNG preserves sharp edges on labels and icon symbols better than JPEG, which introduces compression artefacts on hard lines.

> **For breaking news where speed matters:** JPEG at 150 DPI produces a smaller file and uploads faster.

See Part 9 for important copyright notice for photo/pdf exports.

### Embeddable HTML map

The HTML export generates a fully self-contained interactive map that you can paste into a CMS or host on any web server.

In the export panel, choose **HTML** from the Format dropdown and click **Generate**. The downloaded `.html` file is a complete interactive MapLibre map. It:

- **Reflects your layer choices exactly** — any layers you've turned off in the Layers panel are absent from the exported map; layers you've turned on (including Terrain hillshade) are included
- Reproduces your labels as interactive popups
- Displays your icons and drawn features as map layers; icons with infowindow content open a slide-up panel when clicked
- Is centred and zoomed to match the export frame
- Has `width: 100%` so it fills whatever column or container it's placed in; the **height is fixed** to match the proportions of your export frame, so place it inside a container that controls the width

> **Tip — CMS embeds:** Most CMSes let you paste raw HTML into an article. Drop the file contents (or a hosted URL) into an HTML embed block. The map will size itself to the column width automatically. If it looks too tall or too short, adjust the export frame proportions before regenerating.

Drop the file into your CMS's HTML embed block, or send it to your web team to host at a URL.

---
## Step 9 — Copyright Notice

### PDF and image exports

If you use a pdf or image export you must add a line indicating the source of the map data.
The map tiles are courtesy OpenFreeMap and the OpenMapTiles data is copyright OpenStreetMap contributors.
I didn't hardcode it on the image/pdf to not obscure the map, but you must add a line below the map indicating the coopyright of the soure.
If you don't you're violating the law, but you're also a bad person who is screwing over people who generously shared their hard work with you.

### HTML Exports

The requisite copyright and courtesy is already included along the bottom of the map.

---

## Quick reference — what to use when

| Story situation | Recommended tools |
|-----------------|-------------------|
| Pinpointing a single address | Icon (dot) + dark-box locator label |
| Naming a neighbourhood or area | Plain-text label directly on the map |
| Showing a perimeter or zone | Polygon (semi-transparent fill) |
| Showing a route or journey | Line |
| Marking a named institution | Icon (appropriate type) + line-style label |
| Comparing two or more locations | Multiple icons or polygons, each in a different colour |
| Map for print | PDF, 300 DPI, A6 or custom to column width |
| Map for web CMS | PNG, 150 DPI, or HTML embed |
| Map for social media | PNG, 150 DPI, square or 4:5 aspect ratio |
| Busy or distracting background | Open Layers panel and uncheck POIs, minor labels, and boundaries |
| Map needs to feel neutral/editorial | Newsprint or Positron style |
| Readers need to recognise streets | Bright style |
