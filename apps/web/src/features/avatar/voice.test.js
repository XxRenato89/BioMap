import { describe, expect, it, vi } from 'vitest';
import { QUIBAR_PITCH, pickQuibarVoice, speakAsQuibar } from './voice.js';

const v = (name, lang) => ({ name, lang });

describe('pickQuibarVoice', () => {
  it('prefers a light Spanish voice over a male Chilean one', () => {
    const voices = [
      v('Microsoft David - English', 'en-US'),
      v('Microsoft Lorenzo Online (Natural) - Spanish (Chile)', 'es-CL'),
      v('Microsoft Helena - Spanish (Spain)', 'es-ES'),
      v('Microsoft Catalina Online (Natural) - Spanish (Chile)', 'es-CL'),
    ];
    expect(pickQuibarVoice(voices).name).toMatch(/Catalina/);
  });

  it('falls back to any Spanish voice, and to null without one', () => {
    expect(pickQuibarVoice([v('Microsoft Raul', 'es-MX')]).name).toBe('Microsoft Raul');
    expect(pickQuibarVoice([v('Microsoft David', 'en-US')])).toBeNull();
  });
});

describe('speakAsQuibar', () => {
  it('waits for the voices to load, then speaks high-pitched', () => {
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    let voices = [];
    const listeners = {};
    const synth = {
      getVoices: () => voices,
      speak: vi.fn(),
      addEventListener: (type, fn) => (listeners[type] = fn),
      removeEventListener: vi.fn(),
    };

    speakAsQuibar('¡Hola!', synth);
    expect(synth.speak).not.toHaveBeenCalled();

    voices = [v('Microsoft Sabina', 'es-MX')];
    listeners.voiceschanged();
    const [utterance] = synth.speak.mock.calls[0];
    expect(utterance.voice.name).toBe('Microsoft Sabina');
    expect(utterance.pitch).toBe(QUIBAR_PITCH);
  });
});
