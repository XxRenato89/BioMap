import { Compass, Volume2, VolumeX, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useAvatarStore } from '../../store/avatarStore.js';
import { useViewerStore } from '../../store/viewerStore.js';

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

      try {
        const utterance = new SpeechSynthesisUtterance(activeSpeech);
        utterance.lang = 'es-CL'; // Prioridad español de Chile / neutro
        utterance.rate = 1.0;
        utterance.pitch = 1.05; // Tono amigable y enérgico de explorador

        const assignVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const spanishVoice = voices.find(
            (v) =>
              v.lang.startsWith('es') || v.name.includes('Spanish') || v.name.includes('Sabina'),
          );
          if (spanishVoice) {
            utterance.voice = spanishVoice;
          }
        };

        assignVoice();
        if (!utterance.voice && window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = assignVoice;
        }

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch {
        // En caso de que el navegador bloquee la síntesis de voz
      }
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking, activeSpeech, muted]);

  const selectedPointIds = useViewerStore((state) => state.selectedPointIds);

  if (!isSpeaking || !activeSpeech || selectedPointIds.length > 0) return null;

  return (
    <AnimatePresence>
      <motion.aside
        className="fixed bottom-[140px] left-6 sm:left-10 z-40 w-[min(440px,calc(100vw-48px))] rounded-[24px] bg-forest/90 backdrop-blur-xl border border-white/20 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)] text-white pointer-events-auto flex flex-col gap-3.5"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-white/15 border border-white/20 text-xl shadow-inner flex-none">
            <Compass size={22} className="z-10" aria-hidden="true" />
            <span className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-ping pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-mint uppercase tracking-wider">
              <Sparkles size={13} className="text-emerald-400" />
              <span>BioGuía Angostura</span>
            </div>
            <h3 className="m-0 text-base font-extrabold text-white truncate">
              {targetPoint?.properties?.name || 'Explicación del lugar'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-none">
            <button
              type="button"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
              onClick={toggleMute}
              title={muted ? 'Activar voz' : 'Silenciar voz'}
              aria-label={muted ? 'Activar voz' : 'Silenciar voz'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/80 text-white/90 hover:text-white transition-colors cursor-pointer"
              onClick={stopSpeaking}
              title="Cerrar y continuar patrulla"
              aria-label="Cerrar narración"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="text-sm leading-relaxed text-[#e8f1eb] max-h-36 overflow-y-auto pr-1">
          <p className="m-0">{activeSpeech}</p>
        </div>

        {/* Ondas de audio animadas cuando está hablando */}
        {!muted && (
          <div className="flex items-center gap-1 h-3 pt-0.5" aria-hidden="true">
            <span className="w-1 rounded-full bg-emerald-400 animate-[pulse_0.7s_ease-in-out_infinite] h-2" />
            <span className="w-1 rounded-full bg-emerald-400 animate-[pulse_0.5s_ease-in-out_infinite] h-3.5" />
            <span className="w-1 rounded-full bg-emerald-400 animate-[pulse_0.9s_ease-in-out_infinite] h-2" />
            <span className="w-1 rounded-full bg-emerald-400 animate-[pulse_0.6s_ease-in-out_infinite] h-4" />
            <span className="w-1 rounded-full bg-emerald-400 animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
