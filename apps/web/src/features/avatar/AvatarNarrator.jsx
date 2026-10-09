import { Volume2, VolumeX, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useAvatarStore } from '../../store/avatarStore.js';

/**
 * Módulo de voz y diálogo del Avatar ("BioGuía").
 * Sintetiza la explicación con voz en español offline (Web Speech API)
 * y muestra una tarjeta de narración interactiva en pantalla.
 */
export default function AvatarNarrator() {
  const isSpeaking = useAvatarStore((state) => state.isSpeaking);
  const activeSpeech = useAvatarStore((state) => state.activeSpeech);
  const targetPoint = useAvatarStore((state) => state.targetPoint);
  const muted = useAvatarStore((state) => state.muted);
  const toggleMute = useAvatarStore((state) => state.toggleMute);
  const stopSpeaking = useAvatarStore((state) => state.stopSpeaking);

  const utteranceRef = useRef(null);

  // Síntesis de voz offline con Web Speech API
  useEffect(() => {
    if (!isSpeaking || !activeSpeech || muted) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(activeSpeech);
      utterance.lang = 'es-CL'; // Prioridad español de Chile / neutro
      utterance.rate = 1.0;
      utterance.pitch = 1.05; // Tono amigable y enérgico de explorador

      // Buscar voz en español si están cargadas en el sistema
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(
        (v) => v.lang.startsWith('es') || v.name.includes('Spanish') || v.name.includes('Sabina'),
      );
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      utterance.onend = () => {
        // Al terminar el audio sigue visible el texto para lectura
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking, activeSpeech, muted]);

  if (!isSpeaking || !activeSpeech) return null;

  return (
    <AnimatePresence>
      <motion.aside
        className="avatar-narrator-dialog"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="avatar-narrator-dialog__badge">
          <div className="avatar-narrator-dialog__avatar-icon">
            <span className="avatar-emoji">🧭</span>
            <span className="avatar-pulse" />
          </div>
          <div className="avatar-narrator-dialog__title-block">
            <div className="avatar-narrator-dialog__tag">
              <Sparkles size={14} className="sparkle-icon" />
              <span>BioGuía Angostura</span>
            </div>
            <h3 className="avatar-narrator-dialog__title">
              {targetPoint?.properties?.name || 'Explicación del lugar'}
            </h3>
          </div>
          <div className="avatar-narrator-dialog__controls">
            <button
              type="button"
              className="narrator-btn"
              onClick={toggleMute}
              title={muted ? 'Activar voz' : 'Silenciar voz'}
              aria-label={muted ? 'Activar voz' : 'Silenciar voz'}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              type="button"
              className="narrator-btn narrator-btn--close"
              onClick={stopSpeaking}
              title="Cerrar y continuar patrulla"
              aria-label="Cerrar narración"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="avatar-narrator-dialog__body">
          <p className="avatar-narrator-dialog__speech">{activeSpeech}</p>
        </div>

        {/* Ondas de audio animadas cuando está hablando */}
        {!muted && (
          <div className="avatar-narrator-dialog__waves" aria-hidden="true">
            <span className="wave-bar wave-bar-1" />
            <span className="wave-bar wave-bar-2" />
            <span className="wave-bar wave-bar-3" />
            <span className="wave-bar wave-bar-4" />
            <span className="wave-bar wave-bar-5" />
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
