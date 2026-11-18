/* ERD 畫布：可平移、縮放、拖曳資料表的看板式檢視。不依賴任何外部函式庫。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  var W = 236;
  var HEAD = 40;
  var ROW = 28;
  var PAD_BOTTOM = 6;
  var MIN_SCALE = 0.15;
  var MAX_SCALE = 2.5;
  var COLORS = ['#FFE9A8', '#FFD0CC', '#CFE6FF', '#D4F2D0', '#E3D6FF', '#FFDFC2', '#CDF0EE', '#FAD9EC'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* 拖曳後的位置（同一題組的內嵌畫布與全螢幕畫布共用，重新整理後還原）。 */
  var positions = {};

  function resetPositions(group) {
    var p = {};
    group.tables.forEach(function (t) {
      var l = group.layout[t.name];
      p[t.name] = [l[0], l[1]];
    });
    positions[group.id] = p;
    return p;
  }

  function cardHeight(table) {
    return HEAD + ROW * table.columns.length + PAD_BOTTOM;
  }

  function rowY(table, colName) {
    var i = 0;
    table.columns.forEach(function (c, idx) {
      if (c.name === colName) i = idx;
    });
    return HEAD + ROW * i + ROW / 2;
  }

  /** 計算一條關聯線：從 one 端的主鍵列連到 many 端的外鍵列。 */
  function edgeGeometry(group, rel, pos) {
    var tables = {};
    group.tables.forEach(function (t) { tables[t.name] = t; });
    var one = tables[rel.one];
    var many = tables[rel.many];
    var pk = one.columns.filter(function (c) { return c.key === 'PK'; })[0];
    var op = pos[rel.one];
    var mp = pos[rel.many];
    var y1 = op[1] + rowY(one, pk.name);
    var y2 = mp[1] + rowY(many, rel.fk);
    var dxCenter = mp[0] - op[0];
    var x1, x2, c1, c2, dir1, dir2;
    if (Math.abs(dxCenter) < W * 0.6) {
      // 上下排列：兩端都從右側繞出去
      x1 = op[0] + W; x2 = mp[0] + W; dir1 = 1; dir2 = 1;
      var bulge = 50 + Math.min(60, Math.abs(y2 - y1) / 6);
      c1 = x1 + bulge; c2 = x2 + bulge;
    } else if (dxCenter > 0) {
      x1 = op[0] + W; x2 = mp[0]; dir1 = 1; dir2 = -1;
      var d = Math.max(40, (x2 - x1) / 2);
      c1 = x1 + d; c2 = x2 - d;
    } else {
      x1 = op[0]; x2 = mp[0] + W; dir1 = -1; dir2 = 1;
      var d2 = Math.max(40, (x1 - x2) / 2);
      c1 = x1 - d2; c2 = x2 + d2;
    }
    return {
      d: 'M' + x1 + ' ' + y1 + ' C' + c1 + ' ' + y1 + ' ' + c2 + ' ' + y2 + ' ' + x2 + ' ' + y2,
      x1: x1, y1: y1, x2: x2, y2: y2, dir1: dir1, dir2: dir2,
    };
  }

  function bounds(group, pos) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    group.tables.forEach(function (t) {
      var p = pos[t.name];
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0] + W); maxY = Math.max(maxY, p[1] + cardHeight(t));
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /**
   * opts.fullscreen：全螢幕模式（滾輪平移；否則滾輪留給頁面捲動）
   * opts.focus：要標示為重點的資料表名稱
   * opts.onFullscreen：按下「全螢幕」時呼叫
   */
  function mount(container, group, opts) {
    opts = opts || {};
    var pos = positions[group.id] || resetPositions(group);
    var scale = 1, tx = 0, ty = 0;
    var userMoved = false;

    container.textContent = '';
    container.classList.add('board-wrap');
    var viewport = el('div', 'board' + (opts.fullscreen ? ' board-full' : ''));
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'application');
    viewport.setAttribute('aria-label', '題組 ' + group.id + ' ERD 畫布。拖曳可移動，方向鍵平移，加減號縮放，0 適合畫面。');
    var world = el('div', 'board-world');
    var svg = svgEl('svg', { class: 'board-edges', width: 1, height: 1, 'aria-hidden': 'true' });
    world.appendChild(svg);
    viewport.appendChild(world);
    container.appendChild(viewport);

    var cards = {};
    group.tables.forEach(function (t, i) {
      var card = el('div', 'b-card' + (opts.focus && opts.focus.indexOf(t.name) !== -1 ? ' b-focus' : ''));
      card.dataset.table = t.name;
      card.style.width = W + 'px';
      var head = el('div', 'b-head');
      head.style.background = COLORS[i % COLORS.length];
      head.appendChild(el('strong', null, t.name));
      head.appendChild(el('span', null, t.label));
      card.appendChild(head);
      t.columns.forEach(function (c) {
        var row = el('div', 'b-row');
        row.title = c.desc;
        row.appendChild(el('span', 'b-col', c.name));
        row.appendChild(el('span', 'b-type', c.type));
        if (c.key) row.appendChild(el('span', 'b-key b-' + c.key.toLowerCase(), c.key));
        card.appendChild(row);
      });
      card.addEventListener('pointerenter', function () { highlight(t.name); });
      card.addEventListener('pointerleave', function () { highlight(null); });
      world.appendChild(card);
      cards[t.name] = card;
    });

    function placeCards() {
      group.tables.forEach(function (t) {
        cards[t.name].style.transform = 'translate(' + pos[t.name][0] + 'px,' + pos[t.name][1] + 'px)';
      });
    }

    var hl = null;
    function drawEdges() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      group.relations.forEach(function (r) {
        var g = edgeGeometry(group, r, pos);
        var on = hl && (r.one === hl || r.many === hl);
        var grp = svgEl('g', { class: 'b-edge' + (on ? ' on' : '') });
        grp.appendChild(svgEl('path', { d: g.d }));
        grp.appendChild(svgEl('circle', { cx: g.x1, cy: g.y1, r: 4 }));
        grp.appendChild(svgEl('circle', { cx: g.x2, cy: g.y2, r: 4 }));
        var t1 = svgEl('text', { x: g.x1 + g.dir1 * 12, y: g.y1 - 7, 'text-anchor': g.dir1 > 0 ? 'start' : 'end' });
        t1.textContent = r.optional ? '0..1' : '1';
        var t2 = svgEl('text', { x: g.x2 + g.dir2 * 12, y: g.y2 - 7, 'text-anchor': g.dir2 > 0 ? 'start' : 'end' });
        t2.textContent = 'N';
        grp.appendChild(t1);
        grp.appendChild(t2);
        svg.appendChild(grp);
      });
    }

    function highlight(name) {
      hl = name;
      world.classList.toggle('has-hl', !!name);
      group.tables.forEach(function (t) {
        var related = name && (t.name === name || group.relations.some(function (r) {
          return (r.one === name && r.many === t.name) || (r.many === name && r.one === t.name);
        }));
        cards[t.name].classList.toggle('b-related', !!related);
      });
      drawEdges();
    }

    function apply() {
      world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      var grid = 24 * scale;
      while (grid < 14) grid *= 2;
      viewport.style.backgroundSize = grid + 'px ' + grid + 'px';
      viewport.style.backgroundPosition = tx + 'px ' + ty + 'px';
      pct.textContent = Math.round(scale * 100) + '%';
    }

    function fit() {
      var w = viewport.clientWidth, h = viewport.clientHeight;
      if (!w || !h) return;
      var b = bounds(group, pos);
      var margin = 36;
      scale = Math.max(MIN_SCALE, Math.min(1.1, (w - margin * 2) / b.w, (h - margin * 2 - 40) / b.h));
      tx = (w - b.w * scale) / 2 - b.x * scale;
      ty = (h - 40 - b.h * scale) / 2 - b.y * scale;
      apply();
    }

    function zoomAt(cx, cy, factor) {
      var ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
      tx = cx - (cx - tx) * (ns / scale);
      ty = cy - (cy - ty) * (ns / scale);
      scale = ns;
      userMoved = true;
      apply();
    }

    function zoomCenter(factor) {
      zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, factor);
    }

    /* ----- 工具列 ----- */
    var bar = el('div', 'board-toolbar no-print');
    function tool(label, aria, fn) {
      var b = el('button', null, label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.title = aria;
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    }
    tool('−', '縮小', function () { zoomCenter(1 / 1.25); });
    var pct = tool('100%', '縮放至 100%', function () { zoomCenter(1 / scale); });
    pct.className = 'board-pct';
    tool('＋', '放大', function () { zoomCenter(1.25); });
    tool('適合畫面', '縮放至適合畫面', function () { userMoved = false; fit(); });
    tool('重設排列', '資料表回到預設位置', function () {
      pos = resetPositions(group);
      placeCards(); drawEdges(); userMoved = false; fit();
    });
    if (opts.onFullscreen) tool('全螢幕', '全螢幕查看 ERD', opts.onFullscreen);
    container.appendChild(bar);

    /* ----- 指標操作：拖曳背景平移、拖曳資料表移動、雙指縮放 ----- */
    var pointers = new Map();
    var dragCard = null;

    function local(e) {
      var r = viewport.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, local(e));
      try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* 指標已釋放 */ }
      if (pointers.size === 1) {
        var c = e.target.closest ? e.target.closest('.b-card') : null;
        dragCard = c ? c.dataset.table : null;
        if (c) world.appendChild(c); // 拖曳中的資料表移到最上層
      } else {
        dragCard = null;
      }
      viewport.classList.add('grabbing');
    });

    viewport.addEventListener('pointermove', function (e) {
      var prev = pointers.get(e.pointerId);
      if (!prev) return;
      var cur = local(e);
      if (pointers.size === 1) {
        var dx = cur.x - prev.x, dy = cur.y - prev.y;
        if (dragCard) {
          pos[dragCard][0] += dx / scale;
          pos[dragCard][1] += dy / scale;
          cards[dragCard].style.transform = 'translate(' + pos[dragCard][0] + 'px,' + pos[dragCard][1] + 'px)';
          drawEdges();
        } else {
          tx += dx; ty += dy;
          apply();
        }
        userMoved = true;
      } else if (pointers.size === 2) {
        var other;
        pointers.forEach(function (p, id) { if (id !== e.pointerId) other = p; });
        var d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        var d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        var m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        var m1 = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
        tx += m1.x - m0.x; ty += m1.y - m0.y;
        if (d0 > 0) zoomAt(m1.x, m1.y, d1 / d0);
        else apply();
      }
      pointers.set(e.pointerId, cur);
    });

    function release(e) {
      pointers.delete(e.pointerId);
      dragCard = null;
      if (pointers.size === 0) viewport.classList.remove('grabbing');
    }
    viewport.addEventListener('pointerup', release);
    viewport.addEventListener('pointercancel', release);

    viewport.addEventListener('wheel', function (e) {
      var p = local(e);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01));
      } else if (opts.fullscreen) {
        e.preventDefault();
        tx -= e.deltaX; ty -= e.deltaY;
        userMoved = true;
        apply();
      }
    }, { passive: false });

    viewport.addEventListener('keydown', function (e) {
      var step = 60;
      var handled = true;
      if (e.key === 'ArrowLeft') tx += step;
      else if (e.key === 'ArrowRight') tx -= step;
      else if (e.key === 'ArrowUp') ty += step;
      else if (e.key === 'ArrowDown') ty -= step;
      else if (e.key === '+' || e.key === '=') { zoomCenter(1.25); return e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoomCenter(1 / 1.25); return e.preventDefault(); }
      else if (e.key === '0') { userMoved = false; fit(); return e.preventDefault(); }
      else handled = false;
      if (handled) { e.preventDefault(); userMoved = true; apply(); }
    });

    var ro = null;
    if (root.ResizeObserver) {
      ro = new ResizeObserver(function () { if (!userMoved) fit(); });
      ro.observe(viewport);
    }

    placeCards();
    drawEdges();
    fit();

    return {
      /** 另一個畫布改過位置後，重新套用。 */
      refresh: function () {
        pos = positions[group.id] || resetPositions(group);
        placeCards(); drawEdges();
        if (!userMoved) fit();
      },
      destroy: function () {
        if (ro) ro.disconnect();
        container.textContent = '';
      },
    };
  }

  FDE.board = { mount: mount, edgeGeometry: edgeGeometry, cardHeight: cardHeight, CARD_WIDTH: W };
})(typeof window !== 'undefined' ? window : globalThis);
