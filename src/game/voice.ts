// src/game/voice.ts: speech ordering on top of Dharm's speak() (docs/plan/03 §13).
// Reveal order: the option's `why` plays at once; the coach's feedback plays next, after the why finishes.
import { speak } from "@/lib/speak";

let queueToken = 0;

/** Speak now, cutting off anything else (and any queued line). */
export function sayNow(text: string) {
  queueToken++;
  speak(text);
}

/** Speak after the current utterance ends (gives up after maxWaitMs and speaks anyway). */
export function sayNext(text: string, maxWaitMs = 8000) {
  const token = ++queueToken;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const t0 = Date.now();
  const tick = () => {
    if (token !== queueToken) return; // superseded
    if (!window.speechSynthesis.speaking || Date.now() - t0 > maxWaitMs) speak(text);
    else setTimeout(tick, 150);
  };
  setTimeout(tick, 150);
}

export function stopSpeaking() {
  queueToken++;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
