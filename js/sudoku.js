import { generatePuzzle, isValidComplete } from './sudoku-core.js';
import { KEYS, bindContrast, loadSettings, readJson, saveSettings, writeJson } from './settings.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const boardEl = document.getElementById('board');
const cells = [];
const padEl = document.getElementById('pad');
const padButtons = [];
const notesBtn = document.getElementById('notes');
const undoBtn = document.getElementById('undo');
const clearBtn = document.getElementById('clear');
const mistakesBtn = document.getElementById('mistakes');
const newBtn = document.getElementById('new-game');
const easyBtn = document.getElementById('diff-easy');
const mediumBtn = document.getElementById('diff-medium');
const loadingEl = document.getElementById('loading');
const modalEl = document.getElementById('modal');

const state = {
  difficulty: 'easy',
  givens: [],
  solution: [],
  values: [],
  notes: [],
  undo: [],
  mistakes: true,
  notesMode: false,
  selected: null,
  won: false,
  counted: false,
};

let busy = false;
let askFinish = null;

for (let i = 0; i < 81; i++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cell';
  btn.addEventListener('click', function () { select(i); });
  boardEl.appendChild(btn);
  cells.push(btn);
}

for (let n = 1; n <= 9; n++) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = String(n);
  btn.addEventListener('click', function () { place(n); });
  padEl.appendChild(btn);
  padButtons.push(btn);
}

function blankNotes() {
  const notes = [];
  for (let i = 0; i < 81; i++) notes.push(0);
  return notes;
}

function snapshot() {
  return { values: state.values.slice(), notes: state.notes.slice() };
}

function pushUndo() {
  state.undo.push(snapshot());
  if (state.undo.length > 80) state.undo.shift();
}

function persist() {
  const data = {
    v: 1,
    difficulty: state.difficulty,
    givens: state.givens,
    solution: state.solution,
    values: state.values,
    notes: state.notes,
    mistakes: state.mistakes,
    notesMode: state.notesMode,
    won: state.won,
    counted: state.counted,
    undo: state.undo.slice(-80),
  };
  if (!writeJson(KEYS.sudoku, data)) {
    data.undo = [];
    writeJson(KEYS.sudoku, data);
  }
}

function validSave(save) {
  if (!save || save.v !== 1) return false;
  if (save.difficulty !== 'easy' && save.difficulty !== 'medium') return false;
  const keys = ['givens', 'solution', 'values', 'notes'];
  for (let k = 0; k < keys.length; k++) {
    if (!Array.isArray(save[keys[k]]) || save[keys[k]].length !== 81) return false;
  }
  if (!isValidComplete(save.solution)) return false;
  for (let i = 0; i < 81; i++) {
    const g = save.givens[i];
    const v = save.values[i];
    if (g < 0 || g > 9 || v < 0 || v > 9) return false;
    if (g && g !== save.solution[i]) return false;
    if (g && v !== g) return false;
  }
  return true;
}

function boardComplete() {
  for (let i = 0; i < 81; i++) {
    if (state.values[i] !== state.solution[i]) return false;
  }
  return true;
}

function addWinStat() {
  const stats = readJson(KEYS.stats, {});
  const next = { easy: stats.easy | 0, medium: stats.medium | 0 };
  next[state.difficulty === 'medium' ? 'medium' : 'easy'] += 1;
  writeJson(KEYS.stats, next);
}

function checkWin(showModal) {
  if (!boardComplete()) {
    state.won = false;
    return;
  }
  const first = !state.counted;
  state.won = true;
  if (first) {
    state.counted = true;
    addWinStat();
    if (showModal) openWin();
  }
}

function adopt(puzzle) {
  state.difficulty = puzzle.difficulty;
  state.givens = puzzle.givens.slice();
  state.solution = puzzle.solution.slice();
  state.values = puzzle.givens.slice();
  state.notes = blankNotes();
  state.undo = [];
  state.selected = null;
  state.won = false;
  state.counted = false;
  saveSettings({ difficulty: state.difficulty });
  persist();
  paint();
}

function startGenerated(diff) {
  if (askFinish) askFinish(false);
  busy = true;
  loadingEl.hidden = false;
  setTimeout(function () {
    const puzzle = generatePuzzle(diff);
    adopt(puzzle);
    busy = false;
    loadingEl.hidden = true;
  }, 40);
}

function applySave(save) {
  state.difficulty = save.difficulty;
  state.givens = save.givens.slice();
  state.solution = save.solution.slice();
  state.values = save.values.slice();
  state.notes = save.notes.map(function (n) { return n | 0; });
  state.undo = [];
  if (Array.isArray(save.undo)) {
    const start = Math.max(0, save.undo.length - 80);
    for (let i = start; i < save.undo.length; i++) {
      const step = save.undo[i];
      if (step && Array.isArray(step.values) && Array.isArray(step.notes) && step.values.length === 81) {
        state.undo.push({ values: step.values.slice(), notes: step.notes.slice() });
      }
    }
  }
  state.mistakes = save.mistakes !== false;
  state.notesMode = !!save.notesMode;
  state.won = !!save.won;
  state.counted = !!save.won || !!save.counted;
  state.selected = null;
  if (boardComplete()) {
    state.won = true;
    if (!state.counted) {
      state.counted = true;
      addWinStat();
      persist();
    }
  }
  paint();
}

function inProgress() {
  if (state.won) return false;
  for (let i = 0; i < 81; i++) {
    if (state.givens[i]) continue;
    if (state.values[i] || state.notes[i]) return true;
  }
  return false;
}

function select(i) {
  if (busy || state.won) return;
  state.selected = i;
  paint();
}

function place(n) {
  if (busy || state.won || modalOpen()) return;
  if (state.selected == null) {
    setStatus('先点一个格子');
    return;
  }
  const i = state.selected;
  if (state.givens[i]) {
    setStatus('这格是题目给的');
    return;
  }
  if (state.notesMode) {
    if (state.values[i]) {
      setStatus('这格已经有数字');
      return;
    }
    const bit = 1 << n;
    if ((state.notes[i] & bit) === 0 || (state.notes[i] & bit) === bit) {
      pushUndo();
      state.notes[i] ^= bit;
      persist();
      paint();
    }
    return;
  }
  if (state.values[i] === n) return;
  pushUndo();
  state.values[i] = n;
  state.notes[i] = 0;
  checkWin(true);
  persist();
  paint();
}

function clearCell() {
  if (busy || state.won || modalOpen() || state.selected == null) return;
  const i = state.selected;
  if (state.givens[i]) {
    setStatus('这格是题目给的');
    return;
  }
  if (!state.values[i] && !state.notes[i]) return;
  pushUndo();
  state.values[i] = 0;
  state.notes[i] = 0;
  state.won = false;
  persist();
  paint();
}

function undo() {
  if (busy || modalOpen()) return;
  const prev = state.undo.pop();
  if (!prev) return;
  state.values = prev.values;
  state.notes = prev.notes;
  state.won = false;
  persist();
  paint();
}

function digitDone(n) {
  for (let i = 0; i < 81; i++) {
    if (state.solution[i] === n && state.values[i] !== n) return false;
  }
  return state.solution.length === 81;
}

function filledText() {
  let holes = 0;
  let filled = 0;
  for (let i = 0; i < 81; i++) {
    if (state.givens[i]) continue;
    holes++;
    if (state.values[i]) filled++;
  }
  return '已填 ' + filled + ' / ' + holes;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function statusText() {
  if (!state.givens.length) return '正在准备…';
  if (state.won) return '这题完成了';
  if (state.selected == null) return '先点一个格子';
  const r = ((state.selected / 9) | 0) + 1;
  const c = (state.selected % 9) + 1;
  let text = '第 ' + r + ' 行，第 ' + c + ' 列';
  if (state.givens[state.selected]) text += ' · 题目给的';
  if (state.mistakes) {
    let bad = 0;
    for (let i = 0; i < 81; i++) {
      if (state.values[i] && state.values[i] !== state.solution[i]) bad++;
    }
    if (bad) text += ' · 有 ' + bad + ' 格不一样';
  }
  return text;
}

function paint() {
  const sel = state.selected;
  const selValue = sel == null ? 0 : state.values[sel];
  const sr = sel == null ? -1 : (sel / 9) | 0;
  const sc = sel == null ? -1 : sel % 9;

  for (let i = 0; i < 81; i++) {
    const btn = cells[i];
    const r = (i / 9) | 0;
    const c = i % 9;
    const value = state.values[i] || 0;
    const given = !!state.givens[i];
    btn.className = 'cell';
    if (r === 3 || r === 6) btn.classList.add('box-top');
    if (c === 3 || c === 6) btn.classList.add('box-left');
    if (given) btn.classList.add('given');
    else if (value) btn.classList.add('entry');
    if (sel != null) {
      const sameBox = ((sr / 3) | 0) === ((r / 3) | 0) && ((sc / 3) | 0) === ((c / 3) | 0);
      if (r === sr || c === sc || sameBox) btn.classList.add('peer');
      if (selValue && value === selValue) btn.classList.add('same');
    }
    if (i === sel) btn.classList.add('selected');
    if (state.mistakes && value && value !== state.solution[i]) btn.classList.add('bad');

    btn.textContent = '';
    if (value) {
      btn.textContent = String(value);
    } else if (state.notes[i]) {
      const wrap = document.createElement('span');
      wrap.className = 'notes';
      wrap.setAttribute('aria-hidden', 'true');
      for (let n = 1; n <= 9; n++) {
        const mark = document.createElement('i');
        if (state.notes[i] & (1 << n)) mark.textContent = String(n);
        wrap.appendChild(mark);
      }
      btn.appendChild(wrap);
    }

    let label = '第' + (r + 1) + '行第' + (c + 1) + '列，';
    if (given) label += '题目 ' + value;
    else if (value) label += value;
    else if (state.notes[i]) label += '有笔记';
    else label += '空';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
  }

  for (let n = 1; n <= 9; n++) {
    const btn = padButtons[n - 1];
    const noteOn = sel != null && !!(state.notes[sel] & (1 << n));
    btn.classList.toggle('on', selValue === n || (!selValue && state.notesMode && noteOn));
    btn.classList.toggle('done', state.solution.length === 81 && digitDone(n));
    btn.setAttribute('aria-label', (state.notesMode ? '笔记 ' : '数字 ') + n);
  }

  notesBtn.classList.toggle('on', state.notesMode);
  notesBtn.setAttribute('aria-pressed', state.notesMode ? 'true' : 'false');
  mistakesBtn.classList.toggle('on', state.mistakes);
  mistakesBtn.setAttribute('aria-pressed', state.mistakes ? 'true' : 'false');
  undoBtn.disabled = state.undo.length === 0;
  clearBtn.disabled = !canClear();
  easyBtn.classList.toggle('on', state.difficulty === 'easy');
  mediumBtn.classList.toggle('on', state.difficulty === 'medium');
  easyBtn.setAttribute('aria-checked', state.difficulty === 'easy' ? 'true' : 'false');
  mediumBtn.setAttribute('aria-checked', state.difficulty === 'medium' ? 'true' : 'false');
  document.getElementById('filled').textContent = state.givens.length ? filledText() : '已填 0 / 0';
  document.getElementById('done-banner').hidden = !state.won;
  setStatus(statusText());
}

function canClear() {
  if (state.won || state.selected == null) return false;
  const i = state.selected;
  if (state.givens[i]) return false;
  return !!(state.values[i] || state.notes[i]);
}

function modalOpen() {
  return !modalEl.hidden;
}

function ask(title, body, okText, cancelText) {
  return new Promise(function (resolve) {
    const ok = document.getElementById('modal-ok');
    const cancel = document.getElementById('modal-cancel');
    const actions = document.getElementById('modal-actions');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    document.querySelector('#modal .flower').hidden = title !== '完成啦';
    ok.textContent = okText;
    if (cancelText) {
      cancel.hidden = false;
      cancel.textContent = cancelText;
      actions.classList.remove('single');
    } else {
      cancel.hidden = true;
      actions.classList.add('single');
    }
    modalEl.hidden = false;
    const opener = document.activeElement;
    function finish(value) {
      if (askFinish !== finish) return;
      askFinish = null;
      modalEl.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener.focus) opener.focus();
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    }
    askFinish = finish;
    ok.onclick = function () { finish(true); };
    cancel.onclick = function () { finish(false); };
    modalEl.onclick = function (e) {
      if (e.target === modalEl) finish(false);
    };
    document.addEventListener('keydown', onKey, true);
    (cancelText ? cancel : ok).focus();
  });
}

function openWin() {
  const level = state.difficulty === 'medium' ? '中等' : '简单';
  ask('完成啦', '这道' + level + '题做好了。', '再来一题', '先看看').then(function (again) {
    if (again) startGenerated(state.difficulty);
  });
}

async function requestNew(diff) {
  if (busy) return;
  if (diff !== state.difficulty && inProgress()) {
    const yes = await ask('换一题吗？', '这一题还没做完。换掉之后，就不能撤销回来了。', '换新题', '继续这一题');
    if (!yes) return;
  } else if (diff === state.difficulty && inProgress()) {
    const yes = await ask('换一题吗？', '这一题还没做完。换掉之后，就不能撤销回来了。', '换新题', '继续这一题');
    if (!yes) return;
  }
  state.difficulty = diff;
  startGenerated(diff);
}

notesBtn.addEventListener('click', function () {
  if (busy || state.won) return;
  state.notesMode = !state.notesMode;
  persist();
  paint();
});

undoBtn.addEventListener('click', undo);
clearBtn.addEventListener('click', clearCell);

mistakesBtn.addEventListener('click', function () {
  if (busy) return;
  state.mistakes = !state.mistakes;
  saveSettings({ mistakes: state.mistakes });
  persist();
  paint();
});

newBtn.addEventListener('click', function () { requestNew(state.difficulty); });
easyBtn.addEventListener('click', function () {
  if (state.difficulty === 'easy') return;
  requestNew('easy');
});
mediumBtn.addEventListener('click', function () {
  if (state.difficulty === 'medium') return;
  requestNew('medium');
});

document.addEventListener('keydown', function (e) {
  if (modalOpen() || busy) return;
  if (e.key >= '1' && e.key <= '9') {
    place(Number(e.key));
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    e.preventDefault();
    clearCell();
    return;
  }
  if (e.key === 'n' || e.key === 'N') {
    notesBtn.click();
    return;
  }
  if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    undo();
    return;
  }
  const step = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (step[e.key] == null || state.selected == null) return;
  e.preventDefault();
  const col = state.selected % 9;
  if (e.key === 'ArrowLeft' && col === 0) return;
  if (e.key === 'ArrowRight' && col === 8) return;
  const next = state.selected + step[e.key];
  if (next >= 0 && next < 81) select(next);
});

const settings = loadSettings();
state.mistakes = settings.mistakes;
const existing = readJson(KEYS.sudoku, null);
if (existing && validSave(existing)) applySave(existing);
else startGenerated(settings.difficulty);
