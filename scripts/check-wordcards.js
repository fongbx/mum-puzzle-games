// Checks the picture word cards and the question / review rules.
// Run: node --test scripts/check-wordcards.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAY_IDS,
  LOOKALIKE_GROUPS,
  NUMBER_VALUE,
  applyResult,
  buildQuestion,
  buildRound,
  exampleWordCount,
  firmCount,
  noteAnswer,
  pictureKind,
  selectReviewIds,
  toggleKnown,
  violatesLookalike,
} from '../js/wordcards-core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/english/wordcards.json'), 'utf8'));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function words() {
  return data.packs.flatMap(function (pack) { return pack.words; });
}

test('241 words in 15 packs', () => {
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.packs.length, 15);
  assert.equal(words().length, 241);
  const ids = words().map(function (word) { return word.id; });
  assert.equal(new Set(ids).size, 241);
  data.packs.forEach(function (pack) {
    assert.ok(pack.id && pack.name_zh && pack.name_en);
    assert.ok(pack.words.length >= 7);
  });
});

test('every word has a short example and a Chinese meaning', () => {
  words().forEach(function (word) {
    assert.ok(word.word, word.id + ' word');
    assert.ok(word.zh && word.zh.trim(), word.id + ' zh');
    assert.ok(word.example_zh && word.example_zh.trim(), word.id + ' example_zh');
    const count = exampleWordCount(word.example_en);
    assert.ok(count >= 1 && count <= 8, word.id + ' example has ' + count + ' words');
  });
});

test('photo packs have a picture, a thumb, and UK audio', () => {
  data.packs.forEach(function (pack) {
    const kind = pictureKind(pack.id);
    pack.words.forEach(function (word) {
      const audio = join(root, 'assets/wordcards/audio/uk', word.id + '.mp3');
      assert.ok(existsSync(audio) && statSync(audio).size > 1000, word.id + ' audio');
      if (kind === 'photo') {
        const img = join(root, 'assets/wordcards/img', word.id + '.webp');
        const thumb = join(root, 'assets/wordcards/thumb', word.id + '.webp');
        assert.ok(existsSync(img) && statSync(img).size > 200, word.id + ' img');
        assert.ok(existsSync(thumb) && statSync(thumb).size > 200, word.id + ' thumb');
      }
      if (kind === 'svg') {
        const svgPath = join(root, 'assets/wordcards/img', word.id + '.svg');
        assert.ok(existsSync(svgPath), word.id + ' svg');
        const text = readFileSync(svgPath, 'utf8');
        assert.ok(statSync(svgPath).size < 3072, word.id + ' svg size');
        assert.match(text, /viewBox="0 0 512 512"/);
        assert.equal(/<text[\s>]/i.test(text), false, word.id + ' has text');
      }
    });
  });
});

test('days and numbers are drawn in the app, not stored as images', () => {
  assert.deepEqual(data.packs[11].words.map(function (word) { return word.id; }), DAY_IDS);
  data.packs[12].words.forEach(function (word) {
    assert.equal(NUMBER_VALUE[word.id] > 0, true);
  });
  assert.equal(pictureKind('pack12'), 'day');
  assert.equal(pictureKind('pack13'), 'number');
  assert.equal(pictureKind('pack01'), 'photo');
  assert.equal(pictureKind('pack15'), 'svg');
});

test('a question has 3 distinct options and one correct answer from the pack', () => {
  data.packs.forEach(function (pack) {
    const ids = pack.words.map(function (word) { return word.id; });
    pack.words.forEach(function (word) {
      for (let seed = 1; seed <= 12; seed++) {
        const question = buildQuestion(word.id, ids, mulberry32(seed));
        assert.equal(question.optionIds.length, 3);
        assert.equal(new Set(question.optionIds).size, 3);
        assert.equal(question.optionIds.filter(function (id) { return id === word.id; }).length, 1);
        question.optionIds.forEach(function (id) {
          assert.ok(ids.includes(id));
        });
        assert.equal(violatesLookalike(question.optionIds), false, word.id + ' lookalike');
      }
    });
  });
});

test('a round does not repeat a word, and a miss comes back only once', () => {
  const pack = data.packs[0];
  const ids = pack.words.map(function (word) { return word.id; });
  const round = buildRound(ids, function () { return ids; }, mulberry32(4));
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map(function (q) { return q.correctId; })).size, 10);
  const queue = round.map(function (q) {
    return { correctId: q.correctId, optionIds: q.optionIds, repeat: false, mode: 'picture' };
  });
  const first = noteAnswer(queue, 0, false);
  assert.equal(first.requeued, true);
  assert.equal(first.queue.length, 11);
  assert.equal(first.queue[3].correctId, queue[0].correctId);
  assert.equal(first.queue[3].repeat, true);
  const second = noteAnswer(first.queue, 3, false);
  assert.equal(second.requeued, false);
  assert.equal(second.queue.length, 11);
  const right = noteAnswer(queue, 0, true);
  assert.equal(right.requeued, false);
  assert.equal(right.queue.length, 10);
});

test('review boxes move up when right and reset when wrong', () => {
  const today = '2026-10-26';
  const first = applyResult(null, true, today);
  assert.deepEqual(first, { box: 1, due: '2026-10-27' });
  assert.deepEqual(applyResult(first, true, today), { box: 2, due: '2026-10-29' });
  assert.deepEqual(applyResult({ box: 2, due: today }, true, today), { box: 3, due: '2026-11-02' });
  assert.deepEqual(applyResult({ box: 3, due: today }, true, today), { box: 3, due: '2026-11-02' });
  assert.deepEqual(applyResult({ box: 3, due: today }, false, today), { box: 0, due: '2026-10-27' });
});

test('review picks due words before new ones and skips future ones', () => {
  const ids = [];
  for (let i = 0; i < 20; i++) ids.push('w' + i);
  const records = {
    w0: { box: 1, due: '2026-10-20' },
    w1: { box: 2, due: '2026-11-01' },
  };
  for (let seed = 1; seed <= 20; seed++) {
    const picked = selectReviewIds(ids, records, '2026-10-26', 10, mulberry32(seed));
    assert.equal(picked.length, 10);
    assert.ok(picked.includes('w0'));
    assert.equal(picked.includes('w1'), false);
    assert.equal(new Set(picked).size, 10);
  }
  const known = { apple: true, rice: true };
  assert.deepEqual(toggleKnown(known, 'apple'), { rice: true });
  assert.equal(toggleKnown(known, 'tea').tea, true);
  assert.equal(firmCount(['w0', 'w1', 'w2'], {
    w0: { box: 1 },
    w1: { box: 2 },
    w2: { box: 3 },
  }), 2);
});

test('symptom pictures are not shown together', () => {
  const clinic = data.packs.find(function (pack) { return pack.id === 'pack14'; });
  const ids = clinic.words.map(function (word) { return word.id; });
  LOOKALIKE_GROUPS[0].forEach(function (id) {
    for (let seed = 1; seed <= 30; seed++) {
      const question = buildQuestion(id, ids, mulberry32(seed));
      const hits = question.optionIds.filter(function (option) {
        return LOOKALIKE_GROUPS[0].includes(option);
      });
      assert.equal(hits.length, 1, id + ' ' + question.optionIds.join(','));
    }
  });
});
