// Pure rules for 看图学词: question building, look-alike pictures, and review boxes.
// The page and the check script both use this file. No browser APIs.

export const LOOKALIKE_GROUPS = [
  ['headache', 'stomachache', 'pain', 'cough', 'dizzy'],
];

export const DAY_IDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const NUMBER_VALUE = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const BOX_WAIT_DAYS = { 0: 1, 1: 1, 2: 3, 3: 7 };

export function pictureKind(packId) {
  if (packId === 'pack12') return 'day';
  if (packId === 'pack13') return 'number';
  if (packId === 'pack14' || packId === 'pack15') return 'svg';
  return 'photo';
}

export function exampleWordCount(sentence) {
  return String(sentence || '').trim().split(/\s+/).filter(Boolean).length;
}

export function shuffle(list, rng) {
  const copy = list.slice();
  const random = typeof rng === 'function' ? rng : Math.random;
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function addDays(isoDate, days) {
  const parts = String(isoDate).split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

export function todayIso(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export function violatesLookalike(ids, groups) {
  const list = groups || LOOKALIKE_GROUPS;
  for (let g = 0; g < list.length; g++) {
    const group = list[g];
    let hits = 0;
    for (let i = 0; i < ids.length; i++) {
      if (group.indexOf(ids[i]) !== -1) hits += 1;
    }
    if (hits > 1) return true;
  }
  return false;
}

export function buildQuestion(correctId, packIds, rng, groups) {
  const others = [];
  for (let i = 0; i < packIds.length; i++) {
    if (packIds[i] !== correctId) others.push(packIds[i]);
  }
  const order = shuffle(others, rng);
  const chosen = [];
  for (let i = 0; i < order.length && chosen.length < 2; i++) {
    const candidate = order[i];
    if (violatesLookalike([correctId].concat(chosen, [candidate]), groups)) continue;
    chosen.push(candidate);
  }
  if (chosen.length < 2) {
    throw new Error('not enough distractors for ' + correctId);
  }
  return {
    correctId: correctId,
    optionIds: shuffle([correctId].concat(chosen), rng),
    repeat: false,
    mode: 'picture',
  };
}

export function buildRound(targetIds, packIdsFor, rng, groups) {
  const seen = new Set();
  const questions = [];
  for (let i = 0; i < targetIds.length; i++) {
    const id = targetIds[i];
    if (seen.has(id)) continue;
    seen.add(id);
    if (questions.length >= 10) break;
    questions.push(buildQuestion(id, packIdsFor(id), rng, groups));
  }
  return questions;
}

export function withModes(questions, mode) {
  return questions.map(function (question, index) {
    let nextMode = mode;
    if (mode === 'mix') nextMode = index % 2 === 0 ? 'picture' : 'audio';
    return {
      correctId: question.correctId,
      optionIds: question.optionIds.slice(),
      repeat: !!question.repeat,
      mode: nextMode,
    };
  });
}

// A wrong answer is asked once more, a few questions later. A second miss stays missed.
export function noteAnswer(queue, index, correct) {
  const current = queue[index];
  const next = queue.slice();
  let requeued = false;
  if (!correct && current && !current.repeat) {
    next.splice(Math.min(index + 3, next.length), 0, {
      correctId: current.correctId,
      optionIds: current.optionIds.slice(),
      repeat: true,
      mode: current.mode,
    });
    requeued = true;
  }
  const nextIndex = index + 1;
  return {
    queue: next,
    index: nextIndex,
    requeued: requeued,
    done: nextIndex >= next.length,
  };
}

// Box 0 waits until the next session. This app treats that as the next calendar day.
export function applyResult(record, correct, today) {
  const box = record && Number.isInteger(record.box) ? Math.max(0, Math.min(3, record.box)) : 0;
  if (!correct) return { box: 0, due: addDays(today, BOX_WAIT_DAYS[0]) };
  const next = Math.min(3, box + 1);
  return { box: next, due: addDays(today, BOX_WAIT_DAYS[next]) };
}

export function selectReviewIds(allIds, records, today, limit, rng) {
  const due = [];
  const fresh = [];
  const book = records || {};
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    const rec = book[id];
    if (!rec) fresh.push(id);
    else if (String(rec.due) <= today) due.push(id);
  }
  const cap = limit == null ? 10 : limit;
  return shuffle(due, rng).concat(shuffle(fresh, rng)).slice(0, cap);
}

export function reviewPool(allIds, records, today) {
  let due = 0;
  let fresh = 0;
  const book = records || {};
  for (let i = 0; i < allIds.length; i++) {
    const rec = book[allIds[i]];
    if (!rec) fresh += 1;
    else if (String(rec.due) <= today) due += 1;
  }
  return { due: due, fresh: fresh, total: Math.min(10, due + fresh) };
}

export function firmCount(wordIds, records) {
  let count = 0;
  const book = records || {};
  for (let i = 0; i < wordIds.length; i++) {
    const rec = book[wordIds[i]];
    if (rec && rec.box >= 2) count += 1;
  }
  return count;
}

export function toggleKnown(known, id) {
  const next = Object.assign({}, known || {});
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
}
