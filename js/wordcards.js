// 看图学词. Pictures and word recordings stay on the phone after the first visit.

import { KEYS, bindContrast, readJson, writeJson } from './settings.js';
import {
  DAY_IDS,
  NUMBER_VALUE,
  applyResult,
  buildRound,
  firmCount,
  pictureKind,
  reviewPool,
  selectReviewIds,
  shuffle,
  todayIso,
  toggleKnown,
  withModes,
  noteAnswer,
} from './wordcards-core.js';
import './pwa.js';

bindContrast(document.getElementById('contrast'));

const homeView = document.getElementById('home-view');
const cardView = document.getElementById('card-view');
const gameView = document.getElementById('game-view');
const creditsView = document.getElementById('credits-view');
const packsEl = document.getElementById('packs');
const reviewBtn = document.getElementById('review');
const reviewNote = document.getElementById('review-note');
const back = document.getElementById('back');
const cardPic = document.getElementById('card-pic');
const cardWord = document.getElementById('card-word');
const cardZh = document.getElementById('card-zh');
const cardEx = document.getElementById('card-ex');
const cardExZh = document.getElementById('card-ex-zh');
const cardKicker = document.getElementById('card-kicker');
const cardPlay = document.getElementById('card-play');
const knownBtn = document.getElementById('known');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const gameKicker = document.getElementById('game-kicker');
const gameCount = document.getElementById('game-count');
const gamePrompt = document.getElementById('game-prompt');
const gameOptions = document.getElementById('game-options');
const gameFeedback = document.getElementById('game-feedback');
const gameNext = document.getElementById('game-next');

const player = new Audio();
let packs = [];
let byId = new Map();
let packByWord = new Map();
let packById = new Map();
let allIds = [];
let progress = { v: 1, boxes: {}, known: {} };
let screen = 'home';
let packId = null;
let cardIndex = 0;
let round = null;
let touch = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function loadProgress() {
  const raw = readJson(KEYS.wordcards, {});
  progress = {
    v: 1,
    boxes: raw.boxes && typeof raw.boxes === 'object' ? raw.boxes : {},
    known: raw.known && typeof raw.known === 'object' ? raw.known : {},
  };
}

function saveProgress() {
  writeJson(KEYS.wordcards, progress);
}

function stopAudio() {
  player.pause();
}

function playWord(id) {
  stopAudio();
  player.src = './assets/wordcards/audio/uk/' + id + '.mp3';
  const started = player.play();
  if (started && started.catch) started.catch(function () {});
}

function show(name) {
  screen = name;
  homeView.hidden = name !== 'home';
  cardView.hidden = name !== 'card';
  gameView.hidden = name !== 'game';
  creditsView.hidden = name !== 'credits';
  if (name !== 'card' && name !== 'game') stopAudio();
}

function dayCard(word, hideWord) {
  const card = el('div', 'wc-daycard');
  card.setAttribute('role', 'img');
  card.setAttribute('aria-label', word.word);
  if (!hideWord) card.appendChild(el('p', 'wc-dayword', word.word));
  const strip = el('div', 'wc-daystrip');
  const labels = ['一', '二', '三', '四', '五', '六', '日'];
  const on = DAY_IDS.indexOf(word.id);
  labels.forEach(function (label, index) {
    const cell = el('span', 'wc-daycell' + (index === on ? ' on' : ''), label);
    if (index === on) cell.setAttribute('aria-current', 'date');
    strip.appendChild(cell);
  });
  card.appendChild(strip);
  return card;
}

function numberCard(word) {
  const count = NUMBER_VALUE[word.id] || 0;
  const card = el('div', 'wc-numcard');
  card.setAttribute('role', 'img');
  card.setAttribute('aria-label', word.word);
  card.appendChild(el('p', 'wc-numeral', String(count)));
  const dots = el('div', 'wc-dots n' + count);
  for (let i = 0; i < count; i++) dots.appendChild(el('span', 'wc-apple'));
  card.appendChild(dots);
  return card;
}

function renderPicture(word, pack, opts) {
  const options = opts || {};
  const kind = pictureKind(pack.id);
  if (kind === 'day') return dayCard(word, !!options.hideWord);
  if (kind === 'number') return numberCard(word);
  const img = document.createElement('img');
  img.className = 'wc-photo';
  img.alt = word.word;
  img.decoding = 'async';
  if (options.lazy) img.loading = 'lazy';
  if (kind === 'svg') img.src = './assets/wordcards/img/' + word.id + '.svg';
  else img.src = './assets/wordcards/' + (options.thumb ? 'thumb' : 'img') + '/' + word.id + '.webp';
  return img;
}

function renderHome() {
  const today = todayIso();
  const pool = reviewPool(allIds, progress.boxes, today);
  reviewBtn.querySelector('.game-zh').textContent = pool.total ? '今日复习 · ' + pool.total : '今日复习';
  reviewNote.textContent = pool.total
    ? '新的和该复习的，最多 10 个。'
    : '今天没有要复习的。先去看看词卡吧。';
  packsEl.textContent = '';
  packs.forEach(function (pack) {
    const btn = el('button', 'wc-pack');
    btn.type = 'button';
    const thumb = el('span', 'wc-pack-thumb');
    const kind = pictureKind(pack.id);
    thumb.appendChild(renderPicture(pack.words[0], pack, {
      lazy: kind === 'photo' || kind === 'svg',
      thumb: kind === 'photo',
      hideWord: true,
    }));
    const text = el('span', 'wc-pack-text');
    text.appendChild(el('span', 'game-zh', pack.name_zh));
    text.appendChild(el('span', 'game-en', pack.name_en));
    const firm = firmCount(pack.words.map(function (word) { return word.id; }), progress.boxes);
    const progressLine = el('span', 'wc-progress');
    progressLine.appendChild(el('span', 'wc-fraction', firm + '/' + pack.words.length));
    progressLine.appendChild(el('span', 'hint-en', '记得较熟 · know well'));
    text.appendChild(progressLine);
    btn.appendChild(thumb);
    btn.appendChild(text);
    btn.addEventListener('click', function () { openCard(pack.id, 0); });
    packsEl.appendChild(btn);
  });
}

function currentWord() {
  const pack = packById.get(packId);
  if (!pack) return null;
  return pack.words[cardIndex] || null;
}

function paintKnown(word) {
  const on = !!progress.known[word.id];
  knownBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  knownBtn.textContent = '';
  knownBtn.appendChild(el('span', null, on ? '已记住' : '我记住了'));
  knownBtn.appendChild(el('span', null, on ? 'I know this' : 'I know it'));
}

function openCard(id, index) {
  packId = id;
  const pack = packById.get(id);
  cardIndex = Math.max(0, Math.min(index, pack.words.length - 1));
  const word = pack.words[cardIndex];
  show('card');
  cardKicker.textContent = pack.name_zh + ' · ' + (cardIndex + 1) + ' / ' + pack.words.length;
  cardPic.textContent = '';
  cardPic.appendChild(renderPicture(word, pack, { hideWord: false }));
  cardWord.textContent = word.word;
  cardZh.textContent = word.zh;
  cardEx.textContent = word.example_en;
  cardExZh.textContent = word.example_zh;
  cardPlay.setAttribute('aria-label', '播放 ' + word.word);
  paintKnown(word);
  prevBtn.disabled = cardIndex === 0;
  nextBtn.disabled = cardIndex === pack.words.length - 1;
}

function stepCard(delta) {
  const pack = packById.get(packId);
  if (!pack) return;
  const next = cardIndex + delta;
  if (next < 0 || next >= pack.words.length) return;
  stopAudio();
  openCard(packId, next);
}

function beginRound(ids, mode, fromPack) {
  const questions = withModes(buildRound(ids, function (id) {
    return packByWord.get(id).words.map(function (word) { return word.id; });
  }, Math.random), mode);
  round = {
    queue: questions,
    index: 0,
    correctCount: 0,
    mode: mode,
    packId: fromPack,
    cardIndex: cardIndex,
    pending: null,
    phase: 'ask',
  };
  show('game');
  showQuestion();
}

function startPackGame(mode) {
  const pack = packById.get(packId);
  if (!pack) return;
  const ids = shuffle(pack.words.map(function (word) { return word.id; })).slice(0, 10);
  beginRound(ids, mode, pack.id);
}

function startReview() {
  const ids = selectReviewIds(allIds, progress.boxes, todayIso(), 10, Math.random);
  if (!ids.length) {
    reviewNote.textContent = '今天没有要复习的。先去看看词卡吧。';
    return;
  }
  beginRound(ids, 'mix', null);
}

function promptLine(question) {
  if (round.mode === 'mix') return question.mode === 'audio' ? '今日复习 · 听一听' : '今日复习 · 看一看';
  if (question.mode === 'audio') return '听音选图 · 点一下听读音';
  return '看图选词 · 这个是什么？';
}

function showQuestion() {
  const question = round.queue[round.index];
  const word = byId.get(question.correctId);
  const pack = packByWord.get(question.correctId);
  round.phase = 'ask';
  round.pending = null;
  gameKicker.textContent = promptLine(question);
  gameCount.textContent = '第 ' + (round.index + 1) + ' 题';
  gamePrompt.textContent = '';
  gameOptions.textContent = '';
  gameFeedback.textContent = '';
  gameFeedback.className = 'feedback';
  gameNext.hidden = true;
  if (question.mode === 'audio') {
    const play = el('button', 'wc-play');
    play.type = 'button';
    play.textContent = '▶';
    play.setAttribute('aria-label', '播放，可以再听');
    play.addEventListener('click', function () { playWord(word.id); });
    gamePrompt.appendChild(play);
    const label = el('p', 'wc-play-label');
    label.appendChild(el('span', null, '播放，可以再听'));
    label.appendChild(document.createElement('br'));
    label.appendChild(el('span', null, 'Play. You can listen again.'));
    gamePrompt.appendChild(label);
  } else {
    gamePrompt.appendChild(renderPicture(word, pack, { hideWord: true }));
  }
  question.optionIds.forEach(function (id) {
    const option = byId.get(id);
    const btn = el('button', question.mode === 'audio' ? 'wc-pic-btn' : 'choice wc-choice');
    btn.type = 'button';
    if (question.mode === 'audio') btn.appendChild(renderPicture(option, packByWord.get(id), { hideWord: false }));
    else btn.appendChild(el('span', 'wc-opt-word', option.word));
    btn.addEventListener('click', function () { onPick(id); });
    gameOptions.appendChild(btn);
  });
}

function onPick(id) {
  if (!round || round.phase !== 'ask') return;
  const question = round.queue[round.index];
  const correct = id === question.correctId;
  round.phase = 'reveal';
  progress.boxes[question.correctId] = applyResult(progress.boxes[question.correctId], correct, todayIso());
  saveProgress();
  if (correct) round.correctCount += 1;
  round.pending = noteAnswer(round.queue, round.index, correct);
  const buttons = gameOptions.querySelectorAll('button');
  buttons.forEach(function (btn) { btn.disabled = true; });
  question.optionIds.forEach(function (optionId, index) {
    const btn = buttons[index];
    if (optionId === question.correctId) {
      btn.classList.add('wc-yes');
      btn.appendChild(el('span', 'wc-badge', id === optionId ? '太棒了' : '这个'));
    } else if (optionId === id) {
      btn.classList.add('wc-no');
      btn.appendChild(el('span', 'wc-badge', '再试试'));
    }
  });
  gameFeedback.className = 'feedback ' + (correct ? 'good' : 'learn');
  gameFeedback.textContent = '';
  if (correct) {
    gameFeedback.appendChild(el('span', 'wc-fb-zh', '太棒了！'));
  } else {
    const word = byId.get(question.correctId);
    gameFeedback.appendChild(el('span', 'wc-fb-zh', '再试试'));
    gameFeedback.appendChild(el('span', 'wc-fb-detail', '这个是 ' + word.word + '（' + word.zh + '）'));
  }
  gameNext.hidden = false;
  gameNext.textContent = '';
  const last = round.pending.done;
  gameNext.appendChild(el('span', null, last ? '完成' : '下一题'));
  gameNext.appendChild(el('span', null, last ? 'Done' : 'Next'));
}

function showDone() {
  round.phase = 'done';
  gamePrompt.textContent = '';
  gameOptions.textContent = '';
  gameCount.textContent = '';
  gameKicker.textContent = '这组做完了';
  gameFeedback.className = 'feedback good';
  gameFeedback.textContent = '';
  gameFeedback.appendChild(el('span', 'wc-fb-zh', '这组做完了'));
  gameFeedback.appendChild(el('span', 'wc-fb-detail', '答对 ' + round.correctCount + ' 次'));
  gameNext.hidden = false;
  gameNext.textContent = '';
  gameNext.appendChild(el('span', null, '返回'));
  gameNext.appendChild(el('span', null, 'Back'));
}

function onGameNext() {
  if (!round) return;
  if (round.phase === 'done') {
    const backTo = round.packId;
    const index = round.cardIndex || 0;
    round = null;
    if (backTo) openCard(backTo, index);
    else {
      show('home');
      renderHome();
    }
    return;
  }
  if (!round.pending) return;
  const pending = round.pending;
  round.queue = pending.queue;
  round.index = pending.index;
  round.pending = null;
  if (pending.done) showDone();
  else showQuestion();
}

function showCredits() {
  show('credits');
}

function showHome() {
  round = null;
  show('home');
  renderHome();
}

reviewBtn.addEventListener('click', startReview);
document.getElementById('to-credits').addEventListener('click', showCredits);
cardPlay.addEventListener('click', function () {
  const word = currentWord();
  if (word) playWord(word.id);
});
knownBtn.addEventListener('click', function () {
  const word = currentWord();
  if (!word) return;
  progress.known = toggleKnown(progress.known, word.id);
  saveProgress();
  paintKnown(word);
});
prevBtn.addEventListener('click', function () { stepCard(-1); });
nextBtn.addEventListener('click', function () { stepCard(1); });
document.getElementById('to-picture').addEventListener('click', function () { startPackGame('picture'); });
document.getElementById('to-audio').addEventListener('click', function () { startPackGame('audio'); });
gameNext.addEventListener('click', onGameNext);

back.addEventListener('click', function (event) {
  if (screen === 'home') return;
  event.preventDefault();
  stopAudio();
  if (screen === 'game' && round && round.packId) {
    const id = round.packId;
    const index = round.cardIndex || 0;
    round = null;
    openCard(id, index);
    return;
  }
  showHome();
});

cardView.addEventListener('touchstart', function (event) {
  if (event.target.closest('button, a')) {
    touch = null;
    return;
  }
  const point = event.changedTouches[0];
  touch = { x: point.clientX, y: point.clientY };
}, { passive: true });

cardView.addEventListener('touchend', function (event) {
  if (!touch) return;
  const point = event.changedTouches[0];
  const dx = point.clientX - touch.x;
  const dy = point.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
  stepCard(dx < 0 ? 1 : -1);
}, { passive: true });

function openFromHash() {
  const parts = location.hash.replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'credits') return showCredits();
  if (parts[0] === 'card' && byId.has(parts[1])) {
    const pack = packByWord.get(parts[1]);
    return openCard(pack.id, pack.words.findIndex(function (word) { return word.id === parts[1]; }));
  }
  if (parts[0] === 'game' && packById.has(parts[1])) {
    packId = parts[1];
    cardIndex = 0;
    return startPackGame(parts[2] === 'audio' ? 'audio' : 'picture');
  }
  showHome();
}

window.addEventListener('hashchange', function () {
  if (byId.size) openFromHash();
});

async function boot() {
  loadProgress();
  try {
    const response = await fetch('./data/english/wordcards.json');
    const data = await response.json();
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.packs)) throw new Error('schema');
    packs = data.packs;
    packs.forEach(function (pack) {
      packById.set(pack.id, pack);
      pack.words.forEach(function (word) {
        byId.set(word.id, word);
        packByWord.set(word.id, pack);
        allIds.push(word.id);
      });
    });
    openFromHash();
  } catch (e) {
    document.getElementById('load-error').hidden = false;
    homeView.hidden = true;
  }
}

boot();
