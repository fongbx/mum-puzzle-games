import {
  SIZE,
  anchorCovering,
  anyPieceFits,
  cellIndex,
  clearLines,
  clonePieces,
  dealPieces,
  emptyGrid,
  lineScore,
  pieceSpan,
  place,
  snapAnchor,
} from './blocks-core.js';
import { KEYS, bindContrast, readJson, writeJson } from './settings.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const boardEl = document.getElementById('board');
const trayEl = document.getElementById('tray');
const floatEl = document.getElementById('drag-float');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const undoBtn = document.getElementById('undo');
const restartBtn = document.getElementById('restart');
const modalEl = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalEn = document.getElementById('modal-en');
const modalActions = document.getElementById('modal-actions');
const modalCancel = document.getElementById('modal-cancel');
const modalOk = document.getElementById('modal-ok');

const cells = [];
const state = {
  grid: emptyGrid(),
  pieces: [],
  score: 0,
  best: 0,
  over: false,
  undo: null,
  selected: null,
  busy: false,
};

const drag = {
  index: -1,
  pointerId: null,
  startX: 0,
  startY: 0,
  moved: false,
  active: false,
};
let suppressClick = false;
let overTimer = 0;
let motionTimer = 0;

for (let i = 0; i < SIZE * SIZE; i++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bcell';
  btn.dataset.i = String(i);
  boardEl.appendChild(btn);
  cells.push(btn);
}

function say(text) {
  statusEl.textContent = text;
}

function paintPiece(container, cellsOfPiece, color, cellPx) {
  const span = pieceSpan(cellsOfPiece);
  container.style.gridTemplateColumns = 'repeat(' + span.cols + ', ' + cellPx + 'px)';
  container.style.gridTemplateRows = 'repeat(' + span.rows + ', ' + cellPx + 'px)';
  container.replaceChildren();
  for (let i = 0; i < cellsOfPiece.length; i++) {
    const pip = document.createElement('i');
    pip.className = 'pip c' + color;
    pip.style.gridRow = String(cellsOfPiece[i][0] + 1);
    pip.style.gridColumn = String(cellsOfPiece[i][1] + 1);
    pip.style.width = cellPx + 'px';
    pip.style.height = cellPx + 'px';
    container.appendChild(pip);
  }
  return span;
}

function paintBoard(extra) {
  const source = extra && extra.grid ? extra.grid : state.grid;
  const land = extra && extra.land;
  const clearing = extra && extra.clearing;
  for (let i = 0; i < cells.length; i++) {
    const value = source[i];
    const el = cells[i];
    el.className = 'bcell' + (value ? ' filled c' + value : '');
    if (land && land.has(i)) el.classList.add('land');
    if (clearing && clearing.has(i)) el.classList.add('clearing');
    const row = Math.floor(i / SIZE) + 1;
    const col = (i % SIZE) + 1;
    el.setAttribute('aria-label', '第' + row + '行第' + col + '列，' + (value ? '有方块' : '空'));
  }
}

function clearGhost() {
  for (let i = 0; i < cells.length; i++) {
    const el = cells[i];
    el.classList.remove('ghost', 'ghost-bad');
    if (!el.classList.contains('filled')) el.classList.remove('c1', 'c2', 'c3', 'c4', 'c5');
  }
}

function paintTray() {
  const slotWidth = trayEl.clientWidth > 0 ? (trayEl.clientWidth - 16) / 3 : 100;
  trayEl.replaceChildren();
  for (let i = 0; i < state.pieces.length; i++) {
    const piece = state.pieces[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.dataset.index = String(i);
    btn.setAttribute('aria-pressed', state.selected === i ? 'true' : 'false');
    if (piece.used) {
      btn.disabled = true;
      btn.classList.add('used');
      btn.setAttribute('aria-label', '这个方块已经放下了');
    } else {
      const span = pieceSpan(piece.cells);
      const cellPx = Math.max(16, Math.min(36, Math.floor((slotWidth - 10 - (span.cols - 1) * 3) / span.cols)));
      btn.setAttribute('aria-label', '方块 ' + (i + 1) + '，' + piece.cells.length + ' 格');
      if (state.selected === i) btn.classList.add('selected');
      const mini = document.createElement('span');
      mini.className = 'mini';
      paintPiece(mini, piece.cells, piece.color, cellPx);
      btn.appendChild(mini);
    }
    trayEl.appendChild(btn);
  }
}

function paintScores() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  undoBtn.disabled = !state.undo || state.busy;
}

function render(extra) {
  paintBoard(extra);
  paintTray();
  paintScores();
}

function snapshot() {
  return {
    grid: state.grid.slice(),
    pieces: clonePieces(state.pieces),
    score: state.score,
    over: state.over,
  };
}

function persist() {
  writeJson(KEYS.blocks, {
    v: 1,
    grid: state.grid,
    pieces: state.pieces,
    score: state.score,
    best: state.best,
    over: state.over,
    undo: state.undo,
  });
}

function validPieces(pieces) {
  if (!Array.isArray(pieces) || pieces.length !== 3) return false;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece || !Array.isArray(piece.cells) || piece.cells.length < 1) return false;
    if (piece.color < 1 || piece.color > 5) return false;
    for (let k = 0; k < piece.cells.length; k++) {
      const pair = piece.cells[k];
      if (!pair || pair.length !== 2) return false;
    }
  }
  return true;
}

function validGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE * SIZE) return false;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] < 0 || grid[i] > 5) return false;
  }
  return true;
}

function closeModal() {
  modalEl.hidden = true;
  modalCancel.onclick = null;
  modalOk.onclick = null;
}

function openModal(opts) {
  modalTitle.textContent = opts.title;
  modalBody.textContent = opts.body;
  modalEn.textContent = opts.en || '';
  modalCancel.hidden = !opts.cancel;
  modalCancel.textContent = opts.cancel || '';
  modalOk.textContent = opts.ok;
  modalActions.classList.toggle('single', !opts.cancel);
  modalCancel.onclick = function () {
    closeModal();
    if (opts.onCancel) opts.onCancel();
  };
  modalOk.onclick = function () {
    closeModal();
    if (opts.onOk) opts.onOk();
  };
  modalEl.hidden = false;
  modalOk.focus();
}

function clearMessage(lineCount) {
  if (lineCount <= 0) return '放好了';
  if (lineCount === 1) return '消掉了一条';
  return '一次消掉 ' + lineCount + ' 条';
}

function dealPlayable() {
  let pieces = dealPieces(Math.random);
  for (let i = 0; i < 12; i++) {
    if (anyPieceFits(state.grid, pieces)) return pieces;
    pieces = dealPieces(Math.random);
  }
  return pieces;
}

function showOver() {
  openModal({
    title: '没有空位了',
    body: '分数 ' + state.score + ' · 最高 ' + state.best,
    en: 'No room left. Score ' + state.score + ' · Best ' + state.best,
    cancel: state.undo ? '撤销' : '',
    ok: '再玩一局',
    onCancel: function () { undo(); },
    onOk: function () { startNew(); },
  });
}

function prefersStill() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stopMotion() {
  window.clearTimeout(motionTimer);
  window.clearTimeout(overTimer);
  state.busy = false;
  hideFloat();
}

function freshCells(piece, row, col) {
  const marks = new Set();
  for (let i = 0; i < piece.cells.length; i++) {
    marks.add(cellIndex(row + piece.cells[i][0], col + piece.cells[i][1]));
  }
  return marks;
}

function afterMove() {
  state.selected = null;
  state.over = !anyPieceFits(state.grid, state.pieces);
  if (state.score > state.best) state.best = state.score;
  persist();
  paintScores();
}

function showOverSoon() {
  window.clearTimeout(overTimer);
  if (!state.over) return;
  overTimer = window.setTimeout(showOver, prefersStill() ? 0 : 280);
}

function commit(index, row, col) {
  if (state.over || state.busy) return false;
  const piece = state.pieces[index];
  if (!piece || piece.used) return false;
  const placed = place(state.grid, piece.cells, row, col, piece.color);
  if (!placed) {
    say('这里放不下');
    return false;
  }
  state.undo = snapshot();
  const cleared = clearLines(placed);
  const lines = cleared.rows.length + cleared.cols.length;
  const fresh = freshCells(piece, row, col);
  const clearing = new Set();
  if (lines) {
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (placed[i] && !cleared.grid[i]) clearing.add(i);
    }
  }
  state.grid = cleared.grid;
  piece.used = true;
  state.score += piece.cells.length + lineScore(lines);
  if (state.pieces.every(function (item) { return item.used; })) {
    state.pieces = dealPlayable();
  }
  afterMove();
  say(state.over && !lines ? '没有空位了' : clearMessage(lines));
  paintTray();
  const landed = new Set();
  fresh.forEach(function (i) {
    if (!clearing.has(i)) landed.add(i);
  });
  if (lines && !prefersStill()) {
    state.busy = true;
    paintBoard({ grid: placed, clearing: clearing, land: landed });
    paintScores();
    motionTimer = window.setTimeout(function () {
      state.busy = false;
      render();
      showOverSoon();
    }, 360);
  } else {
    render({ land: landed });
    showOverSoon();
  }
  return true;
}

function undo() {
  if (!state.undo || state.busy) return;
  stopMotion();
  const prev = state.undo;
  state.grid = prev.grid.slice();
  state.pieces = clonePieces(prev.pieces);
  state.score = prev.score;
  state.over = false;
  state.undo = null;
  state.selected = null;
  closeModal();
  say('已经撤销');
  persist();
  render();
}

function startNew() {
  stopMotion();
  closeModal();
  state.grid = emptyGrid();
  state.pieces = dealPlayable();
  state.score = 0;
  state.over = false;
  state.undo = null;
  state.selected = null;
  say('按住方块，拖到棋盘上');
  persist();
  render();
}

function askRestart() {
  if (state.over) {
    startNew();
    return;
  }
  if (state.score === 0 && state.grid.every(function (n) { return !n; })) {
    startNew();
    return;
  }
  openModal({
    title: '重新开始？',
    body: '这一局的分数会清掉。最高分还在。',
    en: 'This round’s score will reset. Your best stays.',
    cancel: '再想想',
    ok: '重新开始',
    onOk: function () { startNew(); },
  });
}

function selectPiece(index) {
  const piece = state.pieces[index];
  if (!piece || piece.used || state.over || state.busy) return;
  state.selected = index;
  say('再点棋盘上的一格');
  paintTray();
}

function boardMetrics() {
  const origin = cells[0].getBoundingClientRect();
  const across = cells[1].getBoundingClientRect();
  const down = cells[SIZE].getBoundingClientRect();
  return {
    originX: origin.left,
    originY: origin.top,
    stepX: across.left - origin.left,
    stepY: down.top - origin.top,
    cell: origin.width,
  };
}

function showGhost(row, col, cellsOfPiece, color) {
  clearGhost();
  for (let i = 0; i < cellsOfPiece.length; i++) {
    const r = row + cellsOfPiece[i][0];
    const c = col + cellsOfPiece[i][1];
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
    const el = cells[cellIndex(r, c)];
    el.classList.add('ghost', 'c' + color);
  }
}

function hideFloat() {
  floatEl.hidden = true;
  floatEl.classList.remove('settling');
  floatEl.replaceChildren();
  floatEl.style.transform = '';
  clearGhost();
  if (drag.slot) drag.slot.classList.remove('lifting');
  document.documentElement.classList.remove('is-dragging');
  drag.active = false;
  drag.index = -1;
  drag.snapped = null;
  drag.slot = null;
}

function floatBox(span, cell) {
  const gap = 3;
  return {
    width: span.cols * cell + (span.cols - 1) * gap,
    height: span.rows * cell + (span.rows - 1) * gap,
  };
}

function moveFloat(clientX, clientY, scale) {
  const box = floatBox(drag.span, drag.metrics.cell);
  const lift = 58;
  const x = Math.round(clientX - box.width / 2);
  const y = Math.round(clientY - box.height - lift);
  floatEl.style.width = box.width + 'px';
  floatEl.style.height = box.height + 'px';
  floatEl.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
}

function aimAnchor(clientX, clientY) {
  const metrics = drag.metrics;
  const col = (clientX - metrics.originX - metrics.cell / 2) / metrics.stepX;
  const row = (clientY - metrics.originY - metrics.cell / 2) / metrics.stepY;
  return {
    row: row - (drag.span.rows - 1) / 2,
    col: col - (drag.span.cols - 1) / 2,
  };
}

function followFinger(clientX, clientY) {
  const piece = state.pieces[drag.index];
  if (!piece || !drag.metrics || !(drag.metrics.stepX > 0)) return;
  moveFloat(clientX, clientY, 1.04);
  const aim = aimAnchor(clientX, clientY);
  const snapped = snapAnchor(state.grid, piece.cells, aim.row, aim.col);
  drag.snapped = snapped;
  if (snapped) showGhost(snapped.row, snapped.col, piece.cells, piece.color);
  else clearGhost();
}

function slideFloatTo(x, y, scale, ms, done) {
  if (prefersStill()) {
    done();
    return;
  }
  floatEl.classList.add('settling');
  void floatEl.offsetWidth;
  floatEl.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0) scale(' + scale + ')';
  motionTimer = window.setTimeout(done, ms);
}

function springHome() {
  drag.active = false;
  const slot = drag.slot;
  const rect = slot ? slot.getBoundingClientRect() : null;
  const box = floatBox(drag.span, drag.metrics.cell);
  state.busy = true;
  if (!rect) {
    hideFloat();
    state.busy = false;
    return;
  }
  slideFloatTo(
    rect.left + (rect.width - box.width) / 2,
    rect.top + (rect.height - box.height) / 2,
    0.94,
    280,
    function () {
      hideFloat();
      state.busy = false;
      paintScores();
    }
  );
}

function settleOntoBoard(index, snapped) {
  drag.active = false;
  const metrics = drag.metrics;
  state.busy = true;
  slideFloatTo(
    metrics.originX + snapped.col * metrics.stepX,
    metrics.originY + snapped.row * metrics.stepY,
    1,
    180,
    function () {
      hideFloat();
      state.busy = false;
      commit(index, snapped.row, snapped.col);
    }
  );
}

boardEl.addEventListener('click', function (event) {
  const btn = event.target.closest('.bcell');
  if (!btn || state.over || state.busy || !modalEl.hidden) return;
  if (state.selected == null) {
    say('先点下面的一个方块');
    return;
  }
  const index = Number(btn.dataset.i);
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const piece = state.pieces[state.selected];
  const spot = piece && anchorCovering(state.grid, piece.cells, row, col);
  if (!spot) {
    say('这里放不下');
    return;
  }
  commit(state.selected, spot.row, spot.col);
});

trayEl.addEventListener('pointerdown', function (event) {
  if (!modalEl.hidden || state.over || state.busy) return;
  const btn = event.target.closest('.slot');
  if (!btn || btn.disabled) return;
  suppressClick = false;
  window.clearTimeout(motionTimer);
  hideFloat();
  const index = Number(btn.dataset.index);
  const piece = state.pieces[index];
  if (!piece || piece.used) return;
  const metrics = boardMetrics();
  if (!(metrics.cell > 0) || !(metrics.stepX > 0)) return;
  drag.index = index;
  drag.pointerId = event.pointerId;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.moved = false;
  drag.active = true;
  drag.snapped = null;
  drag.slot = btn;
  drag.metrics = metrics;
  drag.span = pieceSpan(piece.cells);
  btn.setPointerCapture(event.pointerId);
});

window.addEventListener('pointermove', function (event) {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && dx * dx + dy * dy < 10 * 10) return;
  if (!drag.moved) {
    drag.moved = true;
    document.documentElement.classList.add('is-dragging');
    drag.slot.classList.add('lifting');
    trayEl.querySelectorAll('.slot.selected').forEach(function (el) {
      el.classList.remove('selected');
      el.setAttribute('aria-pressed', 'false');
    });
    state.selected = null;
    const piece = state.pieces[drag.index];
    floatEl.classList.remove('settling');
    floatEl.hidden = false;
    paintPiece(floatEl, piece.cells, piece.color, drag.metrics.cell);
  }
  if (event.cancelable) event.preventDefault();
  followFinger(event.clientX, event.clientY);
}, { passive: false });

function endDrag(event) {
  if (!drag.active || (event && event.pointerId !== drag.pointerId)) return;
  const moved = drag.moved;
  const index = drag.index;
  const snapped = drag.snapped;
  if (!moved) {
    hideFloat();
    return;
  }
  suppressClick = true;
  if (snapped) settleOntoBoard(index, snapped);
  else {
    say('这里放不下');
    springHome();
  }
}

window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', function () {
  if (!drag.active) return;
  if (drag.moved) {
    suppressClick = true;
    say('这里放不下');
    springHome();
  } else hideFloat();
});

trayEl.addEventListener('click', function (event) {
  if (suppressClick) {
    suppressClick = false;
    event.preventDefault();
    return;
  }
  const btn = event.target.closest('.slot');
  if (!btn || btn.disabled) return;
  selectPiece(Number(btn.dataset.index));
});

undoBtn.addEventListener('click', function () { undo(); });
restartBtn.addEventListener('click', function () { askRestart(); });

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && !modalEl.hidden && !state.over) closeModal();
});

function load() {
  const saved = readJson(KEYS.blocks, null);
  state.best = saved && saved.best > 0 ? saved.best | 0 : 0;
  if (saved && saved.v === 1 && validGrid(saved.grid) && validPieces(saved.pieces)) {
    state.grid = saved.grid.slice();
    state.pieces = clonePieces(saved.pieces);
    state.score = saved.score | 0;
    state.undo = saved.undo && validGrid(saved.undo.grid) && validPieces(saved.undo.pieces) ? {
      grid: saved.undo.grid.slice(),
      pieces: clonePieces(saved.undo.pieces),
      score: saved.undo.score | 0,
      over: false,
    } : null;
    state.over = !!saved.over || !anyPieceFits(state.grid, state.pieces);
    if (state.score > state.best) state.best = state.score;
    say(state.over ? '没有空位了' : (state.score > 0 ? '继续上次的一局' : '按住方块，拖到棋盘上'));
    render();
    if (state.over) showOver();
    return;
  }
  state.grid = emptyGrid();
  state.pieces = dealPlayable();
  state.score = 0;
  state.over = false;
  state.undo = null;
  say('按住方块，拖到棋盘上');
  persist();
  render();
}

load();
