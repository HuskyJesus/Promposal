/**
 * Procedural audio: every note, chime and gust of wind here is synthesised at
 * runtime with the Web Audio API. No audio files, no downloads.
 *
 * The context is created lazily on the first real user gesture so that browser
 * autoplay rules are respected, and the whole game stays playable with sound
 * switched off — callers never need to check, they just call.
 */

/** Semitone offsets of a warm major-pentatonic scale, used by most cues. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Ambient bed + chord progression that gives each chapter its own mood. */
const MOODS = {
  title: { root: 57, chords: [[0, 4, 7], [-3, 2, 5], [-5, 0, 4], [-3, 2, 7]], tempo: 3.6, wind: 0.05, air: 320 },
  woods: { root: 55, chords: [[0, 4, 7], [-2, 2, 5], [-5, 0, 4], [-7, -3, 2]], tempo: 3.2, wind: 0.09, air: 520 },
  cottage: { root: 60, chords: [[0, 3, 7], [-2, 3, 5], [-4, 0, 5], [-5, 0, 4]], tempo: 2.8, wind: 0.03, air: 240 },
  hall: { root: 52, chords: [[0, 3, 7], [-1, 4, 7], [-5, 2, 7], [-3, 0, 5]], tempo: 4.0, wind: 0.04, air: 900 },
  garden: { root: 57, chords: [[0, 4, 7, 11], [-3, 2, 7, 9], [-5, 0, 4, 7], [-1, 2, 6, 9]], tempo: 4.4, wind: 0.05, air: 700 }
};

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;
    this.mood = null;
    this.moodName = null;
    this.schedulerId = null;
    this.nextChordTime = 0;
    this.chordIndex = 0;
    this.ambienceNodes = [];
    /** Set by the game so audio cues can also be shown as text. */
    this.onCaption = () => {};
  }

  /** Called from a user gesture; safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // A gentle convolution-free "room": a short feedback delay reads as reverb
    // and costs far less than an impulse response.
    this.space = this.ctx.createDelay(0.6);
    this.space.delayTime.value = 0.22;
    this.spaceFeedback = this.ctx.createGain();
    this.spaceFeedback.gain.value = 0.28;
    this.spaceMix = this.ctx.createGain();
    this.spaceMix.gain.value = 0.3;
    this.space.connect(this.spaceFeedback);
    this.spaceFeedback.connect(this.space);
    this.space.connect(this.spaceMix);
    this.spaceMix.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.musicGain.connect(this.space);

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0;
    this.ambienceGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
    this.sfxGain.connect(this.space);

    if (this.moodName) this.setMood(this.moodName, true);
  }

  get enabled() {
    return Boolean(this.ctx) && this.settings.sound;
  }

  applySettings() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const musicOn = this.settings.sound && this.settings.music;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(musicOn ? 0.16 : 0, now + 0.4);
    this.ambienceGain.gain.cancelScheduledValues(now);
    this.ambienceGain.gain.linearRampToValueAtTime(this.settings.sound ? 0.11 : 0, now + 0.4);
    this.sfxGain.gain.value = this.settings.sound ? 0.6 : 0;
  }

  /** Switches the musical bed and ambience to a chapter's mood. */
  setMood(name, force = false) {
    if (!force && this.moodName === name) return;
    this.moodName = name;
    if (!this.ctx) return;
    this.mood = MOODS[name] || MOODS.woods;
    this.#startAmbience();
    this.#startMusic();
    this.applySettings();
  }

  #stopNodes() {
    for (const node of this.ambienceNodes) {
      try { node.stop ? node.stop() : node.disconnect(); } catch { /* already stopped */ }
    }
    this.ambienceNodes = [];
  }

  /** Filtered noise reads as wind, water and room tone depending on the mood. */
  #startAmbience() {
    if (!this.ctx) return;
    this.#stopNodes();
    const ctx = this.ctx;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish noise, softer than white
      data[i] = last * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.mood.air;
    filter.Q.value = 0.6;

    const swell = ctx.createGain();
    swell.gain.value = this.mood.wind * 8;

    // Slow amplitude drift so the ambience breathes instead of hissing flatly.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = this.mood.wind * 4;
    lfo.connect(lfoGain);
    lfoGain.connect(swell.gain);

    source.connect(filter);
    filter.connect(swell);
    swell.connect(this.ambienceGain);
    source.start();
    lfo.start();
    this.ambienceNodes.push(source, lfo);
  }

  #startMusic() {
    if (!this.ctx) return;
    if (this.schedulerId) clearInterval(this.schedulerId);
    this.chordIndex = 0;
    this.nextChordTime = this.ctx.currentTime + 0.1;
    this.schedulerId = setInterval(() => this.#scheduleMusic(), 250);
  }

  #scheduleMusic() {
    if (!this.ctx || !this.mood) return;
    if (this.ctx.state === 'suspended') return;
    const lookahead = this.ctx.currentTime + 1.0;
    while (this.nextChordTime < lookahead) {
      this.#playChord(this.nextChordTime);
      this.nextChordTime += this.mood.tempo;
    }
  }

  #playChord(time) {
    const { root, chords, tempo } = this.mood;
    const chord = chords[this.chordIndex % chords.length];
    this.chordIndex++;

    // Sustained pad.
    chord.forEach((interval, i) => {
      this.#voice({
        freq: midiToFreq(root + interval),
        time: time + i * 0.05,
        duration: tempo * 0.95,
        type: 'triangle',
        peak: 0.14,
        attack: 0.9,
        target: this.musicGain
      });
    });

    // A few plucked notes on top, drifting through the scale above the chord.
    const noteCount = 3;
    for (let i = 0; i < noteCount; i++) {
      const step = PENTATONIC[(this.chordIndex * 2 + i * 3) % PENTATONIC.length];
      this.#voice({
        freq: midiToFreq(root + 12 + step),
        time: time + 0.35 + i * (tempo / (noteCount + 1)),
        duration: 1.1,
        type: 'sine',
        peak: 0.1,
        attack: 0.02,
        target: this.musicGain
      });
    }
  }

  /** One synthesised note. */
  #voice({ freq, time, duration, type = 'sine', peak = 0.2, attack = 0.01, target, detune = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(target || this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  #now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /* ---------------------------------------------------------------- cues -- */

  /** Small blip when talking to someone or picking something up. */
  interact() {
    if (!this.enabled) return;
    const t = this.#now();
    this.#voice({ freq: midiToFreq(76), time: t, duration: 0.16, type: 'triangle', peak: 0.16 });
    this.#voice({ freq: midiToFreq(83), time: t + 0.05, duration: 0.18, type: 'sine', peak: 0.1 });
  }

  /** Soft typewriter tick under dialogue. */
  blip() {
    if (!this.enabled) return;
    const t = this.#now();
    this.#voice({ freq: midiToFreq(72 + Math.floor(Math.random() * 4)), time: t, duration: 0.05, type: 'sine', peak: 0.045 });
  }

  uiTap() {
    if (!this.enabled) return;
    const t = this.#now();
    this.#voice({ freq: midiToFreq(69), time: t, duration: 0.1, type: 'triangle', peak: 0.12 });
  }

  /** The recurring motif: three rising chimes. */
  threeChimes(caption = 'Three soft chimes ring out') {
    this.onCaption(caption);
    if (!this.enabled) return;
    const t = this.#now();
    [72, 76, 79].forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.28, duration: 1.4, type: 'sine', peak: 0.24 });
      this.#voice({ freq: midiToFreq(note + 12), time: t + i * 0.28, duration: 0.9, type: 'triangle', peak: 0.08 });
    });
  }

  collect() {
    this.onCaption('A moonflower chimes as it is gathered');
    if (!this.enabled) return;
    const t = this.#now();
    [79, 84, 88].forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.07, duration: 0.6, type: 'sine', peak: 0.18 });
    });
  }

  success() {
    this.onCaption('A bright chord of success');
    if (!this.enabled) return;
    const t = this.#now();
    [69, 73, 76, 81].forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.06, duration: 1.1, type: 'triangle', peak: 0.18 });
    });
  }

  gentleNo() {
    this.onCaption('A soft, patient chime — not quite right');
    if (!this.enabled) return;
    const t = this.#now();
    this.#voice({ freq: midiToFreq(65), time: t, duration: 0.34, type: 'sine', peak: 0.14 });
    this.#voice({ freq: midiToFreq(62), time: t + 0.12, duration: 0.4, type: 'sine', peak: 0.12 });
  }

  fragment() {
    this.onCaption('A story fragment settles into place');
    if (!this.enabled) return;
    const t = this.#now();
    [64, 71, 76, 83, 88].forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.11, duration: 1.8, type: 'sine', peak: 0.2 });
    });
  }

  pageTurn() {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = this.#now();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const fade = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * fade * fade * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
  }

  sparkle() {
    if (!this.enabled) return;
    const t = this.#now();
    for (let i = 0; i < 4; i++) {
      const note = 84 + PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.06, duration: 0.5, type: 'sine', peak: 0.07 });
    }
  }

  /** The ending flourish: an ascending run, then a wide shining chord. */
  celebrate() {
    this.onCaption('A joyful musical flourish');
    if (!this.enabled) return;
    const t = this.#now();
    const run = [64, 69, 71, 76, 78, 83, 88];
    run.forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: t + i * 0.09, duration: 0.7, type: 'triangle', peak: 0.2 });
    });
    const chordTime = t + run.length * 0.09;
    [52, 64, 68, 71, 76, 83].forEach((note, i) => {
      this.#voice({ freq: midiToFreq(note), time: chordTime + i * 0.03, duration: 3.4, type: 'sine', peak: 0.17 });
      this.#voice({ freq: midiToFreq(note), time: chordTime + i * 0.03, duration: 3.2, type: 'triangle', peak: 0.06, detune: 7 });
    });
    for (let i = 0; i < 12; i++) {
      const note = 88 + PENTATONIC[i % PENTATONIC.length];
      this.#voice({ freq: midiToFreq(note), time: chordTime + 0.3 + i * 0.13, duration: 0.6, type: 'sine', peak: 0.06 });
    }
  }

  /** Low resonant note used when something large opens or shifts. */
  rumble() {
    if (!this.enabled) return;
    const t = this.#now();
    this.#voice({ freq: midiToFreq(33), time: t, duration: 2.2, type: 'sine', peak: 0.22 });
    this.#voice({ freq: midiToFreq(40), time: t + 0.1, duration: 1.6, type: 'triangle', peak: 0.1 });
  }
}
