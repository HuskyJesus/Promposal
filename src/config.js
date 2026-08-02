/**
 * ============================================================================
 *  THE UNWRITTEN PAGE: PERSONALISATION FILE
 * ============================================================================
 *
 *  This is the ONLY file you need to edit to make the game your own.
 *  Everything below is plain text, numbers, or colours. Change the values
 *  between the quote marks, save the file, and reload the page.
 *
 *  See CUSTOMIZE.md for a short walk-through of each field.
 * ============================================================================
 */

export const config = {
  /* --------------------------------------------------------------------
   * 1. WHO THE STORY IS FOR
   * ------------------------------------------------------------------ */

  /** The heroine's name. Used in dialogue and on the final page. */
  heroName: 'Kaleighia',

  /** Your name. Signs the final message. */
  authorName: 'Caius',

  /**
   * A pet name used sparingly, so it lands when it appears.
   * Set to an empty string ('') to switch it off everywhere.
   */
  endearment: 'lovey',

  /** The name of the small magical guide who leads the adventure. */
  guideName: 'Theo',

  /* --------------------------------------------------------------------
   * 2. THE FINAL MOMENT
   * ------------------------------------------------------------------ */

  /** Shown just before the question. Blank lines become paragraph breaks. */
  finalMessage: `Kaleighia, every day with you has become its own strange and wonderful fairytale.

From Theo and our three kisses, to letting rock-paper-scissors make our decisions, to every gossip session and ridiculous moment in between, you are my favorite person to experience it all with.

You are my lovey, my best friend, and my favorite freak.

I love you to the neighbor of our personal star and back at least twice, or as many times as it takes.`,

  /** The line that introduces the question. */
  finalLeadIn: 'Every fairytale needs one unforgettable night…',

  /** The question itself. */
  finalQuestion: 'Lovey, will you go to prom with me?',

  /** Shown after she says yes. */
  finalResponseMessage: 'I love you, lovey. Always, Caius',

  /** The two response buttons. Both are kind; neither one runs away. */
  responseYesLabel: 'Yes, of course!',
  responseTalkLabel: 'Come ask me in person',

  /**
   * Set to false to show only a single "close the book" button at the end
   * instead of the two response choices.
   */
  showResponseChoices: true,

  /* --------------------------------------------------------------------
   * 3. OPTIONAL DETAILS
   *    Leave any of these as an empty string ('') to hide them.
   * ------------------------------------------------------------------ */

  /** e.g. 'May 16th'. Appears on the final page as a small note. */
  promDate: '',

  /** e.g. 'The Riverside Ballroom'. Appears beside the date. */
  promLocation: '',

  /**
   * Little private memories. Each one is whispered by a flower in the
   * moonlit garden at the very end. Add, remove, or reword freely.
   */
  memories: [
    'The night we decided dinner with one round of rock-paper-scissors, best of three.',
    'Theo, who is definitely a royal guardian and definitely not a teddy bear.',
    'Three kisses. Always three.',
    'Every gossip session that somehow lasted until two in the morning.'
  ],

  /* --------------------------------------------------------------------
   * 4. COLOURS
   *    Any CSS colour works ('#f3e3c3', 'rebeccapurple', 'rgb(20 30 40)').
   * ------------------------------------------------------------------ */

  colors: {
    /** Deep night sky: the base tone of the whole game. */
    night: '#161228',
    /** Warm parchment used for panels and dialogue. */
    parchment: '#f6e7c8',
    /** Ink used for text on parchment. */
    ink: '#2f2338',
    /** Lantern gold: highlights, borders, and sparkles. */
    gold: '#e9b45f',
    /** Romantic rose: hearts, blossoms, the final page. */
    rose: '#d98a9a',
    /** Deep forest green. */
    forest: '#2c5a4c',
    /** Theo's blue. */
    guide: '#6f9ee8',
    /** Silver, for stars and the Monochrome Hall. */
    silver: '#dde5f2'
  },

  /* --------------------------------------------------------------------
   * 5. TITLE SCREEN WORDING
   * ------------------------------------------------------------------ */

  gameTitle: 'The Unwritten Page',
  gameSubtitle: 'a small fairytale, missing its ending'
};

/** Replaces {name}, {author}, {guide}, and {endearment} inside any string. */
export function fill(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\{name\}/g, config.heroName)
    .replace(/\{author\}/g, config.authorName)
    .replace(/\{guide\}/g, config.guideName)
    .replace(/\{endearment\}/g, config.endearment || config.heroName);
}
