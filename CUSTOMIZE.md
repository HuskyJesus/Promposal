# Making it yours

Everything you need to change lives in **one file**:

```
src/config.js
```

Open it in any text editor, change the text between the quote marks, save, and
reload the page. There is no build step — what you edit is what runs.

---

## The two lines most people change

```js
heroName: 'Kaleighia',   // who the story is for
authorName: 'Caius',     // who wrote it
```

`heroName` appears in dialogue and on the final page. `authorName` signs the
closing message.

---

## Every field, in order

### 1. Who the story is for

| Field | What it does |
| --- | --- |
| `heroName` | Her name. Used throughout the story. |
| `authorName` | Your name. Signs the last message. |
| `endearment` | A pet name, used sparingly so it lands. Set to `''` to switch it off. |
| `guideName` | The name of the small blue guide. Defaults to `Theo`. |

### 2. The final moment

| Field | What it does |
| --- | --- |
| `finalMessage` | The long message before the question. Leave a **blank line** between paragraphs. |
| `finalLeadIn` | The single italic line above the question. |
| `finalQuestion` | The question itself. |
| `finalResponseMessage` | Shown after she says yes. |
| `responseYesLabel` | Text on the warm button. |
| `responseTalkLabel` | Text on the second, equally kind button. |
| `showResponseChoices` | `false` replaces both buttons with a single "Close the book". |

### 3. Optional details

| Field | What it does |
| --- | --- |
| `promDate` | e.g. `'May 16th'`. Leave as `''` to hide. |
| `promLocation` | e.g. `'The Riverside Ballroom'`. Leave as `''` to hide. |
| `memories` | A list of small private moments. Each one is whispered by a flower on the closing page. Add or remove freely; an empty list `[]` hides the section. |

### 4. Colours

Inside `colors`, any CSS colour works — `'#f3e3c3'`, `'rebeccapurple'`,
`'rgb(20 30 40)'`. They drive both the interface and the artwork.

| Colour | Where you'll see it |
| --- | --- |
| `night` | The base tone of the whole game |
| `parchment` | Dialogue boxes and panels |
| `ink` | Text on parchment |
| `gold` | Lantern light, borders, sparkles |
| `rose` | Blossoms, hearts, the final page |
| `forest` | Deep greens |
| `guide` | Theo's blue |
| `silver` | Stars and the Monochrome Hall |

### 5. Title screen wording

`gameTitle` and `gameSubtitle` set the title screen, the browser tab and the
page metadata. **Keep these free of any mention of prom** — the surprise is
meant to arrive at the end, not in a browser tab or a link preview.

---

## Writing tips

* Anywhere in `config.js` — and anywhere in `src/data/dialogue.js` if you want
  to go further — you can write `{name}`, `{author}`, `{guide}` or
  `{endearment}` and the game fills them in for you.
* Line breaks inside `finalMessage` are preserved; a blank line starts a new
  paragraph.
* If you rename the guide, his dialogue follows automatically, because every
  line refers to him as `{guide}`.

## Going further (optional)

* **The full colour system** — `src/engine/theme.js`. `config.js` sets the
  handful of colours the interface uses; this file turns them into the
  complete palette for characters, scenery and dialogue speakers.
* **Dialogue and jokes** — `src/data/dialogue.js`
* **Optional gossip conversations** — `src/data/gossip.js`
* **Puzzle content** — `src/puzzles/guardianTrial.js`, `muralPairs.js`,
  `storykeeperTrial.js`. Each file holds its own questions, clues and hints.
  Run `npm test` afterwards; the tests check that every hint still matches the
  real answer.

## Checking your changes

```bash
npm start     # serves the game at http://localhost:4173
npm test      # verifies the puzzles and saved-progress logic
```
