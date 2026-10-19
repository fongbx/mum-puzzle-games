// Shared rules for the idiom crossword. The page draws this; the check script uses the same builder.
// A puzzle is a list of 4-character idioms placed across or down. Crossings must be the same character.

export function indexIdioms(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item && item.id && !map.has(item.id)) map.set(item.id, item);
  }
  return map;
}

function keyOf(row, col) {
  return row + ',' + col;
}

export function inspectPuzzle(puzzle, byId) {
  const issues = [];
  if (!puzzle || !puzzle.id) issues.push('missing puzzle id');
  if (!puzzle || (puzzle.difficulty !== 'easy' && puzzle.difficulty !== 'medium' && puzzle.difficulty !== 'hard')) {
    issues.push((puzzle && puzzle.id) + ' difficulty');
  }
  const entries = [];
  const seenIdiom = new Set();
  const grid = new Map();
  const list = puzzle && Array.isArray(puzzle.entries) ? puzzle.entries : [];
  if (list.length < 2) issues.push((puzzle && puzzle.id) + ' needs at least two idioms');

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const idiom = byId.get(entry && entry.idiomId);
    if (!idiom) {
      issues.push((puzzle && puzzle.id) + ' unknown idiom ' + (entry && entry.idiomId));
      continue;
    }
    if (seenIdiom.has(idiom.id)) issues.push(puzzle.id + ' repeats ' + idiom.id);
    seenIdiom.add(idiom.id);
    if (![...idiom.text].length || [...idiom.text].length !== 4) {
      issues.push(idiom.id + ' must be four characters');
      continue;
    }
    if (entry.dir !== 'across' && entry.dir !== 'down') {
      issues.push(puzzle.id + ' bad direction ' + idiom.id);
      continue;
    }
    const chars = [...idiom.text];
    const cells = [];
    for (let n = 0; n < 4; n++) {
      const row = entry.row + (entry.dir === 'down' ? n : 0);
      const col = entry.col + (entry.dir === 'across' ? n : 0);
      if (row < 0 || col < 0) issues.push(puzzle.id + ' negative cell');
      const key = keyOf(row, col);
      const prev = grid.get(key);
      if (prev && prev.answer !== chars[n]) {
        issues.push(puzzle.id + ' crossing mismatch at ' + key + ' ' + prev.answer + '/' + chars[n]);
      }
      if (!prev) grid.set(key, { key: key, row: row, col: col, answer: chars[n], entryIds: [] });
      grid.get(key).entryIds.push(idiom.id);
      cells.push(key);
    }
    entries.push({
      id: idiom.id,
      text: idiom.text,
      meaning: idiom.meaning || '',
      example: idiom.example || '',
      dir: entry.dir,
      cells: cells,
    });
  }

  let rows = 0;
  let cols = 0;
  for (const cell of grid.values()) {
    rows = Math.max(rows, cell.row + 1);
    cols = Math.max(cols, cell.col + 1);
  }

  const givenSet = new Set();
  const givens = puzzle && Array.isArray(puzzle.givens) ? puzzle.givens : [];
  for (let i = 0; i < givens.length; i++) {
    const pair = givens[i];
    if (!pair || pair.length !== 2) {
      issues.push(puzzle.id + ' bad given');
      continue;
    }
    const key = keyOf(pair[0], pair[1]);
    if (!grid.has(key)) issues.push(puzzle.id + ' given off the grid ' + key);
    else givenSet.add(key);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let filled = 0;
    for (let n = 0; n < entry.cells.length; n++) if (givenSet.has(entry.cells[n])) filled += 1;
    if (filled < 1) issues.push(puzzle.id + ' ' + entry.id + ' has no hint');
    if (filled > 3) issues.push(puzzle.id + ' ' + entry.id + ' has no blank');
  }

  const used = new Set();
  for (const cell of grid.values()) used.add(cell.answer);
  const distractors = puzzle && Array.isArray(puzzle.distractors) ? puzzle.distractors : [];
  const seenDistractor = new Set();
  for (let i = 0; i < distractors.length; i++) {
    const ch = distractors[i];
    if (typeof ch !== 'string' || [...ch].length !== 1) issues.push(puzzle.id + ' distractor ' + ch);
    else if (used.has(ch)) issues.push(puzzle.id + ' distractor is already in the puzzle ' + ch);
    else if (seenDistractor.has(ch)) issues.push(puzzle.id + ' repeated distractor ' + ch);
    seenDistractor.add(ch);
  }
  if (puzzle && puzzle.difficulty === 'easy' && distractors.length > 3) issues.push(puzzle.id + ' too many distractors for easy');
  if (puzzle && puzzle.difficulty === 'hard' && distractors.length < 5) issues.push(puzzle.id + ' hard needs more distractors');

  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid.get(keyOf(r, c)) || null;
      if (cell) cell.given = givenSet.has(cell.key);
      slots.push(cell);
    }
  }

  return {
    issues: issues,
    board: {
      rows: rows,
      cols: cols,
      slots: slots,
      cells: [...grid.values()],
      entries: entries,
      distractors: distractors.slice(),
    },
  };
}

export function entryCorrect(entry, valueAt) {
  const chars = [...entry.text];
  for (let i = 0; i < chars.length; i++) {
    if (valueAt(entry.cells[i]) !== chars[i]) return false;
  }
  return true;
}

export function puzzleSolved(board, valueAt) {
  for (let i = 0; i < board.entries.length; i++) {
    if (!entryCorrect(board.entries[i], valueAt)) return false;
  }
  return board.entries.length > 0;
}
