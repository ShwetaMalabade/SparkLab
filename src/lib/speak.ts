// src/lib/speak.ts — spoken feedback via the browser's Web Speech API (docs/plan/03 §13).
// Captions are the game's job (Shweta); this only speaks. Safe to import anywhere: no-ops on the server.
const PREFERRED = /Google US English|Samantha/;

/** Speak `text`, cutting off anything already speaking. */
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.lang = "en-US";
  const v = speechSynthesis.getVoices().find((voice) => PREFERRED.test(voice.name));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/** Call once on Calibrate: Chrome loads voices lazily, so this makes the first speak() use the right voice. */
export function warmVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => speechSynthesis.getVoices(), { once: true });
}
