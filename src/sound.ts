// Synthesized alert tones via the Web Audio API. Avoids bundling/sourcing
// audio assets and keeps the app self-contained.

let ctx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  // Browsers/webviews may start the context suspended until a gesture.
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

function beep(frequency: number, startOffset: number, duration: number, gain = 0.15) {
  const ac = audioContext();
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const t0 = ac.currentTime + startOffset;

  osc.type = "sine";
  osc.frequency.value = frequency;

  // Short attack/release envelope to avoid clicks.
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.linearRampToValueAtTime(0, t0 + duration);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Single soft tone for the warning threshold. */
export function playWarningSound() {
  try {
    beep(880, 0, 0.18);
  } catch {
    // Ignore — sound is best-effort.
  }
}

/** Two-tone chime for completion. */
export function playCompletionSound() {
  try {
    beep(660, 0, 0.16);
    beep(990, 0.2, 0.22);
  } catch {
    // Ignore — sound is best-effort.
  }
}
