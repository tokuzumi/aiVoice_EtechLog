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
            let rmsSum = 0;

            for (let i = 0; i < inputData.length; i++) {
                const sample = inputData[i];
                rmsSum += sample * sample;

                this.buffer[this.bufferIndex++] = Math.max(-1, Math.min(1, sample)) * 0x7FFF;

                if (this.bufferIndex >= this.bufferSize) {
                    // Calcula o RMS (Root Mean Square) do frame
                    const rms = Math.sqrt(rmsSum / this.bufferSize);

                    // Zero-Padding Noise Gate: se o volume for muito baixo (ruído de fundo),
                    // enviamos um quadro de puro silêncio para a IA não tentar alucinar textos.
                    if (rms <= 0.002) {
                        this.buffer.fill(0);
                    }

                    const bufferToSend = this.buffer.slice().buffer;
                    this.port.postMessage({ buffer: bufferToSend }, [bufferToSend]);

                    this.bufferIndex = 0;
                    rmsSum = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
