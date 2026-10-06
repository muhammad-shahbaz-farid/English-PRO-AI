// Speech Recognition and Text-to-Speech Utilities for EnglishPro AI

export interface PlayTtsOptions {
  accent?: 'American' | 'British' | 'Australian' | 'Indian';
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: { code: string; message: string }) => void;
  onVoiceUnavailable?: (lang: string) => void;
}

export interface VoiceSelectionResult {
  voice: SpeechSynthesisVoice | null;
  lang: string;
  isUrdu: boolean;
  isRomanUrdu: boolean;
  status: 'ready' | 'voice-unavailable' | 'unsupported';
  message?: string;
}

// Global cached state for voice synthesis
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListeners: Array<(voices: SpeechSynthesisVoice[]) => void> = [];
let voicesListenerInitialized = false;

function initVoicesListener() {
  if (voicesListenerInitialized || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  voicesListenerInitialized = true;

  const updateVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
        const listeners = [...voicesListeners];
        voicesListeners = [];
        listeners.forEach((fn) => fn(v));
      }
    } catch {
      // ignore
    }
  };

  try {
    updateVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    } else if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  } catch {
    // ignore
  }
}

/**
 * Check if the browser environment supports SpeechSynthesis
 */
export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Retrieve available SpeechSynthesis voices, waiting asynchronously for
 * voiceschanged event if initially empty.
 */
export function getAvailableVoices(timeoutMs = 800): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) {
    return Promise.resolve([]);
  }

  initVoicesListener();

  // Try immediate synchronous getVoices()
  try {
    const immediate = window.speechSynthesis.getVoices();
    if (immediate && immediate.length > 0) {
      cachedVoices = immediate;
      return Promise.resolve(immediate);
    }
  } catch {
    // ignore
  }

  if (cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          const fallback = window.speechSynthesis.getVoices();
          if (fallback && fallback.length > 0) {
            cachedVoices = fallback;
          }
        } catch {
          // ignore
        }
        resolve(cachedVoices);
      }
    }, timeoutMs);

    const onVoicesReady = (voices: SpeechSynthesisVoice[]) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(voices);
      }
    };

    voicesListeners.push(onVoicesReady);

    try {
      // Poke the API to trigger voice loading
      window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  });
}

/**
 * Common Roman Urdu vocabulary markers to detect Latin-script Urdu responses
 */
const ROMAN_URDU_TEST_REGEX = /\b(aap|ap|apka|aapka|apki|aapki|mera|meri|mere|mujhe|mujhy|humein|humara|karna|krna|karein|kren|bohot|bohat|shukriya|theek|thik|achha|acha|sahi|hai|hain|hen|nahi|nahin|ni|kya|kyun|kaise|kese)\b/i;

/**
 * Clean and split text into naturally spoken sentence chunks.
 * Prevents Chrome/WebKit from truncating utterances over 200 characters.
 */
export function splitTextIntoSentences(text: string): string[] {
  if (!text) return [];

  // Strip markdown formatting symbols
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split on sentence boundaries (., !, ?) followed by whitespace or quote
  const rawSegments = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9\u0600-\u06FF"])/);
  const result: string[] = [];

  for (const raw of rawSegments) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // If an individual sentence is exceedingly long (> 200 chars), split at natural pauses
    if (trimmed.length > 200) {
      const subClauses = trimmed.split(/(?<=[,;:\u060C])\s+/);
      let current = '';
      for (const clause of subClauses) {
        if ((current + ' ' + clause).trim().length > 170 && current) {
          result.push(current.trim());
          current = clause;
        } else {
          current = current ? `${current} ${clause}` : clause;
        }
      }
      if (current.trim()) {
        result.push(current.trim());
      }
    } else {
      result.push(trimmed);
    }
  }

  return result.length > 0 ? result : [cleaned];
}

/**
 * Select the optimal TTS voice based on language, accent preference, and available voices.
 * Gracefully detects when an Urdu voice is missing rather than assigning a random English voice.
 */
export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
  text: string,
  options: {
    accent?: 'American' | 'British' | 'Australian' | 'Indian';
    lang?: string;
  } = {}
): VoiceSelectionResult {
  if (!isSpeechSynthesisSupported()) {
    return {
      voice: null,
      lang: 'en-US',
      isUrdu: false,
      isRomanUrdu: false,
      status: 'unsupported',
      message: 'Speech synthesis is not supported on this browser/platform.',
    };
  }

  const isUrduScript = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

  // Case 1: Text contains Urdu / Nastaliq script characters
  if (isUrduScript) {
    const urduVoice = voices.find((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      const vName = v.name.toLowerCase();
      return vLang.startsWith('ur') || vName.includes('urdu');
    });

    if (urduVoice) {
      return {
        voice: urduVoice,
        lang: urduVoice.lang || 'ur-PK',
        isUrdu: true,
        isRomanUrdu: false,
        status: 'ready',
      };
    }

    // Explicitly identify missing Urdu voice.
    // Never assign an unrelated English voice to read Arabic/Urdu script.
    return {
      voice: null,
      lang: 'ur-PK',
      isUrdu: true,
      isRomanUrdu: false,
      status: 'voice-unavailable',
      message: 'Urdu speech voice is not installed on this browser or operating system.',
    };
  }

  // Case 2: Roman Urdu or English
  const isRomanUrdu = ROMAN_URDU_TEST_REGEX.test(text);

  const langMap: Record<string, string> = {
    American: 'en-US',
    British: 'en-GB',
    Australian: 'en-AU',
    Indian: 'en-IN',
  };

  // For Roman Urdu, Indian English voices (en-IN) produce significantly more natural phonetics
  const preferredAccent = options.accent || (isRomanUrdu ? 'Indian' : 'American');
  const targetLocale = (options.lang || langMap[preferredAccent] || 'en-US')
    .toLowerCase()
    .replace('_', '-');
  const targetBase = targetLocale.split('-')[0] || 'en';

  if (!voices || voices.length === 0) {
    // If no voices list is populated, return target locale for browser default synthesizer
    return {
      voice: null,
      lang: targetLocale,
      isUrdu: false,
      isRomanUrdu,
      status: 'ready',
    };
  }

  // 1. Exact locale match (e.g. en-US, en-GB, en-AU, en-IN)
  const exactMatches = voices.filter((v) => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang === targetLocale;
  });

  if (exactMatches.length > 0) {
    // Prefer natural / neural / premium quality voices if available
    const premium = exactMatches.find((v) =>
      /natural|google|enhanced|premium|siri|neural/i.test(v.name)
    );
    const chosen = premium || exactMatches.find((v) => v.default) || exactMatches[0];
    return {
      voice: chosen,
      lang: chosen.lang || targetLocale,
      isUrdu: false,
      isRomanUrdu,
      status: 'ready',
    };
  }

  // 2. Base language match (e.g. starts with 'en-')
  const baseMatches = voices.filter((v) => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    return vLang.startsWith(targetBase + '-') || vLang === targetBase;
  });

  if (baseMatches.length > 0) {
    const preferred =
      baseMatches.find((v) => /en-US/i.test(v.lang) && /natural|google|enhanced|premium/i.test(v.name)) ||
      baseMatches.find((v) => /en-US/i.test(v.lang)) ||
      baseMatches.find((v) => /en-GB/i.test(v.lang)) ||
      baseMatches.find((v) => v.default) ||
      baseMatches[0];

    return {
      voice: preferred,
      lang: preferred.lang || targetLocale,
      isUrdu: false,
      isRomanUrdu,
      status: 'ready',
    };
  }

  // 3. Safe system default voice if it matches English
  const defaultVoice = voices.find((v) => v.default);
  if (
    defaultVoice &&
    (defaultVoice.lang.toLowerCase().startsWith('en') ||
      defaultVoice.lang.toLowerCase().startsWith(targetBase))
  ) {
    return {
      voice: defaultVoice,
      lang: defaultVoice.lang,
      isUrdu: false,
      isRomanUrdu,
      status: 'ready',
    };
  }

  // 4. Any English voice if available
  const anyEnglish = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  if (anyEnglish) {
    return {
      voice: anyEnglish,
      lang: anyEnglish.lang,
      isUrdu: false,
      isRomanUrdu,
      status: 'ready',
    };
  }

  // 5. No suitable voice found
  return {
    voice: null,
    lang: targetLocale,
    isUrdu: false,
    isRomanUrdu,
    status: 'voice-unavailable',
    message: `No compatible voice found for language ${targetLocale}.`,
  };
}

// Active Playback Session Interface to protect against GC and manage multi-sentence queue
interface ActivePlaybackSession {
  id: number;
  text: string;
  chunks: string[];
  currentIndex: number;
  options: PlayTtsOptions;
  voice: SpeechSynthesisVoice | null;
  lang: string;
  hasStarted: boolean;
  isCancelled: boolean;
  activeUtterance: SpeechSynthesisUtterance | null;
}

let currentSession: ActivePlaybackSession | null = null;
let nextSessionId = 1;
let cancelSpeakDelayTimer: any = null;

/**
 * Check if speech synthesis is currently active
 */
export function isSpeakingSynthesis(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  return window.speechSynthesis.speaking || (currentSession !== null && !currentSession.isCancelled);
}

/**
 * Stop any ongoing speech synthesis immediately and clean up active sessions
 */
export function stopSpeechSynthesis() {
  if (cancelSpeakDelayTimer) {
    clearTimeout(cancelSpeakDelayTimer);
    cancelSpeakDelayTimer = null;
  }

  if (currentSession) {
    currentSession.isCancelled = true;
    currentSession.activeUtterance = null;
    currentSession = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Play text using browser SpeechSynthesis with robust async voice discovery,
 * Chromium GC retention, sentence-boundary chunking, and language fallbacks.
 */
export async function playTextToSpeech(
  text: string,
  options: PlayTtsOptions = {}
): Promise<void> {
  // 1. Validate text input
  if (!text || typeof text !== 'string' || !text.trim()) {
    setTimeout(() => {
      options.onEnd?.();
    }, 0);
    return;
  }

  // 2. Validate browser support
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis is not supported on this browser');
    options.onError?.({
      code: 'unsupported',
      message: 'Speech synthesis is not supported on this browser.',
    });
    options.onEnd?.();
    return;
  }

  // 3. Increment session ID and halt prior speech
  const sessionId = ++nextSessionId;
  stopSpeechSynthesis();

  // 4. Load available voices asynchronously
  const voices = await getAvailableVoices();

  // Check if this invocation was superceded while waiting for voices
  if (sessionId !== nextSessionId) {
    return;
  }

  // 5. Select voice according to hierarchy and language rules
  const voiceResolution = selectBestVoice(voices, text, options);

  // If Urdu or language is unavailable, gracefully inform caller without fake audio
  if (voiceResolution.status === 'voice-unavailable') {
    if (voiceResolution.isUrdu) {
      options.onVoiceUnavailable?.('ur-PK');
    } else {
      options.onVoiceUnavailable?.(voiceResolution.lang);
    }
    options.onError?.({
      code: 'voice-unavailable',
      message: voiceResolution.message || 'Voice unavailable for this language',
    });
    options.onEnd?.();
    return;
  }

  // 6. Split into sentence chunks to prevent browser cutoff on long texts
  const chunks = splitTextIntoSentences(text);
  if (chunks.length === 0) {
    options.onEnd?.();
    return;
  }

  // 7. Initialize active session
  const session: ActivePlaybackSession = {
    id: sessionId,
    text,
    chunks,
    currentIndex: 0,
    options,
    voice: voiceResolution.voice,
    lang: voiceResolution.lang,
    hasStarted: false,
    isCancelled: false,
    activeUtterance: null,
  };
  currentSession = session;

  // 8. Internal diagnostic (development mode only)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.debug('[TTS Engine]', {
      sessionId,
      lang: session.lang,
      voice: session.voice?.name || 'Browser Default',
      chunkCount: chunks.length,
      firstChunk: chunks[0]?.slice(0, 40) + '...',
    });
  }

  // Helper to sequentially play each chunk
  const playNextChunk = (chunkIndex: number) => {
    if (session.isCancelled || currentSession?.id !== session.id) {
      return;
    }

    if (chunkIndex >= session.chunks.length) {
      // Completed all sentences
      session.options.onEnd?.();
      if (currentSession?.id === session.id) {
        currentSession = null;
      }
      return;
    }

    session.currentIndex = chunkIndex;
    const chunkText = session.chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);

    utterance.lang = session.lang;
    if (session.voice) {
      utterance.voice = session.voice;
    }
    utterance.rate = session.options.rate ?? 1.0;
    utterance.pitch = session.options.pitch ?? 1.0;
    utterance.volume = session.options.volume ?? 1.0;

    // Retain strong reference on session to prevent Chromium garbage collection
    session.activeUtterance = utterance;

    utterance.onstart = () => {
      if (session.isCancelled || currentSession?.id !== session.id) return;
      if (!session.hasStarted) {
        session.hasStarted = true;
        session.options.onStart?.();
      }
    };

    utterance.onend = () => {
      if (session.isCancelled || currentSession?.id !== session.id) return;
      playNextChunk(chunkIndex + 1);
    };

    utterance.onerror = (e) => {
      // Ignore normal interruptions from stop() or replay()
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      console.warn('SpeechSynthesisUtterance error:', e.error);
      session.options.onError?.({
        code: e.error || 'speech-error',
        message: `Playback error: ${e.error}`,
      });
      session.options.onEnd?.();
      if (currentSession?.id === session.id) {
        currentSession = null;
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      console.warn('speechSynthesis.speak error:', err);
      session.options.onError?.({
        code: 'speak-failed',
        message: err?.message || 'Failed to start speech',
      });
      session.options.onEnd?.();
      if (currentSession?.id === session.id) {
        currentSession = null;
      }
    }
  };

  // 9. Synchronize cancel and speak
  // Chromium has an internal race condition where calling speak() synchronously in
  // the exact same tick as cancel() drops the new utterance.
  // A 45ms deferral ensures the internal audio pipeline is cleanly reset.
  cancelSpeakDelayTimer = setTimeout(() => {
    cancelSpeakDelayTimer = null;
    if (session.isCancelled || currentSession?.id !== session.id) return;

    // Resume synthesis if browser suspended it
    if (window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    }

    playNextChunk(0);
  }, 45);
}

// Check speech recognition support
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

// Controller returned by startVoiceRecognition
export interface VoiceRecognitionController {
  (): void; // Can be invoked directly as a cleanup function: stopFn()
  stop: () => void;
  abort: () => void;
  recognition: any;
}

// Create speech recognition listener
export function startVoiceRecognition(options: {
  onResult: (transcript: string) => void;
  onInterim?: (interim: string) => void;
  onError: (err: any, userMessage: string) => void;
  onEnd: () => void;
  lang?: string;
}): VoiceRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError(
      new Error('Speech recognition not supported'),
      'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your message.'
    );
    return null;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = options.lang || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let accumulatedFinal = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          accumulatedFinal += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (options.onInterim && interim) {
        options.onInterim(interim);
      }

      const currentText = (accumulatedFinal + ' ' + interim).trim();
      if (currentText) {
        options.onResult(currentText);
      }
    };

    recognition.onerror = (event: any) => {
      let friendlyMessage = 'Microphone input encountered an error. You can type freely.';
      const errorCode = event.error;

      if (errorCode === 'not-allowed' || errorCode === 'permission-denied') {
        friendlyMessage = 'Microphone permission was denied. Please allow microphone access in your browser settings to speak, or type your message below.';
      } else if (errorCode === 'no-speech') {
        friendlyMessage = 'No speech was detected. Please try speaking again or type your message.';
      } else if (errorCode === 'audio-capture') {
        friendlyMessage = 'No microphone device was detected on your system. Please verify your microphone is plugged in.';
      } else if (errorCode === 'network') {
        friendlyMessage = 'Network issue with speech recognition service. You can type your response instead.';
      }

      options.onError(event, friendlyMessage);
    };

    recognition.onend = () => {
      options.onEnd();
    };

    const stopHandler = () => {
      try {
        recognition.stop();
      } catch (e) {
        // Recognition might already be stopped
      }
    };

    const abortHandler = () => {
      try {
        recognition.abort();
      } catch (e) {
        // Recognition might already be aborted
      }
    };

    const controller = (() => {
      stopHandler();
    }) as VoiceRecognitionController;

    controller.stop = stopHandler;
    controller.abort = abortHandler;
    controller.recognition = recognition;

    recognition.start();
    return controller;
  } catch (err: any) {
    options.onError(err, 'Failed to initialize microphone. You can type your response directly.');
    return null;
  }
}

/**
 * Check if browser supports MediaRecorder API
 */
export function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Safely stops all tracks on a MediaStream to release microphone hardware
 * and turn off the browser recording/red indicator.
 */
export function stopMediaStreamTracks(stream?: MediaStream | null) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Safely stops a MediaRecorder and releases its MediaStream tracks.
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * - In Web Speech API, `recognition.stop()` only terminates SpeechRecognition transcription.
 * - If the application or any component records audio via `MediaRecorder` or `getUserMedia`,
 *   calling `recognition.stop()` will NOT stop the MediaRecorder or release the microphone.
 * - `mediaRecorder.stop()` must be invoked separately, AND `stream.getTracks().forEach(t => t.stop())`
 *   must be called to fully release the microphone hardware.
 */
export function stopMediaRecorder(
  mediaRecorder?: MediaRecorder | null,
  stream?: MediaStream | null
) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (e) {
      // ignore
    }
  }
  if (stream) {
    stopMediaStreamTracks(stream);
  }
}

export interface AudioRecordingSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  stop: () => Promise<Blob>;
}

/**
 * Starts audio recording with MediaRecorder and returns a session controller.
 * Calling session.stop() both halts the MediaRecorder AND releases all microphone tracks.
 */
export async function startAudioRecording(options?: {
  mimeType?: string;
  onDataAvailable?: (chunk: Blob) => void;
}): Promise<AudioRecordingSession | null> {
  if (!isMediaRecorderSupported()) {
    return null;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(
    stream,
    options?.mimeType ? { mimeType: options.mimeType } : undefined
  );
  const chunks: BlobPart[] = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
      options?.onDataAvailable?.(event.data);
    }
  };

  mediaRecorder.start();

  return {
    mediaRecorder,
    stream,
    stop: () => {
      return new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          stopMediaStreamTracks(stream);
          const blob = new Blob(chunks, {
            type: mediaRecorder.mimeType || 'audio/webm',
          });
          resolve(blob);
        };
        try {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          } else {
            stopMediaStreamTracks(stream);
            resolve(new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }));
          }
        } catch (e) {
          stopMediaStreamTracks(stream);
          resolve(new Blob(chunks, { type: 'audio/webm' }));
        }
      });
    },
  };
}

// Pleasant chime sounds using Web Audio API (no external asset needed)
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function playChime(type: 'success' | 'click' | 'xp' | 'error' = 'success') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } else if (type === 'xp') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch (e) {
    // Ignore audio errors silently
  }
}
