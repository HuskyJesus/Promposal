/**
 * Progress and settings persistence.
 *
 * Two separate localStorage keys so that "erase my progress" never silently
 * turns the sound back on or throws away an accessibility preference.
 */

const PROGRESS_KEY = 'unwritten-page:progress:v1';
const SETTINGS_KEY = 'unwritten-page:settings:v1';

/** Chapters, in the order they are played. */
export const CHAPTERS = ['woods', 'cottage', 'hall', 'garden'];

function emptyProgress() {
  return {
    version: 1,
    chapter: 'woods',
    startedAt: null,
    updatedAt: null,
    /** ids of the moonflowers found in chapter one */
    moonflowers: [],
    /** ids of story fragments earned: 'woods' | 'cottage' | 'hall' */
    fragments: [],
    /** ids of optional gossip conversations already heard */
    gossipHeard: [],
    /** one-off story beats, e.g. { metTheo: true } */
    flags: {},
    /** how many hints were requested per puzzle, used to escalate them */
    hintCounts: {},
    endingSeen: false,
    saidYes: false
  };
}

function defaultSettings() {
  return {
    sound: true,
    music: true,
    reducedMotion: false,
    textSpeed: 'normal' // 'normal' | 'instant'
  };
}

function readJSON(key, fallbackFactory) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackFactory();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallbackFactory();
    return { ...fallbackFactory(), ...parsed };
  } catch {
    // Private browsing, disabled storage, or corrupt data — play unsaved.
    return fallbackFactory();
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export class SaveStore {
  constructor() {
    this.progress = readJSON(PROGRESS_KEY, emptyProgress);
    this.settings = readJSON(SETTINGS_KEY, defaultSettings);
  }

  /** True when there is a game worth continuing. */
  hasProgress() {
    const p = this.progress;
    return Boolean(p.startedAt) && (p.chapter !== 'woods' || p.moonflowers.length > 0 || p.flags.metTheo);
  }

  beginNewStory() {
    this.progress = emptyProgress();
    this.progress.startedAt = Date.now();
    this.save();
  }

  save() {
    this.progress.updatedAt = Date.now();
    writeJSON(PROGRESS_KEY, this.progress);
  }

  saveSettings() {
    writeJSON(SETTINGS_KEY, this.settings);
  }

  /** Wipes progress but keeps sound / motion / text preferences. */
  resetProgress() {
    this.progress = emptyProgress();
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch { /* nothing to remove */ }
  }

  setFlag(name, value = true) {
    this.progress.flags[name] = value;
    this.save();
  }

  hasFlag(name) {
    return Boolean(this.progress.flags[name]);
  }

  addToSet(listName, id) {
    const list = this.progress[listName];
    if (!list.includes(id)) {
      list.push(id);
      this.save();
      return true;
    }
    return false;
  }

  has(listName, id) {
    return this.progress[listName].includes(id);
  }

  /** Records a hint request and returns how many have been asked for. */
  bumpHint(puzzleId) {
    const next = (this.progress.hintCounts[puzzleId] || 0) + 1;
    this.progress.hintCounts[puzzleId] = next;
    this.save();
    return next;
  }

  hintCount(puzzleId) {
    return this.progress.hintCounts[puzzleId] || 0;
  }

  setChapter(chapter) {
    this.progress.chapter = chapter;
    this.save();
  }

  /** Clears everything a chapter recorded, so it can be replayed cleanly. */
  restartChapter(chapter) {
    const p = this.progress;
    p.chapter = chapter;
    p.fragments = p.fragments.filter((id) => id !== chapter);
    if (chapter === 'woods') {
      p.moonflowers = [];
      delete p.flags.woodsComplete;
    }
    if (chapter === 'cottage') {
      delete p.flags.cottageComplete;
      delete p.flags.guardiansGreeted;
    }
    if (chapter === 'hall') {
      delete p.flags.hallComplete;
      delete p.flags.muralComplete;
      delete p.flags.triviaComplete;
    }
    this.save();
  }
}
