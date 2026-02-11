/**
 * Ported from official Google Gemini Multimodal Live API samples.
 * Manages audio buffering and continuous playback to eliminate clicks/pops.
 */
export type AudioStreamerStatus = 'playing' | 'stopped' | 'complete';

export class AudioStreamer {
    private sampleRate: number = 24000;
    private bufferSize: number = 7680;
    private audioQueue: Float32Array[] = [];
    private isPlaying: boolean = false;
    private isStreamComplete: boolean = false;
    private checkInterval: number | null = null;
    private scheduledTime: number = 0;
    private initialBufferTime: number = 0.08; // 80ms initial buffer
    public gainNode: GainNode;
    private endOfQueueAudioSource: AudioBufferSourceNode | null = null;

    public onComplete = () => { };

    constructor(public context: AudioContext) {
        this.gainNode = this.context.createGain();
        // A conexão será feita externamente para permitir o Analyser
    }

    /**
     * Interface Oficial
     */

    // Método 1: Push (antigo addPCM16)
    push(chunk: Uint8Array) {
        this.addPCM16(chunk);
    }

    // Método 2: Status
    status(): AudioStreamerStatus {
        if (this.isStreamComplete && !this.isPlaying) return 'complete';
        if (this.isPlaying) return 'playing';
        return 'stopped';
    }

    /* --- Logic Internals (Preserved) --- */

    private _processPCM16Chunk(chunk: Uint8Array): Float32Array {
        const float32Array = new Float32Array(chunk.length / 2);
        const dataView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

        for (let i = 0; i < chunk.length / 2; i++) {
            try {
                const int16 = dataView.getInt16(i * 2, true);
                float32Array[i] = int16 / 32768;
            } catch (e) {
                console.error(e);
            }
        }
        return float32Array;
    }

    private addPCM16(chunk: Uint8Array) {
        this.isStreamComplete = false;
        let processingBuffer = this._processPCM16Chunk(chunk);

        while (processingBuffer.length >= this.bufferSize) {
            const buffer = processingBuffer.slice(0, this.bufferSize);
            this.audioQueue.push(buffer);
            processingBuffer = processingBuffer.slice(this.bufferSize);
        }
        if (processingBuffer.length > 0) {
            this.audioQueue.push(processingBuffer);
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.scheduledTime = this.context.currentTime + this.initialBufferTime;
            this.scheduleNextBuffer();
        }
    }

    private createAudioBuffer(audioData: Float32Array): AudioBuffer {
        const audioBuffer = this.context.createBuffer(1, audioData.length, this.sampleRate);
        audioBuffer.getChannelData(0).set(audioData);
        return audioBuffer;
    }

    private scheduleNextBuffer() {
        const SCHEDULE_AHEAD_TIME = 0.15;

        while (
            this.audioQueue.length > 0 &&
            this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME
        ) {
            const audioData = this.audioQueue.shift()!;
            const audioBuffer = this.createAudioBuffer(audioData);
            const source = this.context.createBufferSource();

            if (this.audioQueue.length === 0) {
                if (this.endOfQueueAudioSource) {
                    this.endOfQueueAudioSource.onended = null;
                }
                this.endOfQueueAudioSource = source;
                source.onended = () => {
                    if (!this.audioQueue.length && this.endOfQueueAudioSource === source) {
                        this.endOfQueueAudioSource = null;
                        this.onComplete();
                    }
                };
            }

            source.buffer = audioBuffer;
            source.connect(this.gainNode);

            const startTime = Math.max(this.scheduledTime, this.context.currentTime);
            source.start(startTime);
            this.scheduledTime = startTime + audioBuffer.duration;
        }

        if (this.audioQueue.length === 0) {
            if (this.isStreamComplete) {
                this.isPlaying = false;
                if (this.checkInterval) {
                    clearInterval(this.checkInterval);
                    this.checkInterval = null;
                }
            } else {
                if (!this.checkInterval) {
                    this.checkInterval = window.setInterval(() => {
                        if (this.audioQueue.length > 0) {
                            this.scheduleNextBuffer();
                        }
                    }, 100) as unknown as number;
                }
            }
        } else {
            const nextCheckTime = (this.scheduledTime - this.context.currentTime) * 1000;
            setTimeout(() => this.scheduleNextBuffer(), Math.max(0, nextCheckTime - 50));
        }
    }

    stop() {
        this.isPlaying = false;
        this.isStreamComplete = true;
        this.audioQueue = [];
        this.scheduledTime = this.context.currentTime;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);

        setTimeout(() => {
            this.gainNode.disconnect();
            this.gainNode = this.context.createGain();
            this.gainNode.connect(this.context.destination);
        }, 200);
    }

    async resume() {
        if (this.context.state === "suspended") {
            await this.context.resume();
        }
        this.isStreamComplete = false;
        this.scheduledTime = this.context.currentTime + this.initialBufferTime;
        this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
    }

    complete() {
        this.isStreamComplete = true;
        this.onComplete();
    }
}
