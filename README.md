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
| `type` | string | yes | `circle`, `square`, `pin`, or `area` |
| `x` | number | yes | X position (image-native px) |
| `y` | number | yes | Y position (image-native px) |
| `w` | number | areas only | Width |
| `h` | number | areas only | Height |
| `color` | string | no | Override marker color |
| `size` | number | no | Override marker size |
| `fillColor` | string | no | Override area fill |
| `strokeColor` | string | no | Override area stroke |
| `draggable` | bool | no | Override per-item draggable flag |

Coordinates are always in **image-native pixels** — the library handles zoom/pan translation internally.

## Interaction

- **Add**: click/tap empty space → popover with shape icons
- **Select**: click/tap an existing item → fires `onClick` (markers immediately, areas with 250ms debounce)
- **Move**: click + drag (mouse) or long-press + drag (touch), 5px threshold
- **Edit area**: double-click/double-tap an area → shows resize handles; click outside to exit edit mode
- **Pan**: drag on empty space
- **Zoom**: use the +/−/↔ buttons (top-right); ↔ fits image to container width
- **Remove**: via API only (`removeItem(id)`)

## Browser Support

Desktop and tablet browsers with jQuery 3.x. Touch and mouse events supported via Pointer Events.

## License

MIT
