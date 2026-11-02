import { beforeEach, describe, expect, it } from 'vitest';
import { useAvatarStore } from './avatarStore.js';

describe('useAvatarStore', () => {
  beforeEach(() => {
    useAvatarStore.setState({
      mode: 'patrol',
      targetPoint: null,
      activeSpeech: '',
      isSpeaking: false,
      muted: false,
      skipRequested: false,
      lastArrivedPoint: null,
    });
  });

  it('switches to running_to_point when targetPoint is set, and patrol when cleared', () => {
    const dummyFeature = { properties: { id: 14, name: 'Playa Santa Bárbara' } };
    useAvatarStore.getState().setTargetPoint(dummyFeature);
    expect(useAvatarStore.getState().mode).toBe('running_to_point');
    expect(useAvatarStore.getState().targetPoint).toBe(dummyFeature);

    useAvatarStore.getState().setTargetPoint(null);
    expect(useAvatarStore.getState().mode).toBe('patrol');
    expect(useAvatarStore.getState().targetPoint).toBeNull();
  });

  it('stores lastArrivedPoint to allow returning when sheet is closed', () => {
    const dummyFeature = { properties: { id: 16, name: 'Playa Quilaco' } };
    useAvatarStore.getState().setLastArrivedPoint(dummyFeature);
    expect(useAvatarStore.getState().lastArrivedPoint).toBe(dummyFeature);
  });

  it('activates skipWalk when requested', () => {
    expect(useAvatarStore.getState().skipRequested).toBe(false);
    useAvatarStore.getState().skipWalk();
    expect(useAvatarStore.getState().skipRequested).toBe(true);
  });

  it('handles speaking and stopping', () => {
    useAvatarStore.getState().startSpeaking('¡Bienvenidos a Angostura!');
    expect(useAvatarStore.getState().isSpeaking).toBe(true);
    expect(useAvatarStore.getState().mode).toBe('speaking');
    expect(useAvatarStore.getState().activeSpeech).toBe('¡Bienvenidos a Angostura!');

    useAvatarStore.getState().stopSpeaking();
    expect(useAvatarStore.getState().isSpeaking).toBe(false);
    expect(useAvatarStore.getState().mode).toBe('patrol');
    expect(useAvatarStore.getState().activeSpeech).toBe('');
  });
});
