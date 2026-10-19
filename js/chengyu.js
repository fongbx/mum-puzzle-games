import { entryCorrect, indexIdioms, inspectPuzzle, puzzleSolved } from './chengyu-core.js';
import { KEYS, bindContrast, readJson, writeJson } from './settings.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const DIFFS = ['easy', 'medium', 'hard'];
const DIFF_LABEL = { easy: '简单', medium: '中等', hard: '困难' };
const DIFF_EN = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const pathView = document.getElementById('path-view');
const playView = document.getElementById('play-view');
const levelList = document.getElementById('level-list');
const loadError = document.getElementById('load-error');
const boardEl = document.getElementById('cy-board');
const trayEl = document.getElementById('cy-tray');
const meaningEl = document.getElementById('cy-meaning');
const statusEl = document.getElementById('status');
const kickerEl = document.getElementById('play-kicker');
const countEl = document.getElementById('play-count');
const hintBtn = document.getElementById('hint');
const modalEl = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalEn = document.getElementById('modal-en');
const modalActions = document.getElementById('modal-actions');
const modalCancel = document.getElementById('modal-cancel');
const modalOk = document.getElementById('modal-ok');

const diffButtons = {
  easy: document.getElementById('diff-easy'),
  medium: document.getElementById('diff-medium'),
  hard: document.getElementById('diff-hard'),
};

let idioms = new Map();
let puzzles = [];
let difficulty = 'easy';
let progress = { v: 1, done: {}, difficulty: 'easy', current: null };
let active = null;
let board = null;
let fills = {};
let hints = {};
let selected = null;
let shownId = null;
let review = false;

function say(text) {
  statusEl.textContent = text;
}

function loadProgress() {
  const saved = readJson(KEYS.chengyu, null);
  if (!saved || saved.v !== 1) return;
  progress.done = saved.done && typeof saved.done === 'object' ? saved.done : {};
  if (DIFFS.indexOf(saved.difficulty) !== -1) progress.difficulty = saved.difficulty;
  if (saved.current && saved.current.id) progress.current = saved.current;
}

function saveProgress() {
  writeJson(KEYS.chengyu, progress);
}

function sameDifficulty(diff) {
  return puzzles.filter(function (puzzle) { return puzzle.difficulty === diff; })
    .sort(function (a, b) { return a.order - b.order; });
}

function unlocked(puzzle) {
  const group = sameDifficulty(puzzle.difficulty);
  const index = group.findIndex(function (item) { return item.id === puzzle.id; });
  if (index <= 0) return true;
  return !!progress.done[group[index - 1].id];
}

function labelOf(puzzle) {
  return DIFF_LABEL[puzzle.difficulty] + ' · 第' + puzzle.order + '关';
}

function valueAt(key) {
  const cell = board.cells.find(function (item) { return item.key === key; });
  if (!cell) return '';
  if (cell.given || hints[key] || review) return cell.answer;
  return fills[key] || '';
}

function solved() {
  return puzzleSolved(board, valueAt);
}

function nextEmpty(afterKey) {
  const cells = board.cells.slice().sort(function (a, b) {
    return a.row - b.row || a.col - b.col;
  });
  const start = cells.findIndex(function (cell) { return cell.key === afterKey; });
  for (let n = 1; n <= cells.length; n++) {
    const cell = cells[(start + n) % cells.length];
    if (!cell.given && !hints[cell.key] && !fills[cell.key]) return cell.key;
  }
  return null;
}

function trayChars() {
  const bag = [];
  for (let i = 0; i < board.cells.length; i++) {
    const cell = board.cells[i];
    if (cell.given || hints[cell.key]) continue;
    bag.push(cell.answer);
  }
  for (let i = 0; i < board.distractors.length; i++) bag.push(board.distractors[i]);
  Object.keys(fills).forEach(function (key) {
    const index = bag.indexOf(fills[key]);
    if (index !== -1) bag.splice(index, 1);
  });
  return bag;
}

function completedEntries() {
  return board.entries.filter(function (entry) { return entryCorrect(entry, valueAt); });
}

function fullButWrong() {
  return board.entries.some(function (entry) {
    const full = entry.cells.every(function (key) { return !!valueAt(key); });
    return full && !entryCorrect(entry, valueAt);
  });
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

function persistPlay() {
  if (review || !active) return;
  progress.current = {
    id: active.id,
    fills: fills,
    hints: hints,
    label: labelOf(active),
  };
  progress.difficulty = active.difficulty;
  saveProgress();
}

function paintDifficulty() {
  DIFFS.forEach(function (diff) {
    const on = diff === difficulty;
    diffButtons[diff].classList.toggle('on', on);
    diffButtons[diff].setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function showPath() {
  playView.hidden = true;
  pathView.hidden = false;
  closeModal();
  paintDifficulty();
  levelList.replaceChildren();
  const group = sameDifficulty(difficulty);
  group.forEach(function (puzzle) {
    const open = unlocked(puzzle);
    const done = !!progress.done[puzzle.id];
    const cont = progress.current && progress.current.id === puzzle.id && !done;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lesson-node' + (done ? ' done' : '') + (open ? '' : ' locked');
    const built = inspectPuzzle(puzzle, idioms);
    const count = built.board.entries.length;
    btn.innerHTML =
      '<span class="step-no">' + puzzle.order + '</span>' +
      '<span class="lesson-text">' +
      '<span class="game-zh">第' + puzzle.order + '关</span>' +
      '<span class="game-en" lang="en">Level ' + puzzle.order + '</span>' +
      '<span class="hint">' + (done ? '已完成' : (open ? (cont ? '继续 · ' : '') + count + ' 条成语' : '先完成上一关')) + '</span>' +
      '</span>';
    btn.addEventListener('click', function () {
      if (!open) {
        const note = document.createElement('p');
        note.className = 'status';
        note.textContent = '先完成上一关，再来这一关。';
        const old = levelList.querySelector('.status');
        if (old) old.remove();
        levelList.appendChild(note);
        return;
      }
      openPuzzle(puzzle);
    });
    levelList.appendChild(btn);
  });
}

function paintMeaning() {
  const done = completedEntries();
  if (!done.length) {
    meaningEl.hidden = true;
    meaningEl.replaceChildren();
    return;
  }
  if (!done.some(function (entry) { return entry.id === shownId; })) shownId = done[done.length - 1].id;
  const entry = done.find(function (item) { return item.id === shownId; });
  meaningEl.hidden = false;
  meaningEl.replaceChildren();
  const title = document.createElement('p');
  title.className = 'cy-idiom';
  title.textContent = entry.text;
  const meaning = document.createElement('p');
  meaning.className = 'cy-def';
  meaning.textContent = entry.meaning;
  meaningEl.appendChild(title);
  meaningEl.appendChild(meaning);
  if (entry.example) {
    const example = document.createElement('p');
    example.className = 'cy-ex';
    example.textContent = '例：' + entry.example;
    meaningEl.appendChild(example);
  }
  if (done.length > 1) {
    const more = document.createElement('p');
    more.className = 'cy-more';
    more.textContent = '已完成 ' + done.length + ' / ' + board.entries.length + ' 条';
    meaningEl.appendChild(more);
  }
}

function paintBoard() {
  boardEl.style.gridTemplateColumns = 'repeat(' + board.cols + ', minmax(0, 1fr))';
  boardEl.replaceChildren();
  const doneIds = new Set(completedEntries().map(function (entry) { return entry.id; }));
  for (let i = 0; i < board.slots.length; i++) {
    const cell = board.slots[i];
    if (!cell) {
      const hole = document.createElement('span');
      hole.className = 'cy-hole';
      hole.setAttribute('aria-hidden', 'true');
      const wrap = document.createElement('span');
      wrap.className = 'cy-slot';
      wrap.appendChild(hole);
      boardEl.appendChild(wrap);
      continue;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    const value = valueAt(cell.key);
    const locked = cell.given || !!hints[cell.key] || review;
    const inDone = cell.entryIds.some(function (id) { return doneIds.has(id); });
    btn.className = 'cy-cell' +
      (locked ? ' given' : '') +
      (value && !locked ? ' filled' : '') +
      (selected === cell.key ? ' selected' : '') +
      (inDone ? ' good' : '') +
      (value && value !== cell.answer ? ' soft' : '');
    btn.textContent = value;
    btn.setAttribute('aria-label', '第' + (cell.row + 1) + '行第' + (cell.col + 1) + '列，' + (value || '空'));
    btn.addEventListener('click', function () { onCell(cell.key); });
    const wrap = document.createElement('span');
    wrap.className = 'cy-slot';
    wrap.appendChild(btn);
    boardEl.appendChild(wrap);
  }
}

function paintTray() {
  trayEl.replaceChildren();
  if (review) {
    trayEl.hidden = true;
    return;
  }
  trayEl.hidden = false;
  trayChars().forEach(function (ch, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cy-char';
    btn.textContent = ch;
    btn.setAttribute('aria-label', '填入 ' + ch);
    btn.addEventListener('click', function () { placeChar(ch, index); });
    trayEl.appendChild(btn);
  });
}

function paintPlay() {
  const done = completedEntries().length;
  kickerEl.textContent = labelOf(active);
  countEl.textContent = '已完成 ' + done + ' / ' + board.entries.length + ' 条';
  hintBtn.disabled = review || solved();
  paintBoard();
  paintMeaning();
  paintTray();
}

function celebrate(entry) {
  shownId = entry.id;
  say('这条完成了');
}

function finishIfNeeded(previousIds) {
  const done = completedEntries();
  for (let i = 0; i < done.length; i++) {
    if (previousIds.indexOf(done[i].id) === -1) celebrate(done[i]);
  }
  if (solved() && !review) {
    progress.done[active.id] = true;
    progress.current = null;
    saveProgress();
    paintPlay();
    const group = sameDifficulty(active.difficulty);
    const next = group.find(function (puzzle) { return puzzle.order === active.order + 1; });
    openModal({
      title: '这一关完成了',
      body: '四字成语都填好了。',
      en: 'This level is complete.',
      cancel: next ? '下一关' : '',
      ok: '返回关卡',
      onCancel: function () { if (next) openPuzzle(next); },
      onOk: function () { showPath(); },
    });
    return true;
  }
  return false;
}

function onCell(key) {
  if (review) {
    const entry = board.entries.find(function (item) { return item.cells.indexOf(key) !== -1; });
    if (entry) shownId = entry.id;
    paintMeaning();
    return;
  }
  const cell = board.cells.find(function (item) { return item.key === key; });
  if (!cell) return;
  if (cell.given || hints[key]) {
    say('这是提示');
    const entry = board.entries.find(function (item) {
      return item.cells.indexOf(key) !== -1 && entryCorrect(item, valueAt);
    });
    if (entry) shownId = entry.id;
    selected = null;
    paintPlay();
    return;
  }
  if (fills[key]) {
    delete fills[key];
    selected = key;
    say('这个字拿回来了');
    persistPlay();
    paintPlay();
    return;
  }
  selected = key;
  say('再点下面的字');
  paintPlay();
}

function placeChar(ch) {
  if (review) return;
  if (!selected) {
    say('先点一个空格');
    return;
  }
  const cell = board.cells.find(function (item) { return item.key === selected; });
  if (!cell || cell.given || hints[cell.key] || fills[cell.key]) return;
  const before = completedEntries().map(function (entry) { return entry.id; });
  fills[cell.key] = ch;
  selected = nextEmpty(cell.key);
  if (!finishIfNeeded(before)) {
    if (fullButWrong()) say('这一条再看看');
    else if (!statusEl.textContent || statusEl.textContent === '再点下面的字') say('放好了');
    persistPlay();
    paintPlay();
  }
}

function useHint() {
  if (review || !board) return;
  const cells = board.cells.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; });
  const cell = cells.find(function (item) { return valueAt(item.key) !== item.answer; });
  if (!cell) {
    say('都对了');
    return;
  }
  const before = completedEntries().map(function (entry) { return entry.id; });
  if (fills[cell.key]) delete fills[cell.key];
  hints[cell.key] = true;
  if (selected === cell.key) selected = nextEmpty(cell.key);
  say('看这个字');
  if (!finishIfNeeded(before)) {
    persistPlay();
    paintPlay();
  }
}

function openPuzzle(puzzle) {
  const built = inspectPuzzle(puzzle, idioms);
  if (built.issues.length) {
    say('这关暂时打不开');
    return;
  }
  active = puzzle;
  board = built.board;
  review = !!progress.done[puzzle.id];
  fills = {};
  hints = {};
  selected = null;
  shownId = null;
  closeModal();
  if (!review && progress.current && progress.current.id === puzzle.id) {
    fills = Object.assign({}, progress.current.fills || {});
    hints = Object.assign({}, progress.current.hints || {});
  }
  pathView.hidden = true;
  playView.hidden = false;
  say(review ? '这一关已经完成' : '点一个空格');
  if (!review) {
    progress.current = { id: puzzle.id, fills: fills, hints: hints, label: labelOf(puzzle) };
    progress.difficulty = puzzle.difficulty;
    saveProgress();
  }
  paintPlay();
  if (!review && !selected) {
    const first = board.cells.find(function (cell) { return !cell.given && !hints[cell.key] && !fills[cell.key]; });
    if (first) selected = first.key;
    paintBoard();
  }
}

DIFFS.forEach(function (diff) {
  diffButtons[diff].addEventListener('click', function () {
    difficulty = diff;
    progress.difficulty = diff;
    saveProgress();
    showPath();
  });
});

document.getElementById('to-levels').addEventListener('click', function () { showPath(); });
hintBtn.addEventListener('click', function () { useHint(); });

async function boot() {
  loadProgress();
  difficulty = progress.difficulty || 'easy';
  try {
    const idiomRes = await fetch('./data/chengyu/idioms.json');
    const puzzleRes = await fetch('./data/chengyu/puzzles.json');
    if (!idiomRes.ok || !puzzleRes.ok) throw new Error('load');
    const idiomFile = await idiomRes.json();
    const puzzleFile = await puzzleRes.json();
    if (idiomFile.schemaVersion !== 1 || puzzleFile.schemaVersion !== 1) throw new Error('schema');
    idioms = indexIdioms(idiomFile.idioms);
    puzzles = Array.isArray(puzzleFile.puzzles) ? puzzleFile.puzzles : [];
    showPath();
  } catch (e) {
    loadError.hidden = false;
  }
}

boot();
