# Mum's little games (妈妈的小游戏)

A small ad-free puzzle app for Mum in Singapore. It runs in the browser, can be installed on a phone, and keeps working offline after the first visit. There is no account, no ads, and no analytics. Scores stay on the phone.

## What's inside

- **数独 Sudoku** — classic 9×9, Easy (简单) and Medium (中等). Notes, undo, clear, row / column / box highlight, and a mistake-marking switch. The phone makes a new puzzle itself, so it does not need the internet.
- **方块 Blocks** — place one of three pieces on an 8×8 board. A full row or column clears. There is no timer. Drag a piece, or tap it and then tap the board. Score and best score stay on the phone, along with the current round and one undo.
- **学英语 English lessons** — a short path of lessons, plus 看图学词 (picture word cards). Unit 1 is Everyday Singapore (新加坡日常生活): the hawker centre, getting around, and the clinic. Each lesson shows a few words, then exercises (multiple choice, matching pairs, fill the blank). Wrong answers are just another chance to remember. Stars and a quiet streak stay on the phone. The picture cards are 15 packs (241 words): a big picture, a spoken UK word, two short games, and a gentle daily review.
- **成语 Idioms** — a crossword of real four-character idioms. Tap a blank, then tap a character. 简单, 中等, and 困难 each have four levels; the next level unlocks when the one before it is finished. A finished idiom shows a short meaning. Hint reveals one character.

English content is local JSON in `data/english/`. Unit 1 is `unit-01-daily-life.json`. The app does not use a flat word list.

Speaking a word out loud is not in v1. `audioHint` is only a pronunciation spelling on the word card (for example `TAKE-a-way`). The app does not call a speech service.

## Run it on your computer

Open a terminal in this folder and start a tiny web server. Opening the HTML file directly will not turn on the offline install.

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

`npm start` does the same thing if you have npm. You do not need to install packages. There is no build step.

Optional check for Sudoku, Blocks, the English lessons, the idiom crossword, and the picture word cards:

```bash
node scripts/check-sudoku.js
```

## Add to Home Screen (Android Chrome)

Do this once while the phone is online, and wait until the home page has finished loading.

1. Open the site in **Chrome** (not the Play Store).
2. Tap the **three dots** at the top right.
3. Tap **Add to Home screen** or **Install app**.
4. Confirm. An icon named **小游戏** appears on the home screen.
5. Next time, open it from that icon. After this first visit, Sudoku, Blocks, idioms, the English lessons, and the picture word cards work with no internet.

If you change the app later, open it once while online, then open it again. The phone updates its saved copy in the background.

## 给妈妈：安装到手机桌面

用安卓手机的 Chrome 做一次就好。第一次要有网络，等页面加载完。

1. 用 Chrome 打开这个网页。
2. 点右上角 **三个点**。
3. 点 **「添加到主屏幕」** 或 **「安装应用」**。
4. 确认。桌面会出现 **「小游戏」**。
5. 以后点这个图标就能玩。没有网络也可以。

如果是 iPhone：用 Safari 打开，点底部分享按钮，再点「添加到主屏幕」。

## Deploy later

Any static host is enough. There is no backend and there should never be one for this app.

**GitHub Pages**

1. Push the repository.
2. Settings → Pages → Deploy from a branch → `main` → folder `/ (root)`.
3. Open the Pages address on the phone and install it with the steps above.

The address will look like `https://<user>.github.io/<repo>/`. Paths in this project are relative, so a project site still works. `.nojekyll` is included so Pages serves every file as-is.

HTTPS is required for the offline install (localhost is fine for testing). Do not put secrets in this repo; there are none.

## Where to look

- `index.html` — home screen
- `sudoku.html`, `js/sudoku.js`, `js/sudoku-core.js` — the game and the puzzle maker
- `blocks.html`, `js/blocks.js`, `js/blocks-core.js` — the block / line-clear game
- `chengyu.html`, `js/chengyu.js`, `js/chengyu-core.js`, `data/chengyu/` — the idiom crossword
- `english.html`, `js/english.js`, `data/english/` — English lesson path and unit files
- `wordcards.html`, `js/wordcards.js`, `js/wordcards-core.js`, `data/english/wordcards.json`, `assets/wordcards/` — picture word cards
- `sw.js`, `manifest.webmanifest`, `icons/` — install and offline cache
- `css/app.css` — colours and layout, including high contrast (对比)

## English lesson files

The course index is `data/english/index.json`:

```json
{ "schemaVersion": 1, "units": ["unit-01-daily-life.json"] }
```

Each name in `units` is a file in the same folder. To add Unit 2 later, drop in another JSON file and add its filename to that list. Keep `schemaVersion` at `1` until the app is updated for a new schema. The starter unit id is `u01` (Everyday Singapore / 新加坡日常生活, level `elementary`).

A unit file looks like this:

```json
{
  "schemaVersion": 1,
  "units": [
    {
      "id": "u01",
      "title": "Everyday Singapore",
      "titleChinese": "新加坡日常生活",
      "level": "elementary",
      "lessons": [
        {
          "id": "u01-l01",
          "title": "At the hawker centre",
          "titleChinese": "在小贩中心",
          "vocab": [
            {
              "id": "v-takeaway",
              "english": "takeaway",
              "chinese": "打包",
              "audioHint": "TAKE-a-way",
              "exampleSentence": "One chicken rice, takeaway please.",
              "exampleChinese": "一份鸡饭，打包，谢谢。"
            }
          ],
          "exercises": []
        }
      ]
    }
  ]
}
```

`level` may be `beginner` (shown as 入门) or `elementary` (shown as 初级). `audioHint`, `exampleSentence`, and `exampleChinese` are optional.

Exercises use one of three `type` values.

**multipleChoice** — `prompt`, `promptLanguage` (`chinese` or `english`), `options`, `answer`. `answer` must be one of `options`. Optional `promptChinese` is the Chinese wording of an English question.

**matchPairs** — `pairs` is a list of `[english, chinese]` pairs.

**fillIn** — `sentence` contains `___`, plus `sentenceChinese`, `options`, and `answer`. `answer` must be one of `options`.

Lesson ids and exercise ids should stay unique. The phone remembers finished lessons, the current lesson, stars, and the streak in `localStorage`. There is no account and no network call.

## 成语 crossword files

The bank is `data/chengyu/idioms.json`. The layouts are `data/chengyu/puzzles.json`. Both use `schemaVersion` 1. To add a level later, add any new idiom to the bank, then add a puzzle. Keep every idiom's characters and meaning checked by hand. `node scripts/check-sudoku.js` rejects a puzzle if a crossing disagrees, if an idiom is missing from the bank, or if a distractor is already used in that puzzle.

An idiom looks like this:

```json
{
  "id": "yixin-yiyi",
  "text": "一心一意",
  "meaning": "心思都放在一件事情上。",
  "example": "她一心一意照顾家人。"
}
```

`text` is exactly four characters. `meaning` is a short explanation in plain Chinese. `example` is optional.

A puzzle looks like this:

```json
{
  "id": "easy-1",
  "difficulty": "easy",
  "order": 1,
  "entries": [
    { "idiomId": "yixin-yiyi", "dir": "across", "row": 0, "col": 0 },
    { "idiomId": "yifan-fengshun", "dir": "down", "row": 0, "col": 0 }
  ],
  "givens": [[0, 0], [2, 0]],
  "distractors": ["马", "人"]
}
```

`difficulty` is `easy` (简单), `medium` (中等), or `hard` (困难). `dir` is `across` or `down`. The idiom's first character sits at `row` and `col`. `givens` are cells that start filled. Each idiom needs at least one given cell and one blank. `distractors` are extra characters in the tray. They must not already appear in that puzzle. Within one difficulty, level 1 is open, and the next level unlocks when the previous one is finished. Progress stays in `localStorage`.

## Picture word cards

The list is `data/english/wordcards.json` with `schemaVersion` 1. It has `packs`. Each pack has `id`, `name_zh`, `name_en`, and `words`. A word has `id`, `word`, `zh`, `example_en` (8 words or fewer), and `example_zh`. Packs open in any order. Progress stays in `localStorage` (`mum.wordcards.progress`): each word has a review box from 0 to 3. A right answer moves the box up. A wrong answer puts it back at 0 until the next day. Box 1 waits 1 day, box 2 waits 3 days, box 3 waits 7 days. 今日复习 mixes up to 10 words that are new or due.

To add a photo pack, add the pack to that file and add three files for every new word:

- `assets/wordcards/img/<id>.webp`
- `assets/wordcards/thumb/<id>.webp`
- `assets/wordcards/audio/uk/<id>.mp3`

Then add those paths to the list in `sw.js`. Days (`pack12`) and numbers (`pack13`) are drawn in the page, so they need only the audio file. Clinic and Singapore pictures are SVG files in `assets/wordcards/img/`. Words that would be confusing side by side (headache, stomachache, pain, cough, dizzy) are kept out of the same question. The groups live in `js/wordcards-core.js`.

`node scripts/check-wordcards.js` checks the words, the files, the questions, and the review boxes. `npm test` runs that together with the other checks.

Pictures and recordings for the first 11 packs are from Word Atlas (CC BY 4.0). See `assets/wordcards/CREDITS.md`. Packs 12–15 were made for this app. Example sentences have no recording.

## Not in this version

- Spoken example sentences. The word itself plays from a saved recording. A sentence would need an offline voice on the phone, with no third-party speech service.
- The lesson path still shows `audioHint` as spelling only. It does not play audio.
