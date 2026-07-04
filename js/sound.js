/* ============================================================
   Dukaan Dreams — sound.js
   Tiny procedural sound effects via WebAudio. No audio files
   needed. Fails silently if AudioContext is unavailable.
   ============================================================ */
window.DD = window.DD || {};

DD.Sound = (function () {
  let ctx = null;
  function getCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function isMuted() {
    return DD.state && DD.state.settings && DD.state.settings.muted;
  }

  function tone(freq, start, dur, type, gainPeak) {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, c.currentTime + start);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.15, c.currentTime + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + start);
    osc.stop(c.currentTime + start + dur + 0.05);
  }

  function play(name) {
    if (isMuted()) return;
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    switch (name) {
      case 'coin':
        tone(880, 0, 0.09, 'square', 0.08);
        tone(1320, 0.05, 0.09, 'square', 0.06);
        break;
      case 'build':
        tone(220, 0, 0.12, 'triangle', 0.12);
        tone(330, 0.08, 0.12, 'triangle', 0.1);
        break;
      case 'upgrade':
        tone(523, 0, 0.1, 'sine', 0.1);
        tone(659, 0.09, 0.1, 'sine', 0.1);
        tone(784, 0.18, 0.16, 'sine', 0.12);
        break;
      case 'sell':
        tone(400, 0, 0.1, 'sawtooth', 0.08);
        tone(280, 0.08, 0.12, 'sawtooth', 0.07);
        break;
      case 'error':
        tone(160, 0, 0.15, 'square', 0.1);
        break;
      case 'click':
        tone(600, 0, 0.04, 'square', 0.05);
        break;
      case 'happy':
        tone(660, 0, 0.08, 'sine', 0.07);
        tone(880, 0.06, 0.1, 'sine', 0.07);
        break;
      case 'vip':
        tone(784, 0, 0.1, 'triangle', 0.12);
        tone(988, 0.08, 0.1, 'triangle', 0.12);
        tone(1175, 0.16, 0.18, 'triangle', 0.14);
        break;
      case 'dayend':
        tone(523, 0, 0.12, 'sine', 0.12);
        tone(659, 0.12, 0.12, 'sine', 0.12);
        tone(784, 0.24, 0.12, 'sine', 0.12);
        tone(1047, 0.36, 0.28, 'sine', 0.16);
        break;
      case 'bus':
        tone(150, 0, 0.25, 'sawtooth', 0.06);
        break;
      case 'achievement':
        tone(659, 0, 0.1, 'triangle', 0.12);
        tone(880, 0.1, 0.1, 'triangle', 0.12);
        tone(1047, 0.2, 0.1, 'triangle', 0.12);
        tone(1319, 0.3, 0.3, 'triangle', 0.16);
        break;
    }
  }

  return { play, getCtx };
})();
