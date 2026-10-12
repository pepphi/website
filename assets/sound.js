/*
  Sound: a soft generated ambient pad plus small interface sounds.
  Everything is synthesised with the Web Audio API – no audio files, no external requests.
  Sound is off by default; the choice is remembered for the browser tab (sessionStorage).
*/
(() => {
  const btn = document.querySelector('.sound-btn');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !AC) { if (btn) btn.hidden = true; return; }

  let ctx = null, master = null, sfx = null, reverb = null, ambientStarted = false, on = false;
  const session = {
    get() { try { return sessionStorage.getItem('sound'); } catch { return null; } },
    set(v) { try { sessionStorage.setItem('sound', v); } catch { /* ignore */ } }
  };

  function impulse(seconds = 3.2, decay = 2.6) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function noiseBuffer(seconds = 2) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function setup() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);
    sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);
    sfx.connect(reverb);
  }

  // A warm, slowly breathing A-major-9 pad.
  function startAmbient() {
    if (ambientStarted) return;
    ambientStarted = true;
    const pad = ctx.createGain();
    pad.gain.value = 0.9;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    const fLfo = ctx.createOscillator(), fDepth = ctx.createGain();
    fLfo.frequency.value = 0.03; fDepth.gain.value = 380;
    fLfo.connect(fDepth).connect(filter.frequency); fLfo.start();
    pad.connect(filter);
    filter.connect(master);
    filter.connect(reverb);

    [110, 164.81, 207.65, 246.94, 329.63].forEach((f, i) => {
      const voice = ctx.createGain();
      voice.gain.value = 0.018;
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 0.04 + i * 0.017;
      depth.gain.value = 0.014;
      lfo.connect(depth).connect(voice.gain);
      lfo.start(ctx.currentTime + i * 0.7);
      ['sine', 'triangle'].forEach((type, k) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = k ? -7 : 5;
        o.connect(voice);
        o.start();
      });
      voice.connect(pad);
    });

    // airy texture
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer(4);
    air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.006;
    air.connect(bp).connect(airGain).connect(filter);
    air.start();
  }

  function tone(freq, { dur = 0.12, type = 'sine', gain = 0.05, delay = 0, to = null } = {}) {
    if (!on) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.5, from = 400, to = 3000, gain = 0.05, type = 'bandpass', q = 1 } = {}) {
    if (!on) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfx);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  const sounds = {
    hover: () => tone(1500, { dur: 0.07, gain: 0.018, to: 1150 }),
    click: () => { tone(660, { dur: 0.14, type: 'triangle', gain: 0.045 }); tone(990, { dur: 0.16, gain: 0.03, delay: 0.035 }); },
    whoosh: () => noise({ dur: 0.7, from: 250, to: 3200, gain: 0.07, q: 0.8 }),
    paper: () => noise({ dur: 0.12, from: 2500, to: 5000, gain: 0.05, type: 'highpass', q: 0.3 }),
    chime: () => [880, 1108.73, 1318.51].forEach((f, i) => tone(f, { dur: 0.9, gain: 0.03, delay: i * 0.07 }))
  };

  function setOn(next) {
    on = next;
    btn.setAttribute('aria-pressed', String(on));
    session.set(on ? '1' : '0');
    if (on) {
      if (!ctx) setup();
      ctx.resume();
      startAmbient();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
      sounds.chime();
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => { if (!on) ctx.suspend(); }, 1200);
    }
  }

  btn.addEventListener('click', () => setOn(!on));

  // remember the choice within the tab; browsers need a gesture before audio can start
  if (session.get() === '1') {
    btn.setAttribute('aria-pressed', 'true');
    const resume = e => {
      removeEventListener('pointerdown', resume);
      removeEventListener('keydown', resume);
      if (e.target instanceof Element && e.target.closest('.sound-btn')) return; // the button's own click handles it
      if (btn.getAttribute('aria-pressed') === 'true' && !on) setOn(true);
    };
    addEventListener('pointerdown', resume);
    addEventListener('keydown', resume);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (on) ctx.resume();
  });

  // interface sounds
  let lastHover = null;
  document.addEventListener('pointerover', e => {
    const el = e.target.closest('a, button, .tag, .note, .ring');
    if (el && el !== lastHover && el !== btn) sounds.hover();
    lastHover = el;
  });
  document.addEventListener('click', e => { if (e.target.closest('a, button, .tag, .ring') && !e.target.closest('.sound-btn')) sounds.click(); });
  document.addEventListener('photochange', sounds.whoosh);
  document.addEventListener('pagetransition', sounds.whoosh);
  document.addEventListener('notepick', sounds.paper);
  document.addEventListener('medalgrab', () => tone(1760, { dur: 1.2, gain: 0.03 }));
})();
