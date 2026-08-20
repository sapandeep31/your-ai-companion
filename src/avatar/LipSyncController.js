/**
 * LipSyncController
 * Handles MediaRecorder audio capture and Web Audio API AnalyserNode frequency & amplitude tracking
 * to derive vowel weights (aa, ih, ou, ee, oh / a, i, u, e, o) and drive VRM mouth movements.
 */

export class LipSyncController {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioBlob = null;
    this.audioUrl = null;
    this.audioElement = null;

    this.audioContext = null;
    this.analyser = null;
    this.sourceNode = null;
    this.animationFrameId = null;

    this.isPlaying = false;
    this.isRecording = false;
    this.currentAmplitude = 0;
  }

  /**
   * Start recording microphone audio
   */
  async startRecording(onStateChange) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        if (this.audioUrl) {
          URL.revokeObjectURL(this.audioUrl);
        }
        this.audioUrl = URL.createObjectURL(this.audioBlob);
        this.isRecording = false;
        if (onStateChange) onStateChange({ isRecording: false, hasRecording: true, isPlaying: false });
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      if (onStateChange) onStateChange({ isRecording: true, hasRecording: false, isPlaying: false });
      return true;
    } catch (err) {
      console.error("Failed to access microphone:", err);
      throw err;
    }
  }

  /**
   * Stop microphone recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Play recorded audio and drive real-time mouth movement
   */
  async playRecording(onAmplitudeUpdate, onStateChange) {
    if (!this.audioUrl) return;

    if (this.isPlaying) {
      this.stopPlayback(onStateChange, onAmplitudeUpdate);
    }

    // Initialize Web Audio Context
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create fresh Audio element
    this.audioElement = new Audio(this.audioUrl);

    // Create AnalyserNode
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.4;

    try {
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (err) {
      console.error("MediaElementAudioSourceNode error:", err);
    }

    this.isPlaying = true;
    if (onStateChange) onStateChange({ isRecording: false, hasRecording: true, isPlaying: true });

    this.audioElement.play().catch(err => {
      console.error("Playback error:", err);
      this.stopPlayback(onStateChange, onAmplitudeUpdate);
    });

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

    this.audioElement.onended = () => {
      this.stopPlayback(onStateChange, onAmplitudeUpdate);
    };
  }

  /**
   * Analyze audio frequency spectrum and map to VRM mouth vowel weights (aa, ih, ou, ee, oh / a, i, u, e, o)
   */
  getVowelWeights() {
    if (!this.isPlaying || !this.analyser) {
      return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, a: 0, i: 0, u: 0, e: 0, o: 0, totalAmp: 0 };
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    // Calculate energy across speech frequency bands
    // 512 FFT size @ 44.1kHz = ~86 Hz per bin
    let lowSum = 0, midLowSum = 0, midHighSum = 0, highSum = 0;

    for (let i = 1; i <= 5; i++) lowSum += freqData[i] || 0;         // ~80 - 430 Hz (u/ou)
    for (let i = 5; i <= 12; i++) midLowSum += freqData[i] || 0;     // ~430 - 1000 Hz (a/aa & o/oh)
    for (let i = 12; i <= 28; i++) midHighSum += freqData[i] || 0;   // ~1000 - 2400 Hz (e/ee)
    for (let i = 28; i <= 55; i++) highSum += freqData[i] || 0;      // ~2400 - 4700 Hz (i/ih)

    const low = (lowSum / 5) / 255.0;
    const midLow = (midLowSum / 7) / 255.0;
    const midHigh = (midHighSum / 16) / 255.0;
    const high = (highSum / 27) / 255.0;

    // Overall RMS total volume amplitude
    const timeDomainData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeDomainData);
    let rmsSum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const s = (timeDomainData[i] - 128) / 128.0;
      rmsSum += s * s;
    }
    const rms = Math.sqrt(rmsSum / timeDomainData.length);
    const totalAmp = Math.min(1.0, Math.max(0.0, rms * 4.5));

    // Noise floor threshold to ignore silence & background static
    const NOISE_FLOOR = 0.06;
    if (totalAmp < NOISE_FLOOR) {
      return { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, a: 0, i: 0, u: 0, e: 0, o: 0, totalAmp: 0 };
    }

    // Maximum mouth open ceiling (0.60 = 60% max morph target weight to prevent over-stretching the jaw)
    const MAX_MOUTH_OPEN = 0.60;

    // Weight vowels relative to speech frequency envelope & total amplitude with max threshold caps
    const aaWeight = Math.min(MAX_MOUTH_OPEN, Math.max(0.1 * totalAmp, midLow * 1.8 * totalAmp));
    const ihWeight = Math.min(MAX_MOUTH_OPEN * 0.75, high * 2.0 * totalAmp);
    const ouWeight = Math.min(MAX_MOUTH_OPEN * 0.80, low * 1.8 * totalAmp);
    const eeWeight = Math.min(MAX_MOUTH_OPEN * 0.80, midHigh * 1.8 * totalAmp);
    const ohWeight = Math.min(MAX_MOUTH_OPEN * 0.90, (midLow * 0.5 + low * 0.3) * 1.6 * totalAmp);

    return {
      aa: aaWeight,
      a: aaWeight,
      ih: ihWeight,
      i: ihWeight,
      ou: ouWeight,
      u: ouWeight,
      ee: eeWeight,
      e: eeWeight,
      oh: ohWeight,
      o: ohWeight,
      totalAmp
    };
  }

  /**
   * Stop audio playback and reset mouth position
   */
  stopPlayback(onStateChange, onAmplitudeUpdate) {
    this.isPlaying = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    this.currentAmplitude = 0;
    if (onAmplitudeUpdate) {
      onAmplitudeUpdate(0);
    }

    if (onStateChange) {
      onStateChange({ isRecording: false, hasRecording: !!this.audioUrl, isPlaying: false });
    }
  }

  dispose() {
    this.stopPlayback();
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
    }
  }
}
