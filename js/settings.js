// Small helpers shared by every page. Progress stays in localStorage on this phone.

export const KEYS = {
  settings: 'mum.settings',
  sudoku: 'mum.sudoku.game',
  stats: 'mum.sudoku.stats',
  english: 'mum.english.progress',
  wordcards: 'mum.wordcards.progress',
  blocks: 'mum.blocks.game',
  chengyu: 'mum.chengyu.progress',
};

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch (e) {
    // Ignore a broken save and keep playing.
  }
  return fallback;
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSettings() {
  const data = readJson(KEYS.settings, {});
  return {
    contrast: !!data.contrast,
    mistakes: data.mistakes !== false,
    difficulty: data.difficulty === 'medium' ? 'medium' : 'easy',
  };
}

export function saveSettings(next) {
  const prev = loadSettings();
  const merged = {
    contrast: prev.contrast,
    mistakes: prev.mistakes,
    difficulty: prev.difficulty,
  };
  if (next.contrast != null) merged.contrast = !!next.contrast;
  if (next.mistakes != null) merged.mistakes = !!next.mistakes;
  if (next.difficulty) merged.difficulty = next.difficulty === 'medium' ? 'medium' : 'easy';
  writeJson(KEYS.settings, merged);
  return merged;
}

export function bindContrast(button) {
  function paint() {
    const on = !!loadSettings().contrast;
    document.documentElement.classList.toggle('hc', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? '标准' : '对比';
    button.setAttribute('aria-label', on ? '关闭高对比' : '打开高对比');
  }
  paint();
  button.addEventListener('click', function () {
    const cur = loadSettings();
    saveSettings({ contrast: !cur.contrast });
    paint();
  });
}
