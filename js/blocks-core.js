// Pure rules for the block game. The page in blocks.js draws this; nothing here touches the DOM.
// An 8×8 grid. A piece is a list of [row, column] squares, with its top-left at 0,0.
// Filled squares use a colour number 1–5. Empty squares are 0.

export const SIZE = 8;

export const SHAPES = {
  dot: [[0, 0]],
  h2: [[0, 0], [0, 1]],
  v2: [[0, 0], [1, 0]],
  h3: [[0, 0], [0, 1], [0, 2]],
  v3: [[0, 0], [1, 0], [2, 0]],
  l2: [[0, 0], [1, 0], [1, 1]],
  j2: [[0, 1], [1, 0], [1, 1]],
  sq2: [[0, 0], [0, 1], [1, 0], [1, 1]],
  h4: [[0, 0], [0, 1], [0, 2], [0, 3]],
  v4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  t3: [[0, 0], [0, 1], [0, 2], [1, 1]],
  l3: [[0, 0], [1, 0], [2, 0], [2, 1]],
  j3: [[0, 1], [1, 1], [2, 0], [2, 1]],
  s: [[0, 1], [0, 2], [1, 0], [1, 1]],
  z: [[0, 0], [0, 1], [1, 1], [1, 2]],
  rect: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  h5: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  v5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  sq3: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

// Smaller pieces come up more often so a round can last.
const BAG = [
  ['dot', 4],
  ['h2', 4],
  ['v2', 4],
  ['h3', 3],
  ['v3', 3],
  ['l2', 3],
  ['j2', 3],
  ['sq2', 3],
  ['h4', 2],
  ['v4', 2],
  ['t3', 2],
  ['l3', 2],
  ['j3', 2],
  ['rect', 2],
  ['s', 1],
  ['z', 1],
  ['h5', 1],
  ['v5', 1],
  ['sq3', 1],
];

export function emptyGrid() {
  const grid = [];
  for (let i = 0; i < SIZE * SIZE; i++) grid.push(0);
  return grid;
}

export function cellIndex(row, col) {
  return row * SIZE + col;
}

export function canPlace(grid, cells, row, col) {
  for (let i = 0; i < cells.length; i++) {
    const r = row + cells[i][0];
    const c = col + cells[i][1];
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
    if (grid[cellIndex(r, c)]) return false;
  }
  return true;
}

export function place(grid, cells, row, col, color) {
  if (!canPlace(grid, cells, row, col)) return null;
  const next = grid.slice();
  for (let i = 0; i < cells.length; i++) {
    next[cellIndex(row + cells[i][0], col + cells[i][1])] = color;
  }
  return next;
}

export function clearLines(grid) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE; c++) {
      if (!grid[cellIndex(r, c)]) full = false;
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) {
      if (!grid[cellIndex(r, c)]) full = false;
    }
    if (full) cols.push(c);
  }
  if (!rows.length && !cols.length) return { grid: grid, rows: rows, cols: cols };
  const next = grid.slice();
  for (let i = 0; i < rows.length; i++) {
    for (let c = 0; c < SIZE; c++) next[cellIndex(rows[i], c)] = 0;
  }
  for (let i = 0; i < cols.length; i++) {
    for (let r = 0; r < SIZE; r++) next[cellIndex(r, cols[i])] = 0;
  }
  return { grid: next, rows: rows, cols: cols };
}

export function fitsAnywhere(grid, cells) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (canPlace(grid, cells, r, c)) return true;
    }
  }
  return false;
}

export function anyPieceFits(grid, pieces) {
  for (let i = 0; i < pieces.length; i++) {
    if (!pieces[i].used && fitsAnywhere(grid, pieces[i].cells)) return true;
  }
  return false;
}

export function lineScore(lineCount) {
  if (!lineCount) return 0;
  return lineCount * SIZE + (lineCount - 1) * 10;
}

export function pickShape(random) {
  let total = 0;
  for (let i = 0; i < BAG.length; i++) total += BAG[i][1];
  let roll = random() * total;
  let id = BAG[BAG.length - 1][0];
  for (let i = 0; i < BAG.length; i++) {
    roll -= BAG[i][1];
    if (roll < 0) {
      id = BAG[i][0];
      break;
    }
  }
  const cells = SHAPES[id].map(function (pair) { return [pair[0], pair[1]]; });
  return { id: id, cells: cells };
}

export function dealPieces(random) {
  const pieces = [];
  const seen = {};
  for (let n = 0; n < 3; n++) {
    let shape = pickShape(random);
    let guard = 0;
    while (seen[shape.id] && guard < 8) {
      shape = pickShape(random);
      guard += 1;
    }
    seen[shape.id] = true;
    pieces.push({
      id: shape.id,
      cells: shape.cells,
      color: 1 + Math.floor(random() * 5),
      used: false,
    });
  }
  return pieces;
}

export function clonePieces(pieces) {
  return pieces.map(function (piece) {
    return {
      id: piece.id,
      cells: piece.cells.map(function (pair) { return [pair[0], pair[1]]; }),
      color: piece.color,
      used: !!piece.used,
    };
  });
}
