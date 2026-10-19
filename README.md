# Mum's little games (妈妈的小游戏)

A small ad-free puzzle app for Mum in Singapore. It runs in the browser, can be installed on a phone, and keeps working offline after the first visit. There is no account, no ads, and no analytics. Scores stay on the phone.

## What's inside

- **数独 Sudoku** — classic 9×9, Easy (简单) and Medium (中等). Notes, undo, clear, row / column / box highlight, and a mistake-marking switch. The phone makes a new puzzle itself, so it does not need the internet.
- **学英语 English lessons** — a short path of lessons. Unit 1 is Everyday Singapore (新加坡日常生活): the hawker centre, getting around, and the clinic. Each lesson shows a few words, then exercises (multiple choice, matching pairs, fill the blank). Wrong answers are just another chance to remember. Stars and a quiet streak stay on the phone.
- **方块 Blocks** and **成语 Idioms** — buttons on the home screen for later. They say 即将推出 and do not open a broken page.

English content is local JSON in `data/english/`. Unit 1 is `unit-01-daily-life.json`. The app does not use a flat word list.

Speaking a word out loud is not in v1. `audioHint` is only a pronunciation spelling on the word card (for example `TAKE-a-way`). The app does not call a speech service.

## Run it on your computer

Open a terminal in this folder and start a tiny web server. Opening the HTML file directly will not turn on the offline install.

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

`npm start` does the same thing if you have npm. You do not need to install packages. There is no build step.

Optional check for the puzzle maker and the English lessons:

```bash
node scripts/check-sudoku.js
```

## Add to Home Screen (Android Chrome)

Do this once while the phone is online, and wait until the home page has finished loading.

1. Open the site in **Chrome** (not the Play Store).
2. Tap the **three dots** at the top right.
3. Tap **Add to Home screen** or **Install app**.
4. Confirm. An icon named **小游戏** appears on the home screen.
5. Next time, open it from that icon. After this first visit, Sudoku and the English lessons work with no internet.

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
- `english.html`, `js/english.js`, `data/english/` — English lesson path and unit files
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

## Not in v1

- Block / line-clear game
- 成语 game
- Offline pronunciation (recorded audio or an on-device voice, without a third-party speech service)
