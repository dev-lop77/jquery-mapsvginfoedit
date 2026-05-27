# jquery-mapsvginfoedit

Interactive SVG marker and area editor overlay for static images (warehouse layouts, factory floors, industrial site plans). Single jQuery plugin — no build step, no extra dependencies.

## Quick Start

```html
<link rel="stylesheet" href="jquery-mapsvginfoedit.css">

<div id="map" data-src="floorplan.png" style="width:800px;height:500px"></div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="jquery-mapsvginfoedit.js"></script>
<script>
  $('#map').mapSvgInfoEdit({
    onClick: function(item) { console.log('clicked', item); }
  });
</script>
```

## Initialization Options

| Option | Type | Default | Description |
|---|---|---|---|
| `src` | string | `data-src` attr | Image URL (can also be set via `data-src` on the container) |
| `zoomMin` | number | `0.5` | Minimum zoom level |
| `zoomMax` | number | `4` | Maximum zoom level |
| `zoomStep` | number | `0.25` | Zoom increment per click |
| `zoomInitial` | number\|`'fit'` | `1` | Starting zoom level (`'fit'` = fit image to container width) |
| `pinchZoom` | bool | `true` | Enable two-finger pinch-to-zoom on touch devices |
| `wheelZoom` | bool | `true` | Enable mouse wheel zoom (anchors on cursor) |
| `wheelZoomStep` | number | `0.1` | Fraction of zoom applied per wheel tick |
| `markerSize` | number | `20` | Default marker radius/size (px in image coords) |
| `markerColor` | string | `#e74c3c` | Default marker fill color |
| `markerDraggable` | bool | `true` | Allow dragging markers |
| `areaMinSize` | number | `20` | Minimum area width/height |
| `areaFillColor` | string | `rgba(52,152,219,0.3)` | Default area fill |
| `areaStrokeColor` | string | `#2980b9` | Default area stroke |
| `areaStrokeWidth` | number | `2` | Default area stroke width |
| `areaDraggable` | bool | `true` | Allow dragging areas |
| `areaResizable` | bool | `true` | Show resize handles on selected areas |
| `areaDefaultWidth` | number | `80` | Width of newly created areas |
| `areaDefaultHeight` | number | `60` | Height of newly created areas |
| `toolbar` | array\|null | `null` | Configures the add-item popover. `null` = show all 4 built-ins. See [Toolbar config](#toolbar-config) below. |

### Callbacks

| Callback | Signature | Fires when |
|---|---|---|
| `onClick` | `function(item)` | A marker or area is clicked/tapped |
| `onAdd` | `function(item)` | A new item is added via the popover |
| `onModify` | `function(item)` | An item is moved or resized |

## Methods

Call methods via the jQuery plugin:

```js
// Get all items
var data = $('#map').mapSvgInfoEdit('getData');

// Set items (replaces all)
$('#map').mapSvgInfoEdit('setData', [
  { id: 'm1', type: 'circle', x: 100, y: 200 },
  { id: 'a1', type: 'area', x: 50, y: 50, w: 120, h: 80 }
]);

// Add a single item
$('#map').mapSvgInfoEdit('addItem', { type: 'pin', x: 300, y: 150 });

// Remove by id
$('#map').mapSvgInfoEdit('removeItem', 'm1');

// Update item properties
$('#map').mapSvgInfoEdit('updateItem', 'm1', { color: '#27ae60' });

// Zoom
$('#map').mapSvgInfoEdit('zoomTo', 2);
$('#map').mapSvgInfoEdit('zoomBy', 0.5);
$('#map').mapSvgInfoEdit('zoomFit'); // fit image width to container

// Destroy
$('#map').mapSvgInfoEdit('destroy');
```

## Item Data Model

Each item is a plain object:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto-generated | Unique identifier |
| `type` | string | yes | `circle`, `square`, `pin`, `area`, or `custom` |
| `name` | string | custom only | Name of the custom toolbar entry this item refers to |
| `x` | number | yes | X position (image-native px) |
| `y` | number | yes | Y position (image-native px) |
| `w` | number | areas only | Width |
| `h` | number | areas only | Height |
| `color` | string | no | Override marker color (built-ins only) |
| `size` | number | no | Override marker size (built-ins only) |
| `fillColor` | string | no | Override area fill |
| `strokeColor` | string | no | Override area stroke |
| `draggable` | bool | no | Override per-item draggable flag |

Coordinates are always in **image-native pixels** — the library handles zoom/pan translation internally.

## Toolbar Config

The `toolbar` option controls which items the popover offers and in what order. It accepts an array whose entries are either built-in type strings or custom-marker objects.

```js
$('#map').mapSvgInfoEdit({
  toolbar: [
    'area',
    'circle',
    {
      type:    'custom',
      name:    'star',                // unique name (used in stored data)
      svg:     '<svg viewBox="-12 -12 24 24" width="24" height="24">' +
               '<polygon points="0,-10 2.9,-3.1 10,-3.1 4.1,1.4 6.2,9 0,4.7 -6.2,9 -4.1,1.4 -10,-3.1 -2.9,-3.1" fill="#f1c40f" stroke="#b9890b" stroke-width="1"/>' +
               '</svg>',
      anchorX: 0,                     // anchor coords inside the SVG —
      anchorY: 0                      // this point lands on the tap position
    }
  ]
});
```

Notes:
- **Order matters** — toolbar icons appear in the order listed.
- **Single entry** — if the array has exactly one entry, the popover is skipped and that type is placed immediately on tap.
- **SVG wrapper required** — supply a full `<svg>…</svg>` element. The wrapper's `width`/`height` size the toolbar icon; the marker on the map renders the wrapper's children translated so the anchor lands at the click point, so design your shape in the SVG's coordinate space.
- **Custom markers store `type:'custom'` and `name`** — `getData()` returns them with these fields, and `setData()` re-renders them by looking up `name` in the toolbar config (re-initialize with the same `toolbar` to round-trip).
- Custom markers ignore `markerColor`/`markerSize` — styling comes from the SVG itself.

## Interaction

- **Add**: click/tap empty space → popover with shape icons (or direct placement when the toolbar has a single entry)
- **Select**: click/tap an existing item → fires `onClick` (markers immediately, areas with 250ms debounce)
- **Move**: click + drag (mouse) or long-press + drag (touch), 5px threshold
- **Edit area**: double-click/double-tap an area → shows resize handles; click outside to exit edit mode
- **Pan**: drag on empty space
- **Zoom**: use the +/−/↔ buttons (top-right), mouse wheel (anchors on cursor), or two-finger pinch on touch devices; ↔ fits image to container width
- **Remove**: via API only (`removeItem(id)`)

## Browser Support

Desktop and tablet browsers with jQuery 3.x. Touch and mouse events supported via Pointer Events.

## License

MIT
