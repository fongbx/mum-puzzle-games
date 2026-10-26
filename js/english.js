// Lesson path for 学英语. Content comes from data/english/index.json
// and the unit files it lists. Progress stays in localStorage.

import { KEYS, bindContrast, readJson, writeJson } from './settings.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const pathView = document.getElementById('path-view');
const lessonView = document.getElementById('lesson-view');
const pathEl = document.getElementById('path');
const stage = document.getElementById('stage');
const stepLabel = document.getElementById('step-label');
const live = document.getElementById('live');
const primary = document.getElementById('primary-action');
const secondary = document.getElementById('secondary-action');
const back = document.getElementById('back');
const pathNote = document.getElementById('path-note');

let course = [];
let progress = { v: 1, stars: 0, streak: 0, bestStreak: 0, lessons: {}, current: null };
let screen = 'path';
let active = null;
let exerciseIndex = 0;
let locked = false;
let runCorrect = 0;
let runTotal = 0;
let starsAtStart = 0;
let matchToken = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

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

function levelLabel(level) {
  if (level === 'beginner') return '入门';
  if (level === 'elementary') return '初级';
  return '';
}

function loadProgress() {
  const raw = readJson(KEYS.english, {});
  progress = {
    v: 1,
    stars: raw.stars | 0,
    streak: raw.streak | 0,
    bestStreak: raw.bestStreak | 0,
    lessons: raw.lessons && typeof raw.lessons === 'object' ? raw.lessons : {},
    current: raw.current && raw.current.lessonId ? raw.current : null,
  };
}

function saveProgress() {
  writeJson(KEYS.english, progress);
}

function renderStats() {
  document.getElementById('stars').textContent = '星星 ' + (progress.stars | 0);
  const streak = document.getElementById('streak');
  if (progress.streak >= 2) {
    streak.hidden = false;
    streak.textContent = '连续 ' + progress.streak;
  } else {
    streak.hidden = true;
    streak.textContent = '';
  }
}

function say(text) {
  live.textContent = text || '';
}

function findLesson(id) {
  for (let u = 0; u < course.length; u++) {
    const lessons = course[u].lessons || [];
    for (let i = 0; i < lessons.length; i++) {
      if (lessons[i].id === id) return { unit: course[u], lesson: lessons[i], index: i };
    }
  }
  return null;
}

function isUnlocked(unit, index) {
  if (index === 0) {
    const unitIndex = course.indexOf(unit);
    if (unitIndex <= 0) return true;
    const prev = course[unitIndex - 1];
    const last = prev.lessons[prev.lessons.length - 1];
    return !!(last && progress.lessons[last.id] && progress.lessons[last.id].completed);
  }
  const prev = unit.lessons[index - 1];
  return !!(prev && progress.lessons[prev.id] && progress.lessons[prev.id].completed);
}

function lessonRecord(id) {
  return progress.lessons[id] || null;
}

function showPath() {
  screen = 'path';
  active = null;
  pathView.hidden = false;
  lessonView.hidden = true;
  back.setAttribute('href', './index.html');
  say('');
  renderPath();
}

function renderPath() {
  pathEl.textContent = '';
  course.forEach(function (unit, unitIndex) {
    const card = el('article', 'unit-card');
    const level = levelLabel(unit.level);
    card.appendChild(el('p', 'unit-kicker', '第 ' + (unitIndex + 1) + ' 单元' + (level ? ' · ' + level : '')));
    card.appendChild(el('h2', 'unit-title', unit.titleChinese || unit.title || '单元'));
    if (unit.title) card.appendChild(el('p', 'unit-en', unit.title));
    pathEl.appendChild(card);

    const list = el('ol', 'path');
    (unit.lessons || []).forEach(function (lesson, index) {
      const open = isUnlocked(unit, index);
      const done = lessonRecord(lesson.id) && lessonRecord(lesson.id).completed;
      const current = progress.current && progress.current.lessonId === lesson.id && !done;
      const item = el('li');
      const btn = el('button', 'lesson-node' + (done ? ' done' : '') + (open ? '' : ' locked'));
      btn.type = 'button';
      const badge = el('span', 'step-no', done ? '好' : String(index + 1));
      badge.setAttribute('aria-hidden', 'true');
      const text = el('span', 'lesson-text');
      text.appendChild(el('span', 'game-zh', lesson.titleChinese || lesson.title));
      text.appendChild(el('span', 'game-en', lesson.title || ''));
      const vocabCount = (lesson.vocab || []).length;
      const exerciseCount = (lesson.exercises || []).length;
      let status = '可以开始';
      if (!open) status = '先做完上一课';
      else if (done) status = '已完成';
      else if (current && progress.current.exerciseIndex >= 0) status = '做到第 ' + (progress.current.exerciseIndex + 1) + ' 题';
      else if (current) status = '继续这课';
      text.appendChild(el('span', 'hint', vocabCount + ' 个词 · ' + exerciseCount + ' 题 · ' + status));
      btn.appendChild(badge);
      btn.appendChild(text);
      btn.setAttribute('aria-disabled', open ? 'false' : 'true');
      btn.addEventListener('click', function () {
        if (!open) {
          pathNote.hidden = false;
          pathNote.textContent = '先做完上一课，再来这一课。';
          return;
        }
        pathNote.hidden = true;
        openLesson(unit, lesson, index, !!(current && progress.current.exerciseIndex >= 0));
      });
      item.appendChild(btn);
      list.appendChild(item);
    });
    pathEl.appendChild(list);
  });
}

function openLesson(unit, lesson, index, resume) {
  active = { unit: unit, lesson: lesson, index: index };
  pathView.hidden = true;
  lessonView.hidden = false;
  back.setAttribute('href', './english.html');
  if (resume) {
    exerciseIndex = progress.current.exerciseIndex | 0;
    if (exerciseIndex < 0 || exerciseIndex >= (lesson.exercises || []).length) exerciseIndex = 0;
    starsAtStart = progress.stars | 0;
    runCorrect = 0;
    runTotal = 0;
    showExercise();
    return;
  }
  exerciseIndex = 0;
  showVocab();
}

function rememberPlace() {
  if (!active) return;
  let index = screen === 'exercise' ? exerciseIndex : -1;
  if (screen !== 'exercise' && progress.current && progress.current.lessonId === active.lesson.id) {
    index = progress.current.exerciseIndex | 0;
  }
  progress.current = {
    lessonId: active.lesson.id,
    titleChinese: active.lesson.titleChinese || active.lesson.title || '',
    exerciseIndex: index,
  };
  saveProgress();
}

function showVocab() {
  screen = 'vocab';
  locked = false;
  const lesson = active.lesson;
  stepLabel.textContent = '先看这几个词';
  stage.textContent = '';
  say('');
  const list = el('div', 'vocab-list');
  (lesson.vocab || []).forEach(function (word) {
    const card = el('article', 'prompt-card vocab-card');
    card.appendChild(el('p', 'big-en', word.english || ''));
    card.appendChild(el('p', 'big-zh', word.chinese || ''));
    if (word.audioHint) card.appendChild(el('p', 'say', '读音 ' + word.audioHint));
    if (word.exampleSentence || word.exampleChinese) {
      const box = el('div', 'example-box');
      if (word.exampleSentence) box.appendChild(el('p', 'ex-en', word.exampleSentence));
      if (word.exampleChinese) box.appendChild(el('p', 'ex-zh', word.exampleChinese));
      card.appendChild(box);
    }
    list.appendChild(card);
  });
  stage.appendChild(list);
  const midway = progress.current && progress.current.lessonId === lesson.id && (progress.current.exerciseIndex | 0) >= 0;
  primary.hidden = false;
  primary.textContent = midway ? '继续练习' : '开始练习';
  secondary.hidden = true;
  rememberPlace();
}

function findVocab(answer) {
  const wanted = String(answer || '').trim().toLowerCase();
  const list = active && active.lesson.vocab ? active.lesson.vocab : [];
  for (let i = 0; i < list.length; i++) {
    const word = list[i];
    if (word.english && word.english.trim().toLowerCase() === wanted) return word;
    if (word.chinese && word.chinese === answer) return word;
  }
  return null;
}

function appendPrompt(parent, text, lang, long) {
  const node = el('p', long ? 'prompt-zh prompt-long' : 'prompt-zh', text);
  if (lang) node.lang = lang;
  parent.appendChild(node);
}

function appendSentence(parent, sentence, fill) {
  const line = el('p', 'sentence');
  line.lang = 'en';
  const parts = String(sentence || '').split('___');
  for (let i = 0; i < parts.length; i++) {
    line.appendChild(document.createTextNode(parts[i]));
    if (i < parts.length - 1) line.appendChild(el('span', 'blank', fill || '___'));
  }
  parent.appendChild(line);
}

function showExercise() {
  screen = 'exercise';
  locked = false;
  matchToken += 1;
  const lesson = active.lesson;
  const exercises = lesson.exercises || [];
  const exercise = exercises[exerciseIndex];
  stage.textContent = '';
  say('');
  secondary.hidden = false;
  secondary.textContent = '先看单词';
  if (!exercise) {
    finishLesson();
    return;
  }
  stepLabel.textContent = '第 ' + (exerciseIndex + 1) + ' / ' + exercises.length + ' 题';
  primary.hidden = true;
  rememberPlace();
  if (exercise.type === 'multipleChoice') renderChoice(exercise);
  else if (exercise.type === 'matchPairs') renderMatch(exercise);
  else if (exercise.type === 'fillIn') renderFill(exercise);
  else renderUnknown(exercise);
}

function renderChoice(exercise) {
  const card = el('article', 'prompt-card');
  if (exercise.promptLanguage === 'chinese') {
    appendPrompt(card, exercise.prompt || '', 'zh-CN', false);
  } else if (exercise.promptChinese) {
    appendPrompt(card, exercise.promptChinese, 'zh-CN', false);
    appendPrompt(card, exercise.prompt || '', 'en', String(exercise.prompt || '').length > 18);
  } else {
    appendPrompt(card, exercise.prompt || '', 'en', String(exercise.prompt || '').length > 12);
  }
  stage.appendChild(card);
  const choices = el('div', 'choices');
  (exercise.options || []).forEach(function (option) {
    const btn = el('button', 'choice', option);
    btn.type = 'button';
    const optionsAreEnglish = exercise.promptLanguage === 'chinese' || !!exercise.promptChinese;
    if (optionsAreEnglish) btn.lang = 'en';
    btn.addEventListener('click', function () { gradeChoice(exercise, option, choices); });
    choices.appendChild(btn);
  });
  stage.appendChild(choices);
}

function gradeChoice(exercise, picked, choices) {
  if (locked) return;
  const correct = picked === exercise.answer;
  choices.querySelectorAll('button').forEach(function (btn) {
    if (btn.textContent === exercise.answer) btn.classList.add('correct');
    else if (btn.textContent === picked) btn.classList.add('wrongpick');
  });
  grade(correct, exercise.answer, null);
}

function renderFill(exercise) {
  const card = el('article', 'prompt-card');
  if (exercise.sentenceChinese) appendPrompt(card, exercise.sentenceChinese, 'zh-CN', false);
  appendSentence(card, exercise.sentence || '', '');
  stage.appendChild(card);
  const choices = el('div', 'choices');
  (exercise.options || []).forEach(function (option) {
    const btn = el('button', 'choice', option);
    btn.type = 'button';
    btn.lang = 'en';
    btn.addEventListener('click', function () { gradeFill(exercise, option, choices, card); });
    choices.appendChild(btn);
  });
  stage.appendChild(choices);
}

function gradeFill(exercise, picked, choices, card) {
  if (locked) return;
  const correct = picked === exercise.answer;
  choices.querySelectorAll('button').forEach(function (btn) {
    if (btn.textContent === exercise.answer) btn.classList.add('correct');
    else if (btn.textContent === picked) btn.classList.add('wrongpick');
  });
  const sentence = card.querySelector('.sentence');
  if (sentence) {
    sentence.textContent = '';
    appendSentence(sentence.parentNode, exercise.sentence || '', exercise.answer);
    sentence.parentNode.removeChild(sentence);
  }
  grade(correct, exercise.answer, exercise.sentenceChinese);
}

function renderMatch(exercise) {
  const pairs = (exercise.pairs || []).map(function (pair, index) {
    return { id: String(index), en: pair[0], zh: pair[1] };
  });
  const round = {
    en: shuffle(pairs).map(function (pair) { return { pair: pair, matched: false }; }),
    zh: shuffle(pairs).map(function (pair) { return { pair: pair, matched: false }; }),
    pick: null,
    mismatch: null,
    mistakes: 0,
  };
  const help = el('p', 'help', '点英文，再点中文');
  stage.appendChild(help);
  const board = el('div', 'match-board');
  stage.appendChild(board);

  function paint() {
    board.textContent = '';
    ['en', 'zh'].forEach(function (side) {
      const col = el('div', 'match-col');
      const label = el('p', 'col-label', side === 'en' ? 'English' : '中文');
      if (side === 'en') label.lang = 'en';
      col.appendChild(label);
      round[side].forEach(function (tile, index) {
        const btn = el('button', 'tile ' + side, side === 'en' ? tile.pair.en : tile.pair.zh);
        btn.type = 'button';
        if (side === 'en') btn.lang = 'en';
        if (tile.matched) btn.classList.add('matched');
        if (round.pick && round.pick.side === side && round.pick.index === index) btn.classList.add('selected');
        if (round.mismatch) {
          round.mismatch.forEach(function (mark) {
            if (mark.side === side && mark.index === index) btn.classList.add('mismatch');
          });
        }
        btn.addEventListener('click', function () { onTile(side, index); });
        col.appendChild(btn);
      });
      board.appendChild(col);
    });
  }

  function onTile(side, index) {
    if (locked) return;
    const tile = round[side][index];
    if (tile.matched) return;
    if (round.mismatch) {
      matchToken += 1;
      round.mismatch = null;
    }
    if (!round.pick || round.pick.side === side) {
      if (round.pick && round.pick.index === index) round.pick = null;
      else round.pick = { side: side, index: index };
      say('');
      paint();
      return;
    }
    const other = round[round.pick.side][round.pick.index];
    if (other.pair.id === tile.pair.id) {
      other.matched = true;
      tile.matched = true;
      round.pick = null;
      say(tile.pair.en + ' — ' + tile.pair.zh);
      const finished = round.en.every(function (item) { return item.matched; });
      paint();
      if (finished) grade(true, '', null);
      return;
    }
    round.mistakes += 1;
    round.mismatch = [
      { side: round.pick.side, index: round.pick.index },
      { side: side, index: index },
    ];
    round.pick = null;
    say('不是这一对，再看看');
    paint();
    const token = ++matchToken;
    setTimeout(function () {
      if (token !== matchToken || locked) return;
      round.mismatch = null;
      paint();
    }, 700);
  }

  paint();
}

function renderUnknown() {
  stage.appendChild(el('article', 'prompt-card', ''));
  stage.appendChild(el('p', 'help', '这题先跳过，下一题继续。'));
  primary.hidden = false;
  primary.textContent = '下一题';
  locked = true;
}

function grade(correct, answer, fallbackChinese) {
  locked = true;
  runTotal += 1;
  if (correct) {
    progress.streak += 1;
    if (progress.streak > progress.bestStreak) progress.bestStreak = progress.streak;
    progress.stars += 1;
    runCorrect += 1;
  } else {
    progress.streak = 0;
  }
  saveProgress();
  renderStats();
  const vocab = findVocab(answer);
  const box = el('article', 'feedback ' + (correct ? 'good' : 'learn'));
  box.appendChild(el('h2', '', correct ? '很好' : '记住这个就好'));
  const main = vocab ? vocab.english : answer;
  const sub = vocab ? vocab.chinese : (fallbackChinese || '');
  if (main) box.appendChild(el('p', 'big-en', main));
  if (sub) box.appendChild(el('p', 'big-zh', sub));
  if (vocab && (vocab.exampleSentence || vocab.exampleChinese)) {
    const example = el('div', 'example-box');
    if (vocab.exampleSentence) example.appendChild(el('p', 'ex-en', vocab.exampleSentence));
    if (vocab.exampleChinese) example.appendChild(el('p', 'ex-zh', vocab.exampleChinese));
    box.appendChild(example);
  }
  stage.appendChild(box);
  const last = exerciseIndex + 1 >= (active.lesson.exercises || []).length;
  primary.hidden = false;
  primary.textContent = last ? '完成本课' : '下一题';
  secondary.hidden = true;
  say(correct ? '很好' : '记住这个就好');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
}

function nextExercise() {
  exerciseIndex += 1;
  if (exerciseIndex >= (active.lesson.exercises || []).length) finishLesson();
  else showExercise();
}

function finishLesson() {
  screen = 'done';
  const id = active.lesson.id;
  progress.lessons[id] = {
    completed: true,
    correct: runCorrect,
    total: runTotal,
  };
  progress.current = null;
  saveProgress();
  const gained = (progress.stars | 0) - (starsAtStart | 0);
  stepLabel.textContent = active.lesson.titleChinese || '';
  stage.textContent = '';
  const card = el('article', 'feedback good');
  card.appendChild(el('h2', '', '这一课完成了'));
  card.appendChild(el('p', 'big-zh', gained > 0 ? '这次得到 ' + gained + ' 颗星' : '慢慢来就好'));
  card.appendChild(el('p', '', '可以休息，也可以再练一次。'));
  stage.appendChild(card);
  say('这一课完成了');
  primary.hidden = false;
  primary.textContent = '回到课程';
  secondary.hidden = false;
  secondary.textContent = '再练一次';
}

primary.addEventListener('click', function () {
  if (screen === 'vocab') {
    exerciseIndex = 0;
    starsAtStart = progress.stars | 0;
    runCorrect = 0;
    runTotal = 0;
    if (primary.textContent === '继续练习' && progress.current && (progress.current.exerciseIndex | 0) >= 0) {
      exerciseIndex = progress.current.exerciseIndex | 0;
    }
    showExercise();
    return;
  }
  if (screen === 'exercise') {
    nextExercise();
    return;
  }
  if (screen === 'done') showPath();
});

secondary.addEventListener('click', function () {
  if (screen === 'done' && active) {
    exerciseIndex = 0;
    starsAtStart = progress.stars | 0;
    runCorrect = 0;
    runTotal = 0;
    progress.current = null;
    saveProgress();
    showVocab();
    return;
  }
  if (screen === 'exercise' && active) showVocab();
});

back.addEventListener('click', function (event) {
  if (lessonView.hidden) return;
  event.preventDefault();
  if (screen === 'exercise' || screen === 'vocab') rememberPlace();
  showPath();
});

document.addEventListener('keydown', function (event) {
  if (screen !== 'exercise') return;
  if (locked && event.key === 'Enter') {
    primary.click();
    return;
  }
  if (locked) return;
  if (event.key < '1' || event.key > '9') return;
  const buttons = stage.querySelectorAll('.choices .choice');
  const button = buttons[Number(event.key) - 1];
  if (button) button.click();
});

async function main() {
  loadProgress();
  renderStats();
  try {
    const indexRes = await fetch('./data/english/index.json');
    if (!indexRes.ok) throw new Error('index');
    const index = await indexRes.json();
    if (!index || index.schemaVersion !== 1 || !Array.isArray(index.units)) throw new Error('index');
    const units = [];
    for (let i = 0; i < index.units.length; i++) {
      const name = index.units[i];
      if (typeof name !== 'string' || name.indexOf('/') !== -1 || name.indexOf('..') !== -1) throw new Error('file');
      const res = await fetch('./data/english/' + name);
      if (!res.ok) throw new Error(name);
      const pack = await res.json();
      if (!pack || pack.schemaVersion !== 1 || !Array.isArray(pack.units)) throw new Error(name);
      for (let u = 0; u < pack.units.length; u++) units.push(pack.units[u]);
    }
    if (!units.length) throw new Error('empty');
    course = units;
  } catch (e) {
    document.getElementById('loading-words').hidden = true;
    document.getElementById('load-error').hidden = false;
    return;
  }
  document.getElementById('loading-words').hidden = true;
  showPath();
}

main();
