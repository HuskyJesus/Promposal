/**
 * Saved progress: the transitions that decide whether "Continue" puts the
 * player back where they were, and whether a reset really resets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/** Minimal localStorage stand-in so the store can be tested outside a browser. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

const { SaveStore, CHAPTERS } = await import('../src/engine/save.js');

function freshStore() {
  storage.clear();
  return new SaveStore();
}

test('a brand new store has nothing worth continuing', () => {
  const save = freshStore();
  assert.equal(save.hasProgress(), false);
  assert.deepEqual(save.progress.fragments, []);
  assert.equal(save.progress.chapter, 'woods');
});

test('starting a story makes Continue available', () => {
  const save = freshStore();
  save.beginNewStory();
  save.setFlag('metTheo');
  assert.equal(save.hasProgress(), true);
});

test('progress survives being reloaded from storage', () => {
  const save = freshStore();
  save.beginNewStory();
  save.addToSet('moonflowers', 'stream');
  save.addToSet('fragments', 'woods');
  save.setChapter('cottage');
  save.setFlag('woodsComplete');

  const reloaded = new SaveStore();
  assert.equal(reloaded.progress.chapter, 'cottage');
  assert.deepEqual(reloaded.progress.moonflowers, ['stream']);
  assert.deepEqual(reloaded.progress.fragments, ['woods']);
  assert.equal(reloaded.hasFlag('woodsComplete'), true);
  assert.equal(reloaded.hasProgress(), true);
});

test('collections never record the same thing twice', () => {
  const save = freshStore();
  save.beginNewStory();
  assert.equal(save.addToSet('moonflowers', 'stream'), true);
  assert.equal(save.addToSet('moonflowers', 'stream'), false);
  assert.deepEqual(save.progress.moonflowers, ['stream']);
});

test('hints escalate per puzzle and are counted independently', () => {
  const save = freshStore();
  save.beginNewStory();
  assert.equal(save.bumpHint('mural'), 1);
  assert.equal(save.bumpHint('mural'), 2);
  assert.equal(save.bumpHint('guardianTrial'), 1);
  assert.equal(save.hintCount('mural'), 2);
  assert.equal(save.hintCount('storykeeper'), 0);
});

test('restarting a chapter clears only that chapter', () => {
  const save = freshStore();
  save.beginNewStory();
  save.addToSet('fragments', 'woods');
  save.addToSet('fragments', 'cottage');
  save.addToSet('moonflowers', 'stream');
  save.setFlag('woodsComplete');
  save.setFlag('cottageComplete');

  save.restartChapter('cottage');
  assert.deepEqual(save.progress.fragments, ['woods'], 'the woods fragment is kept');
  assert.deepEqual(save.progress.moonflowers, ['stream'], 'woods collectables are kept');
  assert.equal(save.hasFlag('cottageComplete'), false);
  assert.equal(save.hasFlag('woodsComplete'), true);
  assert.equal(save.progress.chapter, 'cottage');
});

test('restarting chapter one clears its moonflowers so it can be replayed', () => {
  const save = freshStore();
  save.beginNewStory();
  save.addToSet('moonflowers', 'stream');
  save.addToSet('moonflowers', 'stones');
  save.addToSet('fragments', 'woods');
  save.setFlag('woodsComplete');

  save.restartChapter('woods');
  assert.deepEqual(save.progress.moonflowers, []);
  assert.deepEqual(save.progress.fragments, []);
  assert.equal(save.hasFlag('woodsComplete'), false);
});

test('a full reset erases progress but keeps player settings', () => {
  const save = freshStore();
  save.beginNewStory();
  save.addToSet('fragments', 'woods');
  save.settings.sound = false;
  save.settings.reducedMotion = true;
  save.saveSettings();

  save.resetProgress();
  assert.deepEqual(save.progress.fragments, []);
  assert.equal(save.hasProgress(), false);

  const reloaded = new SaveStore();
  assert.equal(reloaded.settings.sound, false, 'sound preference survives a reset');
  assert.equal(reloaded.settings.reducedMotion, true);
  assert.equal(reloaded.hasProgress(), false);
});

test('the ending is only reachable after all three fragments', () => {
  const save = freshStore();
  save.beginNewStory();
  const chapterOrder = ['woods', 'cottage', 'hall'];
  chapterOrder.forEach((chapter, index) => {
    assert.equal(save.progress.fragments.length, index);
    save.addToSet('fragments', chapter);
  });
  assert.equal(save.progress.fragments.length, 3);
  assert.equal(CHAPTERS[CHAPTERS.length - 1], 'garden');
});

test('corrupt saved data falls back to a playable state', () => {
  storage.clear();
  storage.setItem('unwritten-page:progress:v1', '{not valid json');
  const save = new SaveStore();
  assert.equal(save.progress.chapter, 'woods');
  assert.deepEqual(save.progress.fragments, []);
});

test('a chapter this build does not have falls back to the first one', () => {
  storage.clear();
  storage.setItem('unwritten-page:progress:v1', JSON.stringify({ chapter: 'catacombs', startedAt: 1 }));
  const save = new SaveStore();
  assert.equal(save.progress.chapter, 'woods');
});

test('duplicate or unknown fragments are cleaned up on load', () => {
  storage.clear();
  storage.setItem('unwritten-page:progress:v1', JSON.stringify({
    chapter: 'hall', startedAt: 1,
    fragments: ['woods', 'woods', 'garden', 'nonsense', 'cottage'],
    moonflowers: 'not an array'
  }));
  const save = new SaveStore();
  assert.deepEqual(save.progress.fragments, ['woods', 'cottage']);
  assert.deepEqual(save.progress.moonflowers, []);
});

test('malformed flags and hint counts are replaced with empty objects', () => {
  storage.clear();
  storage.setItem('unwritten-page:progress:v1', JSON.stringify({
    chapter: 'woods', startedAt: 1, flags: 'broken', hintCounts: 7, endingSeen: 'yes'
  }));
  const save = new SaveStore();
  assert.deepEqual(save.progress.flags, {});
  assert.deepEqual(save.progress.hintCounts, {});
  assert.equal(save.progress.endingSeen, true);
  assert.equal(save.hasFlag('anything'), false);
});

test('partial saved data is merged onto the defaults', () => {
  storage.clear();
  storage.setItem('unwritten-page:progress:v1', JSON.stringify({ chapter: 'hall', startedAt: 1 }));
  const save = new SaveStore();
  assert.equal(save.progress.chapter, 'hall');
  assert.deepEqual(save.progress.moonflowers, [], 'missing fields get their defaults');
  assert.equal(save.hasProgress(), true);
});
