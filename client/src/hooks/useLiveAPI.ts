import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranscriptionManager } from './useTranscriptionManager';
import { AudioStreamer } from '../lib/AudioStreamer';

// API Configuration
const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8080';
const DASHBOARD_API_URL = import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:8081';

// Audio Processor Worklet Code
const audioProcessorCode = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1536; 
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const inputData = input[0];
      for (let i = 0; i < inputData.length; i++) {
        const sample = inputData[i];
        this.buffer[this.bufferIndex++] = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        if (this.bufferIndex >= this.bufferSize) {
          const bufferToSend = this.buffer.slice().buffer;
          this.port.postMessage({ buffer: bufferToSend }, [bufferToSend]);
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error';

export function useLiveAPI() {
    const { messages, addMessage, processServerContent, reset } = useTranscriptionManager();
    const [status, setStatus] = useState<LiveStatus>('idle');
    const [isLive, setIsLive] = useState(false);
    const [isThinking, setIsThinking] = useState(false);

    // Refs para gerenciamento de hardware e sessão
    const liveSessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioStreamerRef = useRef<AudioStreamer | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const isLiveRef = useRef(false);
    const isThinkingRef = useRef(false);
    const callIdRef = useRef<string>('');
    const sessionStartTimeRef = useRef<number>(0);




    // latestUserTextRef movido para useTranscriptionManager
    const animationFrameRef = useRef<number | null>(null);

    // Commit buffered user text refatorado para useTranscriptionManager.js

    // --- Visualizer Loop (Real-time Agent Audio Analysis) ---


    // --- Lógica de Persistência Movida para o Backend ---
    // Remoção da função persistTurn local.

    // Cleanup tracks
    const stopAudioCapture = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            localStreamRef.current = null;
        }
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const disconnect = useCallback(async (isGraceful = true) => {
        console.log('[useLiveAPI] Disconnecting...');

        // Nuclear cleanup: Stop everything first
        isLiveRef.current = false;
        setIsLive(false);
        setStatus('idle');
        setStatus('idle');
        setIsThinking(false);
        isThinkingRef.current = false;
        reconnectAttemptsRef.current = 0; // Reset definitivo

        if (liveSessionRef.current) {
            try {
                liveSessionRef.current.close();
            } catch (e) { }
            liveSessionRef.current = null;
        }

        if (audioStreamerRef.current) {
            audioStreamerRef.current.stop();
            audioStreamerRef.current = null;
        }

        if (isGraceful) {
            // A persistência agora é feita automaticamente pelo Backend no evento de Close.
            console.log('[useLiveAPI] Graceful disconnect. Backend will persist data.');
        }

        stopAudioCapture();
    }, [stopAudioCapture]);

    // Handle incoming audio
    const playAudioChunk = useCallback((base64: string) => {
        try {
            if (!audioStreamerRef.current) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const streamer = new AudioStreamer(ctx);

                // Connect directly to destination (No Visualizer)
                streamer.gainNode.connect(ctx.destination);
                audioStreamerRef.current = streamer;
            }

            const streamer = audioStreamerRef.current;
            if (streamer.context.state === 'suspended') streamer.context.resume();

            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

            // Interface Refatorada: push()
            streamer.push(bytes);

        } catch (err) {
            console.error('[useLiveAPI] Playback error:', err);
        }
    }, []);

    const startAudioCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            const micCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = micCtx;

            const blob = new Blob([audioProcessorCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            await micCtx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);

            const source = micCtx.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(micCtx, 'audio-processor');
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event) => {
                // Volume checks removed (Visualizer abolished)

                const buffer = event.data.buffer;
                const session = liveSessionRef.current;
                if (session && isLiveRef.current && buffer) {
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                    session.sendRealtimeInput({
                        audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
                    });
                }
            };

            source.connect(workletNode);
            const gainNode = micCtx.createGain();
            gainNode.gain.value = 0;
            workletNode.connect(gainNode);
            gainNode.connect(micCtx.destination);

            if (micCtx.state === 'suspended') await micCtx.resume();
            micCtx.onstatechange = () => { if (micCtx.state === 'suspended') micCtx.resume(); };
        } catch (err) {
            console.error('[useLiveAPI] Mic error:', err);
        }
    }, []);


    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 3;

    const connect = useCallback(async () => {
        try {
            setStatus('connecting');

            // Se for tentativa 0 (conexão manual), gera NOVO ID. 
            // Se for tentativa > 0 (reconexão auto), mantém o ID atual.
            const newCallId = (reconnectAttemptsRef.current === 0) ? crypto.randomUUID() : (callIdRef.current || crypto.randomUUID());
            callIdRef.current = newCallId;

            if (reconnectAttemptsRef.current === 0) {
                reset(); // Reset via TranscriptionManager
                sessionStartTimeRef.current = Date.now();
            }

            isLiveRef.current = true;

            const clientName = import.meta.env.VITE_INSTANCE_CLIENT_NAME || 'aiVoice';
            const wsUrl = AGENT_API_URL.replace('http', 'ws') + '/ws?callId=' + newCallId + '&client=' + clientName;
            const socket = new WebSocket(wsUrl);
            liveSessionRef.current = {
                sendRealtimeInput: (data: any) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'realtime_input', payload: data }));
                    }
                },
                sendClientContent: (data: any) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'client_content', payload: data }));
                    }
                },
                sendToolResponse: (data: any) => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'tool_response', payload: data }));
                    }
                },
                close: () => {
                    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                        socket.close();
                    }
                }
            };

            socket.onopen = () => {
                console.log('[useLiveAPI] Orchestrator Connected');
                setStatus('connected');
                setIsLive(true);
                reconnectAttemptsRef.current = 0; // Reset ao conectar com sucesso
                startAudioCapture();

                socket.send(JSON.stringify({
                    type: 'setup',
                    payload: {}
                }));
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'session_terminated') {
                    console.log('[useLiveAPI] Session termination signal received.');
                    if (audioStreamerRef.current && audioStreamerRef.current.status() === 'playing') {
                        console.log('[useLiveAPI] Waiting for audio playback to finish...');
                        audioStreamerRef.current.onComplete = () => {
                            console.log('[useLiveAPI] Audio finished. Disconnecting now.');
                            disconnect(true);
                        };
                    } else {
                        console.log('[useLiveAPI] No audio playing. Disconnecting immediately.');
                        disconnect(true);
                    }
                    return;
                }

                const serverContent = data.server_content || data.serverContent || data;

                // Prioridade Total: Áudio
                const modelTurn = serverContent.model_turn || serverContent.modelTurn;
                if (modelTurn?.parts) {
                    modelTurn.parts.forEach((part: any) => {
                        if (part.inlineData?.data) playAudioChunk(part.inlineData.data);
                    });
                }

                processServerContent(serverContent);

                if (serverContent.turn_complete || serverContent.turnComplete) {
                    setIsThinking(true);
                    isThinkingRef.current = true;
                } else if (serverContent.model_turn || serverContent.modelTurn || serverContent.output_transcription || serverContent.outputTranscription) {
                    setIsThinking(false);
                    isThinkingRef.current = false;
                }


            };

            socket.onclose = (event) => {
                console.log('[useLiveAPI] Orchestrator Closed', event.code);

                // Só tenta reconectar se não for fechamento manual (1000) e não exceder o limite
                if (event.code !== 1000 && isLiveRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    // Exponential Backoff with Jitter (Padrão Ouro)
                    const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
                    const jitter = Math.random() * 1000;
                    const timeout = baseDelay + jitter;

                    console.log(`[useLiveAPI] Reconnecting in ${Math.round(timeout)}ms... (Attempt ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

                    setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, timeout);
                } else if (event.code !== 1000 && isLiveRef.current) {
                    console.error('[useLiveAPI] Max reconnection attempts reached or manual disconnect.');
                    setStatus('error');
                    disconnect(false);
                } else {
                    disconnect(false);
                }
            };

            socket.onerror = (err) => {
                console.error('[useLiveAPI] socket error:', err);
                // Onerror geralmente precede onclose, deixamos a lógica de reconexão no onclose
            };

        } catch (err) {
            console.error('[useLiveAPI] Connect error:', err);
            setStatus('error');
        }
    }, [reset, processServerContent, startAudioCapture, playAudioChunk, disconnect]);

    const sendMessage = useCallback((text: string) => {
        if (!text.trim() || !isLive || !liveSessionRef.current) return;
        isThinkingRef.current = true;
        setIsThinking(true);
        liveSessionRef.current.sendClientContent({
            turns: [{ role: "user", parts: [{ text }] }],
            turnComplete: true
        });
        addMessage('user', text);
    }, [isLive, addMessage]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isLiveRef.current && callIdRef.current) {
                const url = `${AGENT_API_URL}/terminate?sessionId=${callIdRef.current}`;
                navigator.sendBeacon(url);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            disconnect(false);
        };
    }, [disconnect]);

    return {
        messages,
        isLive,
        status,
        connect,
        disconnect,
        sendMessage,
        isThinking
    };
}
