// AudioWorklet processor for converting mic input to PCM16 @ 16kHz
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetSampleRate = 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const samples = input[0]; // First channel (mono)
    const inputSampleRate = sampleRate; // Global sample rate (usually 48000)

    // Downsample to 16kHz if needed
    if (inputSampleRate === this.targetSampleRate) {
      this.buffer.push(...samples);
    } else {
      const ratio = inputSampleRate / this.targetSampleRate;
      for (let i = 0; i < samples.length; i += ratio) {
        this.buffer.push(samples[Math.floor(i)]);
      }
    }

    // Send chunks of ~100ms (1600 samples @ 16kHz)
    const chunkSize = 1600;
    while (this.buffer.length >= chunkSize) {
      const chunk = this.buffer.splice(0, chunkSize);
      
      // Convert float32 [-1, 1] to int16 PCM
      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }

    return true; // Keep processor alive
  }
}

registerProcessor("audio-processor", AudioProcessor);
