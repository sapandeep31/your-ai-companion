/**
 * StreamLipSyncController
 * Handles Web Audio API AnalyserNode frequency & amplitude tracking
 * from a live audio stream (e.g. WebSocket buffers) to derive vowel weights
 * and drive VRM mouth movements.
 */

export class StreamLipSyncController {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.animationFrameId = null;
    this.isPlaying = false;
    this.currentAmplitude = 0;
  }

  /**
   * Connect an existing AudioContext and source node to the analyser
   */
  connectStream(audioContext, sourceNode, onAmplitudeUpdate) {
    this.audioContext = audioContext;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;
    }

    // Connect source to analyser, and analyser to destination (so it plays out loud)
    sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.isPlaying = true;

    if (!this.animationFrameId) {
      const updateLoop = () => {
        if (!this.isPlaying) return;

        const vowels = this.getVowelWeights();
        this.currentAmplitude = vowels.totalAmp;

        if (onAmplitudeUpdate) {
          onAmplitudeUpdate(this.currentAmplitude);
        }

        this.animationFrameId = requestAnimationFrame(updateLoop);
      };
      updateLoop();
    }
  }

  getVowelWeights() {
    if (!this.isPlaying || !this.analyser) {
      return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, a: 0, i: 0, u: 0, e: 0, o: 0, totalAmp: 0 };
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    let lowSum = 0, midLowSum = 0, midHighSum = 0, highSum = 0;

    for (let i = 1; i <= 5; i++) lowSum += freqData[i] || 0;
    for (let i = 5; i <= 12; i++) midLowSum += freqData[i] || 0;
    for (let i = 12; i <= 28; i++) midHighSum += freqData[i] || 0;
    for (let i = 28; i <= 55; i++) highSum += freqData[i] || 0;

    const low = (lowSum / 5) / 255.0;
    const midLow = (midLowSum / 7) / 255.0;
    const midHigh = (midHighSum / 16) / 255.0;
    const high = (highSum / 27) / 255.0;

    const timeDomainData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeDomainData);
    let rmsSum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const s = (timeDomainData[i] - 128) / 128.0;
      rmsSum += s * s;
    }
    const rms = Math.sqrt(rmsSum / timeDomainData.length);
    const totalAmp = Math.min(1.0, Math.max(0.0, rms * 4.5));

    const NOISE_FLOOR = 0.06;
    if (totalAmp < NOISE_FLOOR) {
      return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, a: 0, i: 0, u: 0, e: 0, o: 0, totalAmp: 0 };
    }

    const MAX_MOUTH_OPEN = 0.60;
    const aaWeight = Math.min(MAX_MOUTH_OPEN, Math.max(0.1 * totalAmp, midLow * 1.8 * totalAmp));
    const ihWeight = Math.min(MAX_MOUTH_OPEN * 0.75, high * 2.0 * totalAmp);
    const ouWeight = Math.min(MAX_MOUTH_OPEN * 0.80, low * 1.8 * totalAmp);
    const eeWeight = Math.min(MAX_MOUTH_OPEN * 0.80, midHigh * 1.8 * totalAmp);
    const ohWeight = Math.min(MAX_MOUTH_OPEN * 0.90, (midLow * 0.5 + low * 0.3) * 1.6 * totalAmp);

    return {
      aa: aaWeight, a: aaWeight,
      ih: ihWeight, i: ihWeight,
      ou: ouWeight, u: ouWeight,
      ee: eeWeight, e: eeWeight,
      oh: ohWeight, o: ohWeight,
      totalAmp
    };
  }

  stopPlayback() {
    this.isPlaying = false;
    this.currentAmplitude = 0;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset() {
    this.stopPlayback();
    return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, a: 0, i: 0, u: 0, e: 0, o: 0, totalAmp: 0 };
  }
}
