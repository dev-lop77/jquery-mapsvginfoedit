/**
 * jquery-mapsvginfoedit v0.6.1
 * Interactive SVG marker and area editor overlay for static images
 * (c) 2026 — MIT License
 */
(function($) {
  'use strict';

  var DEFAULTS = {
    // Zoom
    zoomMin: 0.5,
    zoomMax: 4,
    zoomStep: 0.25,
    zoomInitial: 1,
    pinchZoom: true,
    wheelZoom: true,
    wheelZoomStep: 0.1,
    // Markers
    markerSize: 20,
    markerColor: '#e74c3c',
    markerDraggable: true,
    // Areas
    areaMinSize: 20,
    areaFillColor: 'rgba(52,152,219,0.3)',
    areaStrokeColor: '#2980b9',
    areaStrokeWidth: 2,
    areaDraggable: true,
    areaResizable: true,
    // Defaults for new areas placed via popover
    areaDefaultWidth: 80,
    areaDefaultHeight: 60,
    // Toolbar — array of built-in type strings ('area','circle','square','pin')
    // and/or custom entries: {type:'custom', name, svg, anchorX, anchorY}.
    // null = show all 4 built-ins (default). Single entry skips the popover.
    toolbar: null,
    // Callbacks
    onClick: null,   // function(item)
    onAdd: null,     // function(item)
    onModify: null   // function(item)
  };

  var HANDLE_SIZE = 8;
  var DRAG_THRESHOLD = 5;
  var POPOVER_OFFSET_Y = 45;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var BUILTIN_TYPES = { circle: 1, square: 1, pin: 1, area: 1 };

  var BUILTIN_ICONS = {
    area:   '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="#333" stroke-width="2"/></svg>',
    circle: '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><circle cx="12" cy="12" r="8" fill="#333"/></svg>',
    square: '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><rect x="4" y="4" width="16" height="16" fill="#333"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" width="20" height="20" style="display:block"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#e74c3c"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>'
  };

  var BUILTIN_TITLES = {
    area: 'Rectangle area',
    circle: 'Circle marker',
    square: 'Square marker',
    pin: 'Pin marker'
  };

  // ── Helpers ──────────────────────────────────────────────

  function randomId() {
    return 'xxxxxxxx'.replace(/x/g, function() {
      return (Math.random() * 16 | 0).toString(16);
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /**
   * Parse an SVG string and return its root element. Uses the HTML parser
   * (via a temporary div) so user-supplied SVG without an explicit
   * xmlns="http://www.w3.org/2000/svg" still ends up in the SVG namespace.
   */
  function parseSvgString(str) {
    if (!str || typeof str !== 'string') return null;
    var temp = document.createElement('div');
    temp.innerHTML = str;
    return temp.firstElementChild;
  }

  /** Normalize the user's `toolbar` option into an array of validated entries. */
  function normalizeToolbar(raw) {
    if (raw === null || raw === undefined) {
      return [{ type: 'area' }, { type: 'circle' }, { type: 'square' }, { type: 'pin' }];
    }
    if (!$.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var e = raw[i];
      if (typeof e === 'string') {
        if (BUILTIN_TYPES[e]) out.push({ type: e });
      } else if (e && e.type === 'custom' && e.name && e.svg) {
        out.push({
          type: 'custom',
          name: e.name,
          svg: e.svg,
          anchorX: +e.anchorX || 0,
          anchorY: +e.anchorY || 0
        });
      }
    }
    return out;
  }

  // ── Constructor ──────────────────────────────────────────

  function MapSvgInfoEdit(container, options) {
    this.opts = $.extend({}, DEFAULTS, options);
    this.$container = $(container).addClass('msie-container');
    this._toolbar = normalizeToolbar(this.opts.toolbar);
    this._customByName = {};
    for (var ti = 0; ti < this._toolbar.length; ti++) {
      if (this._toolbar[ti].type === 'custom') {
        this._customByName[this._toolbar[ti].name] = this._toolbar[ti];
      }
    }
    this.items = [];       // {id, type, x, y, [w, h]}  image-native coords
    this.zoom = (this.opts.zoomInitial === 'fit') ? 1 : this.opts.zoomInitial;
    this.panX = 0;
    this.panY = 0;
    this._selected = null;
    this._panState = null;   // {startX, startY, origPanX, origPanY, moved}
    this._itemDrag = null;   // {item, draggable, startX, startY, origX, origY, moved}
    this._resize = null;
    this._imgW = 0;
    this._imgH = 0;
    this._popoverDismissedAt = 0;
    this._popoverCloseHandler = null;
    this._clickTimer = null;
    this._pointers = {};   // pointerId → {clientX, clientY}
    this._pinch = null;    // active pinch state
    this._init();
  }

  var proto = MapSvgInfoEdit.prototype;

  // ── Initialisation ───────────────────────────────────────

  proto._init = function() {
    var self = this;

    // Wrapper
    this.$wrap = $('<div class="msie-wrap"></div>').appendTo(this.$container);

    // Image
    var imgSrc = this.opts.src || this.$container.data('src') || '';
    this.$img = $('<img class="msie-img" draggable="false">').attr('src', imgSrc).appendTo(this.$wrap);

    // SVG overlay (created after image loads so we know dimensions)
    this.$img.on('load', function() {
      self._imgW = this.naturalWidth;
      self._imgH = this.naturalHeight;
      self._createSvg();
      if (self.opts.zoomInitial === 'fit') {
        self.zoomFit();
      } else {
        self._applyTransform();
      }
      self._renderAll();
    });

    // If image already cached
    if (this.$img[0].complete && this.$img[0].naturalWidth) {
      this.$img.trigger('load');
    }

    // Zoom buttons
    this.$zoomIn  = $('<button type="button" class="msie-zoom msie-zoom-in" title="Zoom in">+</button>').appendTo(this.$container);
    this.$zoomOut = $('<button type="button" class="msie-zoom msie-zoom-out" title="Zoom out">&minus;</button>').appendTo(this.$container);
    this.$zoomFit = $('<button type="button" class="msie-zoom msie-zoom-fit" title="Fit to width">&#8596;</button>').appendTo(this.$container);
    this.$zoomIn.on('click', function() { self.zoomBy(self.opts.zoomStep); });
    this.$zoomOut.on('click', function() { self.zoomBy(-self.opts.zoomStep); });
    this.$zoomFit.on('click', function() { self.zoomFit(); });

    // Pointer events on container for pan + interactions
    this._bindPointer();
  };

  proto._createSvg = function() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'msie-svg');
    svg.setAttribute('width', this._imgW);
    svg.setAttribute('height', this._imgH);
    svg.setAttribute('viewBox', '0 0 ' + this._imgW + ' ' + this._imgH);
    this.$wrap[0].appendChild(svg);
    this.svg = svg;

    // Groups: areas below markers
    this.gAreas = document.createElementNS(SVG_NS, 'g');
    this.gAreas.setAttribute('class', 'msie-g-areas');
    svg.appendChild(this.gAreas);

    this.gMarkers = document.createElementNS(SVG_NS, 'g');
    this.gMarkers.setAttribute('class', 'msie-g-markers');
    svg.appendChild(this.gMarkers);

    this.gHandles = document.createElementNS(SVG_NS, 'g');
    this.gHandles.setAttribute('class', 'msie-g-handles');
    svg.appendChild(this.gHandles);
  };

  // ── Coordinate conversion ────────────────────────────────

  /** Screen (client) coords → image-native coords */
  proto._toImage = function(clientX, clientY) {
    var rect = this.$wrap[0].getBoundingClientRect();
    var sx = (clientX - rect.left) / this.zoom - this.panX / this.zoom;
    var sy = (clientY - rect.top)  / this.zoom - this.panY / this.zoom;
    return { x: sx, y: sy };
  };

  // ── Zoom / Pan ───────────────────────────────────────────

  proto.zoomBy = function(delta) {
    this.zoom = clamp(this.zoom + delta, this.opts.zoomMin, this.opts.zoomMax);
    this._applyTransform();
  };

  proto.zoomTo = function(level) {
    this.zoom = clamp(level, this.opts.zoomMin, this.opts.zoomMax);
    this._applyTransform();
  };

  proto.zoomFit = function() {
    if (!this._imgW) return;
    var containerW = this.$container.width();
    this.zoom = clamp(containerW / this._imgW, this.opts.zoomMin, this.opts.zoomMax);
    this.panX = 0;
    this.panY = 0;
    this._applyTransform();
  };

  proto._applyTransform = function() {
    var t = 'translate(' + this.panX + 'px,' + this.panY + 'px) scale(' + this.zoom + ')';
    this.$wrap.css('transform', t);
  };

  // ── Event helpers ────────────────────────────────────────

  proto._fire = function(eventName, item) {
    var cb = this.opts[eventName];
    if (cb) cb(this._exportItem(item));
  };

  // ── Rendering ────────────────────────────────────────────

  proto._renderAll = function() {
    if (!this.svg) return;
    clearChildren(this.gAreas);
    clearChildren(this.gMarkers);
    clearChildren(this.gHandles);

    for (var i = 0; i < this.items.length; i++) {
      this._renderItem(this.items[i]);
    }
    if (this._selected) this._renderHandles(this._selected);
  };

  proto._renderItem = function(item) {
    var el;
    if (item.type === 'area') {
      el = this._createArea(item);
      this.gAreas.appendChild(el);
    } else {
      el = this._createMarker(item);
      if (!el) return; // unknown type guard
      this.gMarkers.appendChild(el);
    }
    item._el = el;
  };

  proto._createMarker = function(item) {
    var s = item.size || this.opts.markerSize;
    var color = item.color || this.opts.markerColor;
    var el;

    if (item.type === 'circle') {
      el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', item.x);
      el.setAttribute('cy', item.y);
      el.setAttribute('r', s / 2);
      el.setAttribute('fill', color);
    } else if (item.type === 'square') {
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', item.x - s / 2);
      el.setAttribute('y', item.y - s / 2);
      el.setAttribute('width', s);
      el.setAttribute('height', s);
      el.setAttribute('fill', color);
    } else if (item.type === 'pin') {
      // Google Maps-style pin — same path as toolbar icon
      var scale = s / 12;
      el = document.createElementNS(SVG_NS, 'g');
      el.setAttribute('transform',
        'translate(' + item.x + ',' + item.y + ') scale(' + scale + ')');
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M0,-20C-3.87,-20 -7,-16.87 -7,-13c0,5.25 7,13 7,13s7-7.75 7-13c0-3.87-3.13-7-7-7z');
      path.setAttribute('fill', color);
      el.appendChild(path);
      var dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', 0);
      dot.setAttribute('cy', -13);
      dot.setAttribute('r', 2.5);
      dot.setAttribute('fill', '#fff');
      el.appendChild(dot);
    } else if (item.type === 'custom') {
      el = this._createCustomMarkerEl(item);
      if (!el) return null;
    } else {
      return null; // unknown type — skip silently
    }

    el.setAttribute('class', 'msie-marker');
    el.setAttribute('data-id', item.id);
    el.style.cursor = 'pointer';
    return el;
  };

  proto._createCustomMarkerEl = function(item) {
    var entry = this._customByName[item.name];
    if (!entry) return null;
    var root = parseSvgString(entry.svg);
    if (!root) return null;

    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform',
      'translate(' + (item.x - entry.anchorX) + ',' + (item.y - entry.anchorY) + ')');

    // If the user supplied a <svg> wrapper, move its element children; otherwise
    // move the root itself. Snapshot first — appendChild mutates childNodes.
    var src = (root.tagName.toLowerCase() === 'svg')
      ? Array.prototype.slice.call(root.childNodes)
      : [root];
    for (var i = 0; i < src.length; i++) {
      if (src[i].nodeType === 1) g.appendChild(src[i]);
    }
    return g;
  };

  /** Update an existing SVG element's position in-place (used during drag) */
  proto._updateItemEl = function(item) {
    var el = item._el;
    if (!el) return;
    var s = item.size || this.opts.markerSize;

    if (item.type === 'circle') {
      el.setAttribute('cx', item.x);
      el.setAttribute('cy', item.y);
    } else if (item.type === 'square') {
      el.setAttribute('x', item.x - s / 2);
      el.setAttribute('y', item.y - s / 2);
    } else if (item.type === 'pin') {
      var scale = s / 12;
      el.setAttribute('transform',
        'translate(' + item.x + ',' + item.y + ') scale(' + scale + ')');
    } else if (item.type === 'custom') {
      var entry = this._customByName[item.name];
      if (entry) {
        el.setAttribute('transform',
          'translate(' + (item.x - entry.anchorX) + ',' + (item.y - entry.anchorY) + ')');
      }
    } else if (item.type === 'area') {
      el.setAttribute('x', item.x);
      el.setAttribute('y', item.y);
      el.setAttribute('width', item.w);
      el.setAttribute('height', item.h);
    }
  };

  proto._createArea = function(item) {
    var el = document.createElementNS(SVG_NS, 'rect');
    el.setAttribute('x', item.x);
    el.setAttribute('y', item.y);
    el.setAttribute('width', item.w);
    el.setAttribute('height', item.h);
    el.setAttribute('fill', item.fillColor || this.opts.areaFillColor);
    el.setAttribute('stroke', item.strokeColor || this.opts.areaStrokeColor);
    el.setAttribute('stroke-width', item.strokeWidth || this.opts.areaStrokeWidth);
    el.setAttribute('class', 'msie-area');
    el.setAttribute('data-id', item.id);
    el.style.cursor = 'pointer';
    return el;
  };

  // ── Resize handles for areas ─────────────────────────────

  proto._renderHandles = function(item) {
    clearChildren(this.gHandles);
    if (item.type !== 'area' || !this.opts.areaResizable) return;

    var hs = HANDLE_SIZE / this.zoom; // constant visual size
    var positions = this._handlePositions(item, hs);
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', p.x - hs / 2);
      rect.setAttribute('y', p.y - hs / 2);
      rect.setAttribute('width', hs);
      rect.setAttribute('height', hs);
      rect.setAttribute('fill', '#fff');
      rect.setAttribute('stroke', '#333');
      rect.setAttribute('stroke-width', 1 / this.zoom);
      rect.setAttribute('class', 'msie-handle');
      rect.setAttribute('data-handle', p.dir);
      rect.style.cursor = p.cursor;
      this.gHandles.appendChild(rect);
    }
  };

  proto._handlePositions = function(item, hs) {
    var x = item.x, y = item.y, w = item.w, h = item.h;
    return [
      { x: x,         y: y,         dir: 'nw', cursor: 'nwse-resize' },
      { x: x + w / 2, y: y,         dir: 'n',  cursor: 'ns-resize'   },
      { x: x + w,     y: y,         dir: 'ne', cursor: 'nesw-resize' },
      { x: x + w,     y: y + h / 2, dir: 'e',  cursor: 'ew-resize'   },
      { x: x + w,     y: y + h,     dir: 'se', cursor: 'nwse-resize' },
      { x: x + w / 2, y: y + h,     dir: 's',  cursor: 'ns-resize'   },
      { x: x,         y: y + h,     dir: 'sw', cursor: 'nesw-resize' },
      { x: x,         y: y + h / 2, dir: 'w',  cursor: 'ew-resize'   }
    ];
  };

  // ── Pointer events (mouse + touch) ──────────────────────

  proto._bindPointer = function() {
    var self = this;
    var pointerDown = null; // {clientX, clientY, time, target}
    var ns = '.msie'; // event namespace

    function pointerCount() {
      var n = 0;
      for (var k in self._pointers) {
        if (self._pointers.hasOwnProperty(k)) n++;
      }
      return n;
    }

    function pointerIds() {
      var ids = [];
      for (var k in self._pointers) {
        if (self._pointers.hasOwnProperty(k)) ids.push(k);
      }
      return ids;
    }

    function cancelSinglePointer() {
      pointerDown = null;
      self._panState = null;
      self._itemDrag = null;
      self._resize = null;
      clearTimeout(self._clickTimer);
    }

    function startPinch() {
      var ids = pointerIds();
      var p1 = self._pointers[ids[0]];
      var p2 = self._pointers[ids[1]];
      var midX = (p1.clientX + p2.clientX) / 2;
      var midY = (p1.clientY + p2.clientY) / 2;
      var dx = p2.clientX - p1.clientX;
      var dy = p2.clientY - p1.clientY;
      var cRect = self.$container[0].getBoundingClientRect();
      self._pinch = {
        ids: [ids[0], ids[1]],
        startDist: Math.sqrt(dx * dx + dy * dy) || 1,
        startZoom: self.zoom,
        anchorImgX: (midX - cRect.left - self.panX) / self.zoom,
        anchorImgY: (midY - cRect.top  - self.panY) / self.zoom
      };
    }

    this.$container.on('pointerdown' + ns, function(e) {
      // Ignore zoom buttons
      if ($(e.target).hasClass('msie-zoom')) return;

      e.preventDefault();
      self._pointers[e.pointerId] = { clientX: e.clientX, clientY: e.clientY };

      // If pinch is already active, additional pointers are ignored
      if (self._pinch) return;

      // Second pointer arrived → enter pinch mode, cancel any single-pointer action
      if (self.opts.pinchZoom && pointerCount() >= 2) {
        cancelSinglePointer();
        startPinch();
        return;
      }

      pointerDown = {
        clientX: e.clientX,
        clientY: e.clientY,
        time: Date.now(),
        target: e.target
      };

      // Check if it's a resize handle
      var handleDir = $(e.target).attr('data-handle');
      if (handleDir && self._selected && self._selected.type === 'area') {
        self._resize = {
          item: self._selected,
          dir: handleDir,
          startX: e.clientX,
          startY: e.clientY,
          origX: self._selected.x,
          origY: self._selected.y,
          origW: self._selected.w,
          origH: self._selected.h
        };
        return;
      }

      // Check if target is an item
      var $el = $(e.target).closest('.msie-marker, .msie-area');
      if ($el.length) {
        var itemId = $el.attr('data-id');
        var item = self._findItem(itemId);
        if (item) {
          var draggable = item.type === 'area' ? self.opts.areaDraggable : self.opts.markerDraggable;
          if (item.draggable !== undefined) draggable = item.draggable;
          self._itemDrag = {
            item: item,
            draggable: draggable,
            startX: e.clientX,
            startY: e.clientY,
            origX: item.x,
            origY: item.y,
            moved: false
          };
        }
        return;
      }

      // Otherwise: pan
      self._panState = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: self.panX,
        origPanY: self.panY,
        moved: false
      };
    });

    $(document).on('pointermove' + ns, function(e) {
      if (self._pointers[e.pointerId]) {
        self._pointers[e.pointerId].clientX = e.clientX;
        self._pointers[e.pointerId].clientY = e.clientY;
      }

      // Pinch update
      if (self._pinch) {
        e.preventDefault();
        var pp = self._pinch;
        var p1 = self._pointers[pp.ids[0]];
        var p2 = self._pointers[pp.ids[1]];
        if (!p1 || !p2) return;
        var pdx = p2.clientX - p1.clientX;
        var pdy = p2.clientY - p1.clientY;
        var curDist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (curDist < 1) return;
        var midX = (p1.clientX + p2.clientX) / 2;
        var midY = (p1.clientY + p2.clientY) / 2;
        var newZoom = clamp(pp.startZoom * curDist / pp.startDist,
                            self.opts.zoomMin, self.opts.zoomMax);
        var cRect = self.$container[0].getBoundingClientRect();
        self.zoom = newZoom;
        self.panX = (midX - cRect.left) - pp.anchorImgX * newZoom;
        self.panY = (midY - cRect.top)  - pp.anchorImgY * newZoom;
        self._applyTransform();
        if (self._selected) self._renderHandles(self._selected);
        return;
      }

      if (!pointerDown) return;

      // Resize
      if (self._resize) {
        e.preventDefault();
        self._doResize(e);
        return;
      }

      var dx, dy, dist;

      // Item drag
      if (self._itemDrag) {
        dx = e.clientX - self._itemDrag.startX;
        dy = e.clientY - self._itemDrag.startY;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= DRAG_THRESHOLD) self._itemDrag.moved = true;
        if (self._itemDrag.moved && self._itemDrag.draggable) {
          e.preventDefault();
          var item = self._itemDrag.item;
          item.x = self._itemDrag.origX + dx / self.zoom;
          item.y = self._itemDrag.origY + dy / self.zoom;
          self._updateItemEl(item);
          if (self._selected && self._selected.id === item.id) {
            self._renderHandles(item);
          }
        }
        return;
      }

      // Pan
      if (self._panState) {
        dx = e.clientX - self._panState.startX;
        dy = e.clientY - self._panState.startY;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= DRAG_THRESHOLD) self._panState.moved = true;
        if (self._panState.moved) {
          e.preventDefault();
          self.panX = self._panState.origPanX + dx;
          self.panY = self._panState.origPanY + dy;
          self._applyTransform();
        }
      }
    });

    $(document).on('pointerup' + ns + ' pointercancel' + ns, function(e) {
      delete self._pointers[e.pointerId];

      // Pinch end: clear and don't fall through to tap/pan logic.
      // If still 2 pointers down (e.g. 3-finger → 2-finger), restart pinch.
      if (self._pinch) {
        self._pinch = null;
        cancelSinglePointer();
        if (self.opts.pinchZoom && pointerCount() >= 2) {
          startPinch();
        }
        return;
      }

      if (!pointerDown) return;

      // Resize end
      if (self._resize) {
        var ri = self._resize.item;
        self._resize = null;
        self._renderAll();
        self._fire('onModify', ri);
        pointerDown = null;
        return;
      }

      // Item drag end
      if (self._itemDrag && self._itemDrag.moved) {
        var dragItem = self._itemDrag.item;
        self._itemDrag = null;
        pointerDown = null;
        self._fire('onModify', dragItem);
        return;
      }

      var wasPan = self._panState && self._panState.moved;
      self._panState = null;
      self._itemDrag = null;

      if (wasPan) {
        pointerDown = null;
        return;
      }

      // It was a click/tap (no drag)
      var $el = $(pointerDown.target).closest('.msie-marker, .msie-area');
      if ($el.length) {
        var itemId = $el.attr('data-id');
        var clickedItem = self._findItem(itemId);
        if (clickedItem) {
          if (clickedItem.type === 'area') {
            // Areas: delay onClick to allow dblclick to cancel it
            clearTimeout(self._clickTimer);
            self._clickTimer = setTimeout(function() {
              self._fire('onClick', clickedItem);
            }, 250);
          } else {
            // Markers: fire onClick immediately
            self._fire('onClick', clickedItem);
          }
        }
      } else if (self._selected) {
        // Click outside while in edit mode → exit edit mode
        self._selected = null;
        self._renderAll();
      } else if (!$(pointerDown.target).hasClass('msie-zoom') && !$(pointerDown.target).closest('.msie-popover').length) {
        // Click on empty space (not in edit mode) → add or show popover
        if (Date.now() - self._popoverDismissedAt > 200) {
          if (self._toolbar.length === 1) {
            self._addItem(self._toolbar[0], self._toImage(e.clientX, e.clientY));
          } else if (self._toolbar.length > 1) {
            self._showPopover(e.clientX, e.clientY);
          }
        }
      }

      pointerDown = null;
    });

    // Double-click/double-tap → enter edit mode (resize handles) for areas
    this.$container.on('dblclick' + ns, function(e) {
      clearTimeout(self._clickTimer); // cancel pending single-click
      var $el = $(e.target).closest('.msie-area');
      if (!$el.length) return;
      var itemId = $el.attr('data-id');
      var item = self._findItem(itemId);
      if (item && item.type === 'area') {
        self._selected = item;
        self._renderAll();
      }
    });

    // Mouse wheel zoom (zoom-to-cursor)
    this.$container.on('wheel' + ns, function(e) {
      if (!self.opts.wheelZoom) return;
      if ($(e.target).hasClass('msie-zoom')) return;
      var oe = e.originalEvent;
      if (!oe || !oe.deltaY) return;
      e.preventDefault();
      var step = self.opts.wheelZoomStep;
      var factor = oe.deltaY < 0 ? (1 + step) : (1 - step);
      var newZoom = clamp(self.zoom * factor, self.opts.zoomMin, self.opts.zoomMax);
      if (newZoom === self.zoom) return;
      var cRect = self.$container[0].getBoundingClientRect();
      var anchorImgX = (oe.clientX - cRect.left - self.panX) / self.zoom;
      var anchorImgY = (oe.clientY - cRect.top  - self.panY) / self.zoom;
      self.zoom = newZoom;
      self.panX = (oe.clientX - cRect.left) - anchorImgX * newZoom;
      self.panY = (oe.clientY - cRect.top)  - anchorImgY * newZoom;
      self._applyTransform();
      if (self._selected) self._renderHandles(self._selected);
    });

    // Prevent context menu on long press
    this.$container.on('contextmenu' + ns, function(e) { e.preventDefault(); });
  };

  // ── Resize logic ─────────────────────────────────────────

  proto._doResize = function(e) {
    var r = this._resize;
    var dx = (e.clientX - r.startX) / this.zoom;
    var dy = (e.clientY - r.startY) / this.zoom;
    var dir = r.dir;
    var min = this.opts.areaMinSize;

    var x = r.origX, y = r.origY, w = r.origW, h = r.origH;

    if (dir.indexOf('e') >= 0) w = Math.max(min, r.origW + dx);
    if (dir.indexOf('s') >= 0) h = Math.max(min, r.origH + dy);
    if (dir.indexOf('w') >= 0) {
      var newW = Math.max(min, r.origW - dx);
      x = r.origX + (r.origW - newW);
      w = newW;
    }
    if (dir.indexOf('n') >= 0) {
      var newH = Math.max(min, r.origH - dy);
      y = r.origY + (r.origH - newH);
      h = newH;
    }

    r.item.x = x;
    r.item.y = y;
    r.item.w = w;
    r.item.h = h;
    this._updateItemEl(r.item);
    this._renderHandles(r.item);
  };

  // ── Add-item popover ─────────────────────────────────────

  proto._showPopover = function(clientX, clientY) {
    this._hidePopover();
    if (!this.svg) return;
    if (!this._toolbar.length) return;

    var self = this;
    var pos = this._toImage(clientX, clientY);

    var $pop = $('<div class="msie-popover"></div>');
    for (var i = 0; i < this._toolbar.length; i++) {
      (function(entry) {
        var icon  = (entry.type === 'custom') ? entry.svg : BUILTIN_ICONS[entry.type];
        var title = (entry.type === 'custom') ? entry.name : BUILTIN_TITLES[entry.type];
        var $btn = $('<button type="button" class="msie-pop-btn"></button>')
          .attr('title', title)
          .html(icon);
        $btn.on('click', function(e) {
          e.stopPropagation();
          self._addItem(entry, pos);
          self._hidePopover();
        });
        $pop.append($btn);
      })(this._toolbar[i]);
    }

    // Position relative to container
    var cRect = this.$container[0].getBoundingClientRect();
    $pop.css({
      left: (clientX - cRect.left) + 'px',
      top:  (clientY - cRect.top - POPOVER_OFFSET_Y) + 'px'
    });
    this.$container.append($pop);
    this._$popover = $pop;

    // Close on outside click (delayed to avoid immediate trigger)
    this._popoverCloseHandler = function(ev) {
      if (!$(ev.target).closest('.msie-popover').length) {
        self._popoverDismissedAt = Date.now();
        self._hidePopover();
      }
    };
    setTimeout(function() {
      if (self._popoverCloseHandler) {
        $(document).one('pointerdown', self._popoverCloseHandler);
      }
    }, 50);
  };

  proto._hidePopover = function() {
    if (this._popoverCloseHandler) {
      $(document).off('pointerdown', this._popoverCloseHandler);
      this._popoverCloseHandler = null;
    }
    if (this._$popover) {
      this._$popover.remove();
      this._$popover = null;
    }
  };

  // ── Item CRUD ────────────────────────────────────────────

  proto._addItem = function(entry, pos) {
    var item = {
      id: randomId(),
      type: entry.type,
      x: pos.x,
      y: pos.y
    };
    if (entry.type === 'custom') {
      item.name = entry.name;
    } else if (entry.type === 'area') {
      item.w = this.opts.areaDefaultWidth;
      item.h = this.opts.areaDefaultHeight;
      // Center the area on the click point
      item.x -= item.w / 2;
      item.y -= item.h / 2;
    }
    this.items.push(item);
    this._selected = (entry.type === 'area') ? item : null;
    this._renderAll();
    this._fire('onAdd', item);
    return item;
  };

  proto._findItem = function(id) {
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) return this.items[i];
    }
    return null;
  };

  proto._exportItem = function(item) {
    var out = { id: item.id, type: item.type, x: item.x, y: item.y };
    if (item.type === 'area') { out.w = item.w; out.h = item.h; }
    if (item.type === 'custom') out.name = item.name;
    if (item.color) out.color = item.color;
    if (item.size) out.size = item.size;
    if (item.fillColor) out.fillColor = item.fillColor;
    if (item.strokeColor) out.strokeColor = item.strokeColor;
    if (item.draggable !== undefined) out.draggable = item.draggable;
    return out;
  };

  /** Validate a data object before adding/loading it as an item. */
  proto._isValidItemData = function(d) {
    if (!d || !d.type) return false;
    if (BUILTIN_TYPES[d.type]) return true;
    if (d.type === 'custom' && d.name && this._customByName[d.name]) return true;
    return false;
  };

  // ── Public API ───────────────────────────────────────────

  /** Get all items as plain data array */
  proto.getData = function() {
    var out = [];
    for (var i = 0; i < this.items.length; i++) {
      out.push(this._exportItem(this.items[i]));
    }
    return out;
  };

  /** Set items from data array (replaces all) */
  proto.setData = function(data) {
    this.items = [];
    this._selected = null;
    if ($.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        if (!this._isValidItemData(d)) continue;
        this.items.push($.extend({}, d));
      }
    }
    this._renderAll();
    return this;
  };

  /** Add a single item programmatically */
  proto.addItem = function(data) {
    if (!this._isValidItemData(data)) return null;
    var item = $.extend({ id: randomId() }, data);
    this.items.push(item);
    this._renderAll();
    return this._exportItem(item);
  };

  /** Remove an item by id */
  proto.removeItem = function(id) {
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        this.items.splice(i, 1);
        if (this._selected && this._selected.id === id) this._selected = null;
        this._renderAll();
        return true;
      }
    }
    return false;
  };

  /** Update an existing item's properties */
  proto.updateItem = function(id, props) {
    var item = this._findItem(id);
    if (!item) return null;
    var origType = item.type;
    $.extend(item, props);
    item.id = id;         // prevent id overwrite
    item.type = origType; // prevent type change
    this._renderAll();
    return this._exportItem(item);
  };

  /** Destroy the editor and clean up */
  proto.destroy = function() {
    clearTimeout(this._clickTimer);
    this._hidePopover();
    this._pointers = {};
    this._pinch = null;
    var ns = '.msie';
    this.$container.off(ns);
    $(document).off(ns);
    this.$container.removeClass('msie-container');
    this.$wrap.remove();
    this.$zoomIn.remove();
    this.$zoomOut.remove();
    this.$zoomFit.remove();
    this.$container.removeData('mapSvgInfoEdit');
  };

  // ── jQuery plugin ────────────────────────────────────────

  $.fn.mapSvgInfoEdit = function(optionsOrMethod) {
    var args = Array.prototype.slice.call(arguments, 1);

    // Method call
    if (typeof optionsOrMethod === 'string') {
      if (optionsOrMethod.charAt(0) === '_') return this; // block private methods
      var ret;
      this.each(function() {
        var inst = $(this).data('mapSvgInfoEdit');
        if (!inst) return;
        if (typeof inst[optionsOrMethod] === 'function') {
          ret = inst[optionsOrMethod].apply(inst, args);
        }
      });
      return ret !== undefined ? ret : this;
    }

    // Init
    return this.each(function() {
      if (!$(this).data('mapSvgInfoEdit')) {
        var inst = new MapSvgInfoEdit(this, optionsOrMethod);
        $(this).data('mapSvgInfoEdit', inst);
      }
    });
  };

})(jQuery);
