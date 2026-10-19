import { KEYS, bindContrast, readJson } from './settings.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const save = readJson(KEYS.sudoku, null);
const stats = readJson(KEYS.stats, {});
const english = readJson(KEYS.english, {});

const sudokuHint = document.getElementById('sudoku-hint');
const sudokuHintEn = document.getElementById('sudoku-hint-en');
const saveOk = save && save.v === 1 && Array.isArray(save.values) && save.values.length === 81;

if (saveOk && !save.won) {
  const level = save.difficulty === 'medium' ? '中等' : '简单';
  const levelEn = save.difficulty === 'medium' ? 'Medium' : 'Easy';
  sudokuHint.textContent = '继续上次 · ' + level;
  sudokuHintEn.textContent = 'Continue · ' + levelEn;
} else {
  const solved = (stats.easy || 0) + (stats.medium || 0);
  if (solved > 0) {
    sudokuHint.textContent = '已完成 ' + solved + ' 题';
    sudokuHintEn.textContent = solved === 1 ? '1 puzzle finished' : solved + ' puzzles finished';
  }
}

const blocks = readJson(KEYS.blocks, null);
const blocksHint = document.getElementById('blocks-hint');
const blocksHintEn = document.getElementById('blocks-hint-en');
const blocksSaved = blocks && blocks.v === 1 && Array.isArray(blocks.grid) && blocks.grid.length === 64;
const blocksFresh = blocksSaved && (blocks.score | 0) === 0 && blocks.grid.every(function (n) { return !n; });
if (blocksSaved && !blocks.over && !blocksFresh) {
  blocksHint.textContent = '继续 · 分数 ' + (blocks.score | 0);
  blocksHintEn.textContent = 'Continue · score ' + (blocks.score | 0);
} else if (blocks && (blocks.best | 0) > 0) {
  blocksHint.textContent = '最高 ' + (blocks.best | 0);
  blocksHintEn.textContent = 'Best ' + (blocks.best | 0);
}

const stars = english.stars | 0;
const best = english.bestStreak | 0;
const lessonMap = english.lessons && typeof english.lessons === 'object' ? english.lessons : {};
const doneLessons = Object.keys(lessonMap).filter(function (id) {
  return lessonMap[id] && lessonMap[id].completed;
}).length;
const current = english.current;
const hint = document.getElementById('english-hint');
const hintEn = document.getElementById('english-hint-en');
if (current && current.lessonId && current.titleChinese && !(lessonMap[current.lessonId] && lessonMap[current.lessonId].completed)) {
  hint.textContent = '继续 · ' + current.titleChinese;
  hintEn.textContent = 'Continue';
} else if (doneLessons > 0) {
  hint.textContent = '已完成 ' + doneLessons + ' 课' + (stars ? ' · 星星 ' + stars : '');
  hintEn.textContent = doneLessons === 1 ? '1 lesson done' : doneLessons + ' lessons done';
} else if (stars > 0) {
  hint.textContent = '星星 ' + stars;
  hintEn.textContent = best >= 2 ? 'Best run ' + best : 'Stars ' + stars;
}

const soonNote = document.getElementById('soon-note');
document.querySelectorAll('.card-soon').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const name = btn.getAttribute('data-soon') || '这个游戏';
    soonNote.hidden = false;
    soonNote.textContent = '「' + name + '」即将推出';
  });
});
