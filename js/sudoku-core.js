// Makes classic 9×9 Sudoku puzzles on the phone.
// 1. Shuffle a finished grid (rows, columns, and digits) so it stays valid.
// 2. Remove symmetric pairs of clues.
// 3. Keep a removal only when exactly one solution remains.

const BASE = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
];

// Bits 1–9. Bit 0 is unused so digit 1 lives at bit 1.
const FULL = 0x3fe;

export const DIFFICULTY = {
  easy: { target: 43, max: 49 },
  medium: { target: 33, max: 37 },
};

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function bandPerm() {
  const bands = shuffle([0, 1, 2]);
  const perm = [];
  for (let b = 0; b < bands.length; b++) {
    const rows = shuffle([0, 1, 2]);
    for (let r = 0; r < rows.length; r++) perm.push(bands[b] * 3 + rows[r]);
  }
  return perm;
}

function transpose(grid) {
  const out = [];
  for (let c = 0; c < 9; c++) {
    const row = [];
    for (let r = 0; r < 9; r++) row.push(grid[r][c]);
    out.push(row);
  }
  return out;
}

function flatten(grid) {
  const out = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) out.push(grid[r][c]);
  }
  return out;
}

export function makeSolvedGrid() {
  let grid = BASE.map(function (row) { return row.slice(); });
  const rowPerm = bandPerm();
  const colPerm = bandPerm();
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const shuffled = [];
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      row.push(digits[grid[rowPerm[r]][colPerm[c]] - 1]);
    }
    shuffled.push(row);
  }
  grid = shuffled;
  if (Math.random() < 0.5) grid = transpose(grid);
  return flatten(grid);
}

function bitCount(n) {
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

function bitIndex(bit) {
  let n = 0;
  while (bit > 1) {
    bit >>= 1;
    n++;
  }
  return n;
}

// Count solutions up to `limit` (stop early). Returns the first completed grid too.
function search(givens, limit) {
  if (!givens || givens.length !== 81) return { count: 0, solution: null };

  const board = givens.slice();
  const rows = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const cols = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const boxes = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const empty = [];

  for (let i = 0; i < 81; i++) {
    const n = board[i];
    if (typeof n !== 'number' || n !== (n | 0) || n < 0 || n > 9) {
      return { count: 0, solution: null };
    }
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    if (n === 0) {
      empty.push(i);
      continue;
    }
    const bit = 1 << n;
    if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) {
      return { count: 0, solution: null };
    }
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }

  let count = 0;
  let found = null;

  function dfs(k) {
    if (count >= limit) return;
    if (k === empty.length) {
      count++;
      if (!found) found = board.slice();
      return;
    }

    let bestAt = k;
    let bestSize = 10;
    for (let t = k; t < empty.length; t++) {
      const i = empty[t];
      const r = (i / 9) | 0;
      const c = i % 9;
      const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
      const mask = FULL & ~(rows[r] | cols[c] | boxes[b]);
      const size = bitCount(mask);
      if (size < bestSize) {
        bestSize = size;
        bestAt = t;
        if (size < 2) break;
      }
    }
    if (bestSize === 0) return;

    const swap = empty[k];
    empty[k] = empty[bestAt];
    empty[bestAt] = swap;

    const i = empty[k];
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    let mask = FULL & ~(rows[r] | cols[c] | boxes[b]);
    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      const n = bitIndex(bit);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      board[i] = n;
      dfs(k + 1);
      board[i] = 0;
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      if (count >= limit) return;
    }
  }

  dfs(0);
  return { count: count, solution: found };
}

export function countSolutions(givens, limit) {
  return search(givens, limit == null ? 2 : limit).count;
}

export function solveOne(givens) {
  const result = search(givens, 1);
  return result.solution;
}

export function isValidComplete(values) {
  if (!values || values.length !== 81) return false;
  const rows = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const cols = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const boxes = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 81; i++) {
    const n = values[i];
    if (typeof n !== 'number' || n < 1 || n > 9) return false;
    const bit = 1 << n;
    const r = (i / 9) | 0;
    const c = i % 9;
    const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
    if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return false;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  return true;
}

function dig(solution, target) {
  const board = solution.slice();
  const order = shuffle(board.map(function (_, i) { return i; }));
  const tried = [];
  for (let i = 0; i < 81; i++) tried.push(false);
  let clues = 81;

  for (let k = 0; k < order.length; k++) {
    if (clues <= target) break;
    const i = order[k];
    if (tried[i] || board[i] === 0) continue;
    const j = 80 - i;
    const pair = j === i ? [i] : [i, j];
    let blocked = false;
    for (let p = 0; p < pair.length; p++) {
      if (tried[pair[p]] || board[pair[p]] === 0) blocked = true;
    }
    if (blocked) {
      for (let p = 0; p < pair.length; p++) tried[pair[p]] = true;
      continue;
    }
    const saved = [];
    for (let p = 0; p < pair.length; p++) {
      saved.push(board[pair[p]]);
      board[pair[p]] = 0;
      tried[pair[p]] = true;
    }
    if (countSolutions(board, 2) !== 1) {
      for (let p = 0; p < pair.length; p++) board[pair[p]] = saved[p];
    } else {
      clues -= pair.length;
    }
  }

  return { givens: board, solution: solution.slice() };
}

export function clueCount(givens) {
  let n = 0;
  for (let i = 0; i < givens.length; i++) if (givens[i]) n++;
  return n;
}

export function generatePuzzle(difficulty) {
  const spec = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  let best = null;
  let bestClues = 99;
  for (let attempt = 0; attempt < 8; attempt++) {
    const made = dig(makeSolvedGrid(), spec.target);
    const clues = clueCount(made.givens);
    if (!best || clues < bestClues) {
      best = made;
      bestClues = clues;
    }
    if (clues <= spec.max && countSolutions(made.givens, 2) === 1) {
      return { difficulty: spec === DIFFICULTY.medium ? 'medium' : 'easy', givens: made.givens, solution: made.solution };
    }
  }
  const name = difficulty === 'medium' ? 'medium' : 'easy';
  return { difficulty: name, givens: best.givens, solution: best.solution };
}
