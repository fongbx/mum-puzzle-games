import {
  SIZE,
  anyPieceFits,
  canPlace,
  cellIndex,
  clearLines,
  clonePieces,
  dealPieces,
  emptyGrid,
  lineScore,
  place,
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

function pieceSpan(cellsOfPiece) {
  let rows = 1;
  let cols = 1;
  for (let i = 0; i < cellsOfPiece.length; i++) {
    rows = Math.max(rows, cellsOfPiece[i][0] + 1);
    cols = Math.max(cols, cellsOfPiece[i][1] + 1);
  }
  return { rows: rows, cols: cols };
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

function paintBoard(popSet) {
  for (let i = 0; i < cells.length; i++) {
    const value = state.grid[i];
    const el = cells[i];
    el.className = 'bcell' + (value ? ' filled c' + value : '');
    if (popSet && popSet.has(i)) el.classList.add('pop');
    const row = Math.floor(i / SIZE) + 1;
    const col = (i % SIZE) + 1;
    el.setAttribute('aria-label', '第' + row + '行第' + col + '列，' + (value ? '有方块' : '空'));
  }
}

function clearGhost() {
  for (let i = 0; i < cells.length; i++) {
    cells[i].classList.remove('ghost', 'ghost-bad');
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
      const cellPx = Math.max(11, Math.min(30, Math.floor((slotWidth - 20 - (span.cols - 1) * 3) / span.cols)));
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

function render(popSet) {
  paintBoard(popSet);
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

function finishMove(popSet) {
  state.selected = null;
  state.over = !anyPieceFits(state.grid, state.pieces);
  if (state.score > state.best) state.best = state.score;
  persist();
  render(popSet);
  if (state.over) {
    say('没有空位了');
    window.clearTimeout(overTimer);
    overTimer = window.setTimeout(showOver, popSet ? 220 : 0);
  }
}

function commit(index, row, col) {
  if (state.over || state.busy) return false;
  const piece = state.pieces[index];
  if (!piece || piece.used) return false;
  if (!canPlace(state.grid, piece.cells, row, col)) {
    say('这里放不下');
    return false;
  }
  state.undo = snapshot();
  const placed = place(state.grid, piece.cells, row, col, piece.color);
  const cleared = clearLines(placed);
  const lines = cleared.rows.length + cleared.cols.length;
  const pop = new Set();
  if (lines) {
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (placed[i] && !cleared.grid[i]) pop.add(i);
    }
  }
  state.grid = cleared.grid;
  piece.used = true;
  state.score += piece.cells.length + lineScore(lines);
  if (state.pieces.every(function (item) { return item.used; })) {
    state.pieces = dealPlayable();
  }
  say(clearMessage(lines));
  finishMove(lines ? pop : null);
  return true;
}

function undo() {
  if (!state.undo || state.busy) return;
  window.clearTimeout(overTimer);
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
  window.clearTimeout(overTimer);
  closeModal();
  state.grid = emptyGrid();
  state.pieces = dealPlayable();
  state.score = 0;
  state.over = false;
  state.undo = null;
  state.selected = null;
  say('点一个方块，再点棋盘');
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

function showGhost(row, col, cellsOfPiece, ok) {
  clearGhost();
  for (let i = 0; i < cellsOfPiece.length; i++) {
    const r = row + cellsOfPiece[i][0];
    const c = col + cellsOfPiece[i][1];
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
    cells[cellIndex(r, c)].classList.add(ok ? 'ghost' : 'ghost-bad');
  }
}

function hideFloat() {
  floatEl.hidden = true;
  floatEl.replaceChildren();
  clearGhost();
  drag.active = false;
  drag.index = -1;
}

function moveFloat(clientX, clientY) {
  const piece = state.pieces[drag.index];
  if (!piece) return;
  const metrics = boardMetrics();
  if (!(metrics.cell > 0) || !(metrics.stepX > 0)) return;
  const span = paintPiece(floatEl, piece.cells, piece.color, metrics.cell);
  const gap = 3;
  const width = span.cols * metrics.cell + (span.cols - 1) * gap;
  const height = span.rows * metrics.cell + (span.rows - 1) * gap;
  floatEl.hidden = false;
  floatEl.style.width = width + 'px';
  floatEl.style.height = height + 'px';
  floatEl.style.left = (clientX - width / 2) + 'px';
  floatEl.style.top = (clientY - height / 2 - 28) + 'px';
  const rect = floatEl.getBoundingClientRect();
  const col = Math.round((rect.left - metrics.originX) / metrics.stepX);
  const row = Math.round((rect.top - metrics.originY) / metrics.stepY);
  const ok = canPlace(state.grid, piece.cells, row, col);
  showGhost(row, col, piece.cells, ok);
  drag.row = row;
  drag.col = col;
  drag.ok = ok;
}

boardEl.addEventListener('click', function (event) {
  const btn = event.target.closest('.bcell');
  if (!btn || state.over || state.busy) return;
  if (state.selected == null) {
    say('先点下面的一个方块');
    return;
  }
  const index = Number(btn.dataset.i);
  commit(state.selected, Math.floor(index / SIZE), index % SIZE);
});

trayEl.addEventListener('pointerdown', function (event) {
  suppressClick = false;
  const btn = event.target.closest('.slot');
  if (!btn || btn.disabled || state.over || state.busy) return;
  drag.index = Number(btn.dataset.index);
  drag.pointerId = event.pointerId;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.moved = false;
  drag.active = true;
  btn.setPointerCapture(event.pointerId);
});

trayEl.addEventListener('pointermove', function (event) {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && dx * dx + dy * dy < 14 * 14) return;
  drag.moved = true;
  if (event.cancelable) event.preventDefault();
  moveFloat(event.clientX, event.clientY);
}, { passive: false });

trayEl.addEventListener('pointerup', function (event) {
  if (!drag.active || event.pointerId !== drag.pointerId) return;
  const moved = drag.moved;
  const index = drag.index;
  const row = drag.row;
  const col = drag.col;
  const ok = drag.ok;
  hideFloat();
  if (!moved) return;
  suppressClick = true;
  if (ok) commit(index, row, col);
  else say('这里放不下');
});

trayEl.addEventListener('pointercancel', function () {
  hideFloat();
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
    say(state.over ? '没有空位了' : (state.score > 0 ? '继续上次的一局' : '点一个方块，再点棋盘'));
    render();
    if (state.over) showOver();
    return;
  }
  state.grid = emptyGrid();
  state.pieces = dealPlayable();
  state.score = 0;
  state.over = false;
  state.undo = null;
  say('点一个方块，再点棋盘');
  persist();
  render();
}

load();
