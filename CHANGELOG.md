# Changelog

## [0.6.2] — 2026-05-28

### Fixed
- New markers placed by tapping empty space were positioned incorrectly after any pinch-zoom, wheel-zoom or drag-pan. `_toImage()` used `$wrap.getBoundingClientRect()` (which already reflects the post-transform pan) and then subtracted `panX/panY` a second time, shifting the placement by `pan/zoom`. Now uses the untransformed `$container` rect with a single pan subtraction, matching the formula already used by the pinch and wheel handlers.

## [0.6.1] — 2026-05-27

### Fixed
- Custom SVG markers were invisible on the map when the user-supplied SVG string omitted `xmlns="http://www.w3.org/2000/svg"`. `parseSvgString()` now uses the HTML parser (via a temporary div) so children end up in the SVG namespace regardless of the xmlns declaration.

## [0.6.0] — 2026-05-27

### Added
- `toolbar` option to configure which marker types appear in the add-item popover; accepts an ordered array of built-in type strings (`'area'`, `'circle'`, `'square'`, `'pin'`) and/or custom entries
- Custom SVG markers via `{type:'custom', name, svg, anchorX, anchorY}` toolbar entries — raw SVG is rendered as both the toolbar icon and the marker on the map, with `anchorX`/`anchorY` aligning a point inside the SVG to the tap position
- Single-entry shortcut: when `toolbar` has exactly one entry, tapping empty space places that item directly without showing the popover
- Custom markers are draggable, exported by `getData()` (with `type:'custom'` and `name`), and re-rendered by `setData()`

## [0.5.0] — 2026-05-19

### Added
- Mouse wheel zoom with zoom-to-cursor anchoring (the image point under the cursor stays put)
- `wheelZoom` option (default `true`) to enable/disable the gesture
- `wheelZoomStep` option (default `0.1`) — fraction applied per wheel tick

## [0.4.0] — 2026-05-15

### Added
- Two-finger pinch-to-zoom on touch devices, anchored to the midpoint between fingers
- `pinchZoom` option (default `true`) to enable/disable the gesture

## [0.3.0] — 2026-03-23

### Changed
- Area edit mode (resize handles) now requires double-click/double-tap instead of single click
- Single click on any item fires `onClick` only — no visual state change
- Click outside handles exits edit mode without opening the add popover
- Markers fire `onClick` immediately; areas use 250ms debounce to distinguish click vs double-click
- `zoomInitial` option accepts `'fit'` to auto-fit image width on load

### Fixed
- Code quality pass: fixed event listener leak in `destroy()`, popover close handler leak, crash on unknown marker type, optimized drag rendering (in-place SVG updates), simplified transform (applied on wrapper), separated pan/drag state, timestamp-based popover debounce, private method guard in plugin bridge, type-change protection in `updateItem()`

## [0.2.0] — 2026-03-23

### Added
- Fit-to-width zoom button and `zoomFit()` public method

### Changed
- Renamed callbacks: `onAdded` → `onAdd`, `onModified` → `onModify`
- Popover icons replaced with inline SVGs for consistent centering
- Pin marker icon now uses a larger Google Maps-style design
- Floor plan labels moved to top-left corner of each room for readability

### Fixed
- Popover close-on-outside-click no longer immediately re-opens a new popover
- Square marker icon alignment in the add-item popover

## [0.1.0] — 2026-03-23

### Added
- Initial pre-release
- SVG overlay on static image with zoom and pan
- Marker shapes: circle, square, pin
- Rectangle areas with drag-move and resize handles
- Click-to-add popover (tap empty space to add items)
- Drag to move markers and areas
- Public API: `getData()`, `setData()`, `addItem()`, `removeItem()`, `updateItem()`, `destroy()`
- Event hooks: `onClick`, `onAdded`, `onModified`
- Zoom controls (external buttons)
- Mouse and touch support
- Configurable colors, sizes, draggable flag
- Companion CSS file
- Example/showcase with warehouse floor plan
