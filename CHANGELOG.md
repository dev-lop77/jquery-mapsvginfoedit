# Changelog

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
