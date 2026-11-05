/*
 * Voz de Quibar: infantil y alegre. La Web Speech API no clona voces, así que
 * se logra con una voz femenina/ligera en español, tono alto y algo rápida.
 */
export const QUIBAR_PITCH = 1.7;
export const QUIBAR_RATE = 1.1;

// Voces ligeras conocidas (Windows, Edge, Chrome, Android, macOS).
const LIGHT_VOICES =
  /catalina|dalia|elena|sabina|helena|laura|paulina|monica|mónica|soledad|ximena|salome|salomé|google español|female|mujer/i;
const MALE_VOICES = /lorenzo|raul|raúl|pablo|jorge|diego|tomas|tomás|alvaro|álvaro|male|hombre/i;

const langRank = (lang = '') => {
  const l = lang.toLowerCase();
  if (l === 'es-cl') return 0;
  if (/^es-(419|mx|us|ar|co|pe)$/.test(l)) return 1;
  if (l.startsWith('es')) return 2;
  return 9;
};

const genderRank = (name) => (LIGHT_VOICES.test(name) ? 0 : MALE_VOICES.test(name) ? 2 : 1);

/** Elige la voz en español que más suena a niño: ligera primero, luego la más cercana a Chile. */
export function pickQuibarVoice(voices) {
  const spanish = voices.filter((v) => langRank(v.lang) < 9);
  spanish.sort(
    (a, b) => genderRank(a.name) - genderRank(b.name) || langRank(a.lang) - langRank(b.lang),
  );
  return spanish[0] ?? null;
}

/** Dice el texto con la voz de Quibar. Espera a que el navegador cargue sus voces. */
export function speakAsQuibar(text, synth = window.speechSynthesis) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CL';
  utterance.pitch = QUIBAR_PITCH;
  utterance.rate = QUIBAR_RATE;

  const speak = () => {
    const voice = pickQuibarVoice(synth.getVoices());
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    synth.speak(utterance);
  };

  if (synth.getVoices().length) speak();
  else synth.addEventListener('voiceschanged', speak, { once: true });
  return () => synth.removeEventListener('voiceschanged', speak);
}
