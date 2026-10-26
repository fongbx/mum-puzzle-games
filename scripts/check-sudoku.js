// Checks the puzzle maker, the block rules, and the English lesson files.
// Run: node scripts/check-sudoku.js

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIFFICULTY,
  clueCount,
  countSolutions,
  generatePuzzle,
  isValidComplete,
  makeSolvedGrid,
  solveOne,
} from '../js/sudoku-core.js';
import {
  SIZE,
  anyPieceFits,
  canPlace,
  cellIndex,
  clearLines,
  dealPieces,
  anchorCovering,
  emptyGrid,
  lineScore,
  place,
  snapAnchor,
} from '../js/blocks-core.js';
import { indexIdioms, inspectPuzzle, puzzleSolved } from '../js/chengyu-core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  }
}

function sameGrid(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const WIKI = [
  5, 3, 0, 0, 7, 0, 0, 0, 0,
  6, 0, 0, 1, 9, 5, 0, 0, 0,
  0, 9, 8, 0, 0, 0, 0, 6, 0,
  8, 0, 0, 0, 6, 0, 0, 0, 3,
  4, 0, 0, 8, 0, 3, 0, 0, 1,
  7, 0, 0, 0, 2, 0, 0, 0, 6,
  0, 6, 0, 0, 0, 0, 2, 8, 0,
  0, 0, 0, 4, 1, 9, 0, 0, 5,
  0, 0, 0, 0, 8, 0, 0, 7, 9,
];

const WIKI_SOLVED = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

assert(isValidComplete(WIKI_SOLVED), 'known solution is a valid grid');
assert(countSolutions(WIKI, 2) === 1, 'known puzzle is unique');
assert(sameGrid(solveOne(WIKI), WIKI_SOLVED), 'solver matches the known solution');

const empty = [];
for (let i = 0; i < 81; i++) empty.push(0);
assert(countSolutions(empty, 2) === 2, 'empty grid has more than one solution');

const clash = WIKI_SOLVED.slice();
clash[1] = clash[0];
assert(countSolutions(clash, 2) === 0, 'a repeated digit is not solvable');

for (let n = 0; n < 20; n++) {
  const grid = makeSolvedGrid();
  assert(isValidComplete(grid), 'shuffled grid ' + n + ' is complete');
}

function checkPuzzle(difficulty, index) {
  const started = Date.now();
  const puzzle = generatePuzzle(difficulty);
  const ms = Date.now() - started;
  const spec = DIFFICULTY[difficulty];
  const clues = clueCount(puzzle.givens);
  assert(puzzle.difficulty === difficulty, difficulty + ' name');
  assert(isValidComplete(puzzle.solution), difficulty + ' ' + index + ' solution grid');
  assert(sameGrid(solveOne(puzzle.givens), puzzle.solution), difficulty + ' ' + index + ' stored solution');
  assert(countSolutions(puzzle.givens, 2) === 1, difficulty + ' ' + index + ' unique');
  for (let i = 0; i < 81; i++) {
    if (puzzle.givens[i] && puzzle.givens[i] !== puzzle.solution[i]) {
      assert(false, difficulty + ' given mismatches solution at ' + i);
      break;
    }
  }
  assert(clues <= spec.max && clues >= spec.target - 4, difficulty + ' ' + index + ' clue count ' + clues);
  const broken = puzzle.givens.slice();
  for (let i = 0; i < 81; i++) {
    if (!broken[i]) {
      broken[i] = puzzle.solution[i] === 1 ? 2 : 1;
      break;
    }
  }
  assert(countSolutions(broken, 2) === 0, difficulty + ' wrong clue is rejected');
  console.log(difficulty + ' #' + index + ': ' + clues + ' clues in ' + ms + 'ms');
  assert(ms < 4000, difficulty + ' generation slower than 4s');
}

for (let i = 0; i < 4; i++) checkPuzzle('easy', i + 1);
for (let i = 0; i < 3; i++) checkPuzzle('medium', i + 1);

assert(!existsSync(join(root, 'data/words.json')), 'old flat word list should be gone');
assert(!existsSync(join(root, 'data/english/unit-01-greetings.json')), 'greetings unit was replaced');

const index = JSON.parse(readFileSync(join(root, 'data/english/index.json'), 'utf8'));
assert(index.schemaVersion === 1, 'index schemaVersion');
assert(Array.isArray(index.units) && index.units.indexOf('unit-01-daily-life.json') !== -1, 'index lists daily life');
assert(index.units.indexOf('unit-01-greetings.json') === -1, 'index does not list greetings');

const pack = JSON.parse(readFileSync(join(root, 'data/english/unit-01-daily-life.json'), 'utf8'));
assert(pack.schemaVersion === 1, 'unit schemaVersion');
assert(pack.units.length === 1, 'one unit in the starter file');
const unit = pack.units[0];
assert(unit.id === 'u01', 'unit id u01');
assert(unit.title === 'Everyday Singapore', 'unit title');
assert(unit.titleChinese === '新加坡日常生活', 'unit chinese title');
assert(unit.level === 'elementary', 'unit level');
assert(unit.lessons.length === 3, 'three lessons');
const titles = unit.lessons.map(function (lesson) { return lesson.titleChinese; });
assert(titles.join('|') === '在小贩中心|搭车出行|看医生', 'lesson titles ' + titles.join('|'));

const ids = new Set();
let vocabCount = 0;
let exerciseCount = 0;
unit.lessons.forEach(function (lesson) {
  assert(lesson.id && lesson.title && lesson.titleChinese, 'lesson names');
  assert(!ids.has(lesson.id), 'duplicate lesson ' + lesson.id);
  ids.add(lesson.id);
  assert(lesson.vocab.length === 5, lesson.id + ' vocab');
  assert(lesson.exercises.length === 5, lesson.id + ' exercises');
  lesson.vocab.forEach(function (word) {
    assert(word.id && word.english && word.chinese, 'vocab ' + word.id);
    assert(!ids.has(word.id), 'duplicate id ' + word.id);
    ids.add(word.id);
    vocabCount += 1;
  });
  lesson.exercises.forEach(function (exercise) {
    assert(exercise.id && !ids.has(exercise.id), 'exercise id ' + exercise.id);
    ids.add(exercise.id);
    exerciseCount += 1;
    if (exercise.type === 'multipleChoice') {
      assert(exercise.prompt && (exercise.promptLanguage === 'chinese' || exercise.promptLanguage === 'english'), exercise.id + ' prompt');
      assert(Array.isArray(exercise.options) && exercise.options.indexOf(exercise.answer) !== -1, exercise.id + ' answer');
    } else if (exercise.type === 'matchPairs') {
      assert(Array.isArray(exercise.pairs) && exercise.pairs.length >= 2, exercise.id + ' pairs');
      exercise.pairs.forEach(function (pair) {
        assert(Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1], exercise.id + ' pair shape');
      });
    } else if (exercise.type === 'fillIn') {
      assert(String(exercise.sentence).indexOf('___') !== -1, exercise.id + ' blank');
      assert(exercise.sentenceChinese, exercise.id + ' sentenceChinese');
      assert(Array.isArray(exercise.options) && exercise.options.indexOf(exercise.answer) !== -1, exercise.id + ' answer');
    } else {
      assert(false, 'unknown exercise ' + exercise.type);
    }
  });
});
assert(vocabCount === 15 && exerciseCount === 15, '15 vocab and 15 exercises');
console.log('lessons: unit', unit.id, vocabCount, 'vocab', exerciseCount, 'exercises');

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const urls = [];
const re = /'\.\/[^']*'/g;
let match = re.exec(sw);
while (match) {
  urls.push(match[0].slice(1, -1));
  match = re.exec(sw);
}
assert(sw.indexOf("mum-games-v6") !== -1, 'service worker cache bumped');
assert(sw.indexOf('./wordcards.html') !== -1, 'service worker caches word cards');
assert(sw.indexOf('./data/english/wordcards.json') !== -1, 'service worker caches word card list');
assert(sw.indexOf('./chengyu.html') !== -1, 'service worker caches chengyu page');
assert(sw.indexOf('./data/chengyu/idioms.json') !== -1 && sw.indexOf('./data/chengyu/puzzles.json') !== -1, 'service worker caches idiom files');
assert(sw.indexOf('./blocks.html') !== -1, 'service worker caches blocks page');
assert(sw.indexOf('./js/blocks.js') !== -1 && sw.indexOf('./js/blocks-core.js') !== -1, 'service worker caches block scripts');
assert(urls.length > 8, 'service worker lists files');
urls.forEach(function (url) {
  if (url === './') return;
  const rel = url.replace(/^\.\//, '');
  assert(existsSync(join(root, rel)), 'missing cached file ' + url);
});

const blockGrid = emptyGrid();
assert(blockGrid.length === SIZE * SIZE, 'block grid is 8x8');
assert(canPlace(blockGrid, [[0, 0], [0, 1]], 0, 6), 'horizontal piece fits at the edge');
assert(!canPlace(blockGrid, [[0, 0], [0, 1]], 0, 7), 'piece cannot hang off the board');
const occupied = place(blockGrid, [[0, 0]], 0, 0, 1);
assert(occupied && occupied[0] === 1, 'place writes a colour');
assert(place(occupied, [[0, 0]], 0, 0, 2) === null, 'overlap is refused');

const row = emptyGrid();
for (let c = 0; c < SIZE; c++) row[cellIndex(0, c)] = 2;
const clearedRow = clearLines(row);
assert(clearedRow.rows.length === 1 && clearedRow.cols.length === 0, 'a full row clears');
assert(clearedRow.grid.every(function (n) { return n === 0; }), 'cleared row is empty');

const col = emptyGrid();
for (let r = 0; r < SIZE; r++) col[cellIndex(r, 3)] = 3;
const clearedCol = clearLines(col);
assert(clearedCol.cols.length === 1 && clearedCol.rows.length === 0, 'a full column clears');

const both = emptyGrid();
for (let i = 0; i < SIZE; i++) {
  both[cellIndex(1, i)] = 1;
  both[cellIndex(i, 1)] = 1;
}
const clearedBoth = clearLines(both);
assert(clearedBoth.rows.length === 1 && clearedBoth.cols.length === 1, 'row and column clear together');
assert(lineScore(1) === SIZE && lineScore(2) === SIZE * 2 + 10, 'line score');

const stuck = emptyGrid();
for (let i = 0; i < stuck.length; i++) stuck[i] = 1;
stuck[cellIndex(7, 7)] = 0;
const stuckPieces = [
  { cells: [[0, 0], [0, 1]], color: 1, used: false },
  { cells: [[0, 0]], color: 2, used: true },
  { cells: [[0, 0], [1, 0]], color: 3, used: false },
];
assert(!anyPieceFits(stuck, stuckPieces), 'game ends when no remaining piece fits');
assert(anyPieceFits(stuck, [{ cells: [[0, 0]], color: 1, used: false }]), 'a single square still fits in a gap');

let roll = 0;
const dealt = dealPieces(function () {
  roll += 0.17;
  return roll % 1;
});
assert(dealt.length === 3, 'a deal is three pieces');
dealt.forEach(function (piece) {
  assert(piece.cells.length > 0 && piece.color >= 1 && piece.color <= 5 && piece.used === false, 'dealt piece shape');
});
const dealIds = dealt.map(function (piece) { return piece.id; });
assert(new Set(dealIds).size === 3, 'a deal tries not to repeat a shape');
const near = snapAnchor(emptyGrid(), [[0, 0]], 0.1, 0.2);
assert(near && near.row === 0 && near.col === 0, 'a drop near a cell snaps to that cell');
const rounded = snapAnchor(emptyGrid(), [[0, 0]], 2.1, 2.2);
assert(rounded && rounded.row === 2 && rounded.col === 2, 'snap uses the nearest cell when it is free');
const blocked = emptyGrid();
blocked[cellIndex(2, 2)] = 1;
const beside = snapAnchor(blocked, [[0, 0]], 2.1, 2.1);
assert(beside && canPlace(blocked, [[0, 0]], beside.row, beside.col), 'snap moves off a filled cell');
assert(!(beside.row === 2 && beside.col === 2), 'snap does not choose the filled cell');
assert(Math.abs(beside.row - 2.1) <= 1.5 && Math.abs(beside.col - 2.1) <= 1.5, 'snap stays within reach');
const wide = [[0, 0], [0, 1]];
const nudged = snapAnchor(emptyGrid(), wide, 0, 7.4);
assert(nudged && nudged.row === 0 && nudged.col === 6, 'a piece hanging off the edge slides back to a free spot');
assert(snapAnchor(emptyGrid(), wide, 0, 7.9) === null, 'a drop too far from any free spot does not snap');
const covered = anchorCovering(emptyGrid(), [[0, 0], [0, 1], [0, 2]], 0, 7);
assert(covered && covered.row === 0 && covered.col === 5, 'a tap on the right edge still covers that cell');
const pair = anchorCovering(emptyGrid(), [[0, 0], [0, 1]], 0, 7);
assert(pair && pair.row === 0 && pair.col === 6, 'a two-cell piece shifts just enough to stay on the board');
const exactTap = anchorCovering(emptyGrid(), [[0, 0], [0, 1], [0, 2]], 0, 2);
assert(exactTap && exactTap.row === 0 && exactTap.col === 2, 'a tap that already fits stays put');
console.log('blocks: clear, place, game over, deal, snap');

const idiomFile = JSON.parse(readFileSync(join(root, 'data/chengyu/idioms.json'), 'utf8'));
const puzzleFile = JSON.parse(readFileSync(join(root, 'data/chengyu/puzzles.json'), 'utf8'));
assert(idiomFile.schemaVersion === 1 && puzzleFile.schemaVersion === 1, 'chengyu schemaVersion');
const idiomIds = new Set();
idiomFile.idioms.forEach(function (idiom) {
  assert(idiom.id && !idiomIds.has(idiom.id), 'idiom id ' + idiom.id);
  idiomIds.add(idiom.id);
  assert([...idiom.text].length === 4, idiom.id + ' is four characters');
  assert(idiom.meaning && idiom.meaning.length >= 4, idiom.id + ' meaning');
});
const byId = indexIdioms(idiomFile.idioms);
const counts = { easy: 0, medium: 0, hard: 0 };
const puzzleIds = new Set();
puzzleFile.puzzles.forEach(function (puzzle) {
  assert(puzzle.id && !puzzleIds.has(puzzle.id), 'puzzle id ' + puzzle.id);
  puzzleIds.add(puzzle.id);
  counts[puzzle.difficulty] = (counts[puzzle.difficulty] || 0) + 1;
  const built = inspectPuzzle(puzzle, byId);
  assert(built.issues.length === 0, puzzle.id + ' ' + built.issues.join('; '));
  const answers = new Map();
  built.board.cells.forEach(function (cell) { answers.set(cell.key, cell.answer); });
  assert(puzzleSolved(built.board, function (key) { return answers.get(key); }), puzzle.id + ' solves when filled');
  const blanks = built.board.cells.filter(function (cell) { return !cell.given; }).length;
  if (puzzle.difficulty === 'easy') assert(blanks <= 6, puzzle.id + ' easy stays generous');
  if (puzzle.difficulty === 'hard') assert(built.board.entries.length >= 5 && blanks >= 10, puzzle.id + ' hard is a fuller grid');
});
assert(counts.easy === 4 && counts.medium === 4 && counts.hard === 4, 'four puzzles per difficulty ' + JSON.stringify(counts));
console.log('chengyu: 4 easy, 4 medium, 4 hard');

const cardCheck = spawnSync(process.execPath, ['--test', 'scripts/check-wordcards.js'], {
  cwd: root,
  encoding: 'utf8',
});
if (cardCheck.stdout) process.stdout.write(cardCheck.stdout);
if (cardCheck.status !== 0) {
  if (cardCheck.stderr) process.stderr.write(cardCheck.stderr);
  failed += 1;
}

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('All checks passed');
