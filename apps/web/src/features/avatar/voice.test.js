import { describe, expect, it, vi } from 'vitest';
import { QUIBAR_PITCH, pickQuibarVoice, speakAsQuibar, speakWithBrowser } from './voice.js';

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

describe('speakWithBrowser', () => {
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

    speakWithBrowser('¡Hola!', synth);
    expect(synth.speak).not.toHaveBeenCalled();

    voices = [v('Microsoft Sabina', 'es-MX')];
    listeners.voiceschanged();
    const [utterance] = synth.speak.mock.calls[0];
    expect(utterance.voice.name).toBe('Microsoft Sabina');
    expect(utterance.pitch).toBe(QUIBAR_PITCH);
  });
});

describe('speakAsQuibar', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fakeSynth = () => ({
    getVoices: () => [v('Microsoft Sabina', 'es-MX')],
    speak: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  it('plays the ElevenLabs audio from the API and stops it on demand', async () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:quibar');
    globalThis.URL.revokeObjectURL = vi.fn();
    const audio = { play: vi.fn(async () => {}), pause: vi.fn() };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob() }));
    const synth = fakeSynth();
    const stop = speakAsQuibar('¡Llegamos!', { synth, fetchImpl, createAudio: () => audio });
    await flush();
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ text: '¡Llegamos!' });
    expect(audio.play).toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
    stop();
    expect(audio.pause).toHaveBeenCalled();
  });

  it('falls back to the browser voice without a configured voice, and stops asking', async () => {
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }));
    const synth = fakeSynth();
    speakAsQuibar('Hola', { synth, fetchImpl, createAudio: vi.fn() });
    await flush();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    speakAsQuibar('Chao', { synth, fetchImpl, createAudio: vi.fn() });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });
});
