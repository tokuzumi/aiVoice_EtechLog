import { AudioStreamer } from './AudioStreamer';

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type Message = {
    id: string;
    role: 'user' | 'agent' | 'agent_link';
    text: string;
    type: 'text' | 'link';
    url?: string;
    alias?: string;
    timestamp: Date;
};

export interface AiVoiceCoreConfig {
    agentApiUrl: string;
    clientName: string;
    onStatusChange?: (status: LiveStatus) => void;
    onMessagesChange?: (messages: Message[]) => void;
    onThinkingChange?: (isThinking: boolean) => void;
}

export class AiVoiceCore {
    private config: AiVoiceCoreConfig;
    private status: LiveStatus = 'idle';
    private isLive = false;
    private isThinking = false;

    // Conexões e Hardware
    private webSocket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private audioStreamer: AudioStreamer | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private localStream: MediaStream | null = null;

    // Estado da Transcrição
    private messages: Message[] = [];
    private userMessageId: string | null = null;
    private agentMessageId: string | null = null;

    // Fila do Loop de Batch (requestAnimationFrame) - Extremamente crítico manter a performance
    private messageQueue: any[] = [];
    private rafId: number | null = null;
    private latestUserText: string = '';

    // Reconexão
    private reconnectAttempts = 0;
    private MAX_RECONNECT_ATTEMPTS = 3;
    private callId: string = '';

    constructor(config: AiVoiceCoreConfig) {
        this.config = config;
        this.processBatch = this.processBatch.bind(this);
    }

    // --- State Notification Helpers ---
    private setStatus(newStatus: LiveStatus) {
        this.status = newStatus;
        if (this.config.onStatusChange) this.config.onStatusChange(this.status);
    }

    private setIsThinking(thinking: boolean) {
        if (this.isThinking !== thinking) {
            this.isThinking = thinking;
            if (this.config.onThinkingChange) this.config.onThinkingChange(this.isThinking);
        }
    }

    private emitMessages() {
        if (this.config.onMessagesChange) {
            // Clonamos a array para garantir que o React detecte a mudança
            this.config.onMessagesChange([...this.messages]);
        }
    }

    // --- Message Management (Síncrono) ---
    private addMessage(role: 'user' | 'agent' | 'agent_link', text: string, type: 'text' | 'link' = 'text', extra?: { url: string; alias: string }) {
        const id = Math.random().toString(36).substring(7);
        this.messages.push({ id, role, text, type, timestamp: new Date(), ...extra });
        this.emitMessages();
        return id;
    }

    private updateLiveMessage(role: 'user' | 'agent', text: string, isCumulative = false) {
        const msgIdRef = role === 'user' ? 'userMessageId' : 'agentMessageId';
        let msgId = this[msgIdRef];

        if (!msgId) {
            const newId = Math.random().toString(36).substring(7);
            this[msgIdRef] = newId;
            this.messages.push({ id: newId, role, text, type: 'text', timestamp: new Date() });
            this.emitMessages();
        } else {
            const index = this.messages.findIndex(m => m.id === msgId);
            if (index !== -1) {
                this.messages[index] = {
                    ...this.messages[index],
                    text: isCumulative ? text : (this.messages[index].text + text)
                };
                this.emitMessages();
            }
        }
    }

    private completeTurn() {
        this.userMessageId = null;
        this.agentMessageId = null;
    }

    private resetHistory() {
        this.messages = [];
        this.userMessageId = null;
        this.agentMessageId = null;
        this.latestUserText = '';
        this.messageQueue = [];
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.emitMessages();
    }

    // --- High-Performance Batch Processing Loop (Preservado do useTranscriptionManager) ---
    private processBatch() {
        if (this.messageQueue.length === 0) {
            this.rafId = null;
            return;
        }

        let agentTextDelta = "";
        let userTextToCommit: string | null = null;
        let turnCompleteEncoded = false;

        const currentBatch = [...this.messageQueue];
        this.messageQueue = [];

        currentBatch.forEach((serverContent) => {
            // 1. Agent Transcriptions
            if (serverContent.modelTurn?.parts || serverContent.model_turn?.parts) {
                this.setIsThinking(false);
                const parts = serverContent.modelTurn?.parts || serverContent.model_turn?.parts;
                parts.forEach((part: any) => {
                    const text = part.text || part.content;
                    if (text && !part.thought) agentTextDelta += text;
                });
            } else if (serverContent.outputTranscription?.text) {
                this.setIsThinking(false);
                agentTextDelta += serverContent.outputTranscription.text;
            }

            // 2. User Transcriptions
            const inputT = serverContent.inputTranscription || serverContent.input_transcription || serverContent.inputAudioTranscription;
            if (inputT) {
                const txt = inputT.text || "";
                if (txt) {
                    this.latestUserText += txt;
                    userTextToCommit = this.latestUserText.trim();
                }
            }

            // 3. Turn Management
            if (serverContent.turnComplete) {
                turnCompleteEncoded = true;
            }
        });

        if (agentTextDelta) {
            this.updateLiveMessage('agent', agentTextDelta, false);
        }

        if (userTextToCommit !== null) {
            this.updateLiveMessage('user', userTextToCommit, true);
        }

        if (turnCompleteEncoded) {
            this.setIsThinking(true);
            if (this.latestUserText) {
                this.updateLiveMessage('user', this.latestUserText.trim(), true);
            }
            this.completeTurn();
            this.latestUserText = '';
        }

        this.rafId = requestAnimationFrame(this.processBatch);
    }

    private handleServerContent(serverContent: any) {
        // Intercepta Links Nativos (Tool Calls Resolvidas no Backend)
        if (serverContent.type === 'link_bubble') {
            const { url, alias } = serverContent.payload;
            this.addMessage('agent_link', alias, 'link', { url, alias });
            return;
        }

        this.messageQueue.push(serverContent);

        if (!this.rafId) {
            this.rafId = requestAnimationFrame(this.processBatch);
        }
    }

    // --- Audio System ---
    private playAudioChunk(base64: string) {
        try {
            if (!this.audioStreamer) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                this.audioStreamer = new AudioStreamer(ctx);
                this.audioStreamer.gainNode.connect(ctx.destination);
            }

            if (this.audioStreamer.context.state === 'suspended') {
                this.audioStreamer.context.resume();
            }

            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            this.audioStreamer.push(bytes);
        } catch (err) {
            console.error('[AiVoiceCore] Playback error:', err);
        }
    }

    private async startAudioCapture() {
        try {
            // Aplicando restrições de Hardware VAD / Noise Suppression fortes
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1 // Força captura em mono para economizar banda/processamento
                }
            });

            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            // Requisita o Worklet Estático
            await this.audioContext.audioWorklet.addModule('/audio-processor.js');

            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

            this.workletNode.port.onmessage = (event) => {
                const buffer = event.data.buffer;
                if (this.webSocket && this.isLive && buffer) {
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                    if (this.webSocket.readyState === WebSocket.OPEN) {
                        this.webSocket.send(JSON.stringify({
                            type: 'realtime_input',
                            payload: { audio: { data: base64, mimeType: "audio/pcm;rate=16000" } }
                        }));
                    }
                }
            };

            source.connect(this.workletNode);
            // Ignora o output do mic para não gerar loop local
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;
            this.workletNode.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        } catch (err) {
            console.error('[AiVoiceCore] Mic error:', err);
        }
    }

    private stopAudioCapture() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close().catch(() => { });
            this.audioContext = null;
        }
    }

    // --- Public API ---
    public async connect(): Promise<void> {
        if (this.status === 'connecting' || this.isLive) return;

        try {
            this.setStatus('connecting');

            if (this.reconnectAttempts === 0) {
                this.callId = crypto.randomUUID();
                this.resetHistory();
            }

            this.isLive = true;

            const wsUrl = this.config.agentApiUrl.replace('http', 'ws') + '/ws?callId=' + this.callId + '&client=' + this.config.clientName;
            this.webSocket = new WebSocket(wsUrl);

            this.webSocket.onopen = () => {
                console.log('[AiVoiceCore] Orchestrator Connected');
                this.setStatus('connected');
                this.reconnectAttempts = 0;
                this.startAudioCapture();

                this.webSocket?.send(JSON.stringify({ type: 'setup', payload: {} }));
            };

            this.webSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'session_terminated') {
                    if (this.audioStreamer && this.audioStreamer.status() === 'playing') {
                        this.audioStreamer.onComplete = () => this.disconnect(true);
                    } else {
                        this.disconnect(true);
                    }
                    return;
                }

                const serverContent = data.server_content || data.serverContent || data;

                // Captura Áudio Diretamente (Bypass de React)
                const modelTurn = serverContent.model_turn || serverContent.modelTurn;
                if (modelTurn?.parts) {
                    modelTurn.parts.forEach((part: any) => {
                        if (part.inlineData?.data) this.playAudioChunk(part.inlineData.data);
                    });
                }

                // Processa Textos (Batching Queue)
                this.handleServerContent(serverContent);

                // Trata Thinking State Imediato
                if (serverContent.turn_complete || serverContent.turnComplete) {
                    this.setIsThinking(true);
                } else if (modelTurn || serverContent.output_transcription || serverContent.outputTranscription) {
                    this.setIsThinking(false);
                }
            };

            this.webSocket.onclose = (event) => {
                if (event.code !== 1000 && this.isLive && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
                    const timeout = baseDelay + Math.random() * 1000;
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connect();
                    }, timeout);
                } else if (event.code !== 1000 && this.isLive) {
                    this.setStatus('error');
                    this.disconnect(false);
                } else {
                    this.disconnect(false);
                }
            };

        } catch (err) {
            console.error('[AiVoiceCore] Initialization error:', err);
            this.setStatus('error');
            this.disconnect(false);
        }
    }

    public disconnect(isGraceful = true): void {
        this.isLive = false;
        this.setStatus('idle');
        this.setIsThinking(false);
        this.reconnectAttempts = 0;

        if (this.webSocket) {
            try { this.webSocket.close(); } catch (e) { }
            this.webSocket = null;
        }

        if (this.audioStreamer) {
            this.audioStreamer.stop();
            this.audioStreamer = null;
        }

        this.stopAudioCapture();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Disparar o beacon de off-board pro backend preencher BD (se necessário)
        if (!isGraceful && this.callId) {
            const url = `${this.config.agentApiUrl}/terminate?sessionId=${this.callId}`;
            navigator.sendBeacon(url);
        }
    }

    public sendMessage(text: string): void {
        if (!text.trim() || !this.isLive || !this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;

        this.setIsThinking(true);
        this.webSocket.send(JSON.stringify({
            type: 'client_content',
            payload: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true }
        }));
        this.addMessage('user', text);
    }
}
