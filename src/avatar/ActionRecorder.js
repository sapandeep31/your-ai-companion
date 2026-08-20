/**
 * ActionRecorder
 * Captures real-time VRM humanoid bone rotations and facial expression weights,
 * allows playback, exports JSON motion files, and saves actions to browser LocalStorage.
 */

export class ActionRecorder {
  constructor() {
    this.isRecording = false;
    this.isPlaying = false;
    this.recordedKeyframes = [];
    this.startTime = 0;
    this.playStartTime = 0;
    this.animFrameId = null;
  }

  startRecording() {
    this.recordedKeyframes = [];
    this.startTime = performance.now();
    this.isRecording = true;
    console.log("Started UI Action Recording...");
  }

  recordFrame(vrm, expressionController) {
    if (!this.isRecording || !vrm?.humanoid) return;

    const time = Number(((performance.now() - this.startTime) / 1000.0).toFixed(3));

    const boneNames = [
      'leftUpperArm', 'rightUpperArm', 
      'leftLowerArm', 'rightLowerArm', 
      'leftHand', 'rightHand', 
      'head', 'spine'
    ];
    
    const bones = {};

    boneNames.forEach(name => {
      const node = vrm.humanoid.getNormalizedBoneNode(name);
      if (node) {
        bones[name] = [
          Number(node.rotation.x.toFixed(4)),
          Number(node.rotation.y.toFixed(4)),
          Number(node.rotation.z.toFixed(4))
        ];
      }
    });

    const expressions = {};
    if (expressionController && expressionController.targetWeights) {
      expressionController.targetWeights.forEach((weight, expName) => {
        if (weight > 0.005) {
          expressions[expName] = Number(weight.toFixed(3));
        }
      });
    }

    this.recordedKeyframes.push({ time, bones, expressions });
  }

  stopRecording() {
    this.isRecording = false;
    const duration = this.recordedKeyframes.length > 0 
      ? this.recordedKeyframes[this.recordedKeyframes.length - 1].time 
      : 0;
    
    console.log(`Stopped Action Recording. Captured ${this.recordedKeyframes.length} keyframes over ${duration.toFixed(2)}s.`);

    return {
      duration,
      count: this.recordedKeyframes.length,
      keyframes: this.recordedKeyframes
    };
  }

  playKeyframes(keyframes, vrm, expressionController, onStateChange) {
    if (!keyframes || keyframes.length === 0) return;

    this.isPlaying = true;
    if (onStateChange) onStateChange(true);

    this.playStartTime = performance.now();
    const duration = keyframes[keyframes.length - 1].time;

    const animatePlay = () => {
      if (!this.isPlaying) return;

      const elapsed = (performance.now() - this.playStartTime) / 1000.0;

      if (elapsed > duration) {
        this.isPlaying = false;
        if (onStateChange) onStateChange(false);
        return;
      }

      // Find keyframe at current elapsed time
      let frame = keyframes[0];
      for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i].time <= elapsed) {
          frame = keyframes[i];
        } else {
          break;
        }
      }

      if (frame && vrm?.humanoid) {
        Object.keys(frame.bones).forEach(boneName => {
          const node = vrm.humanoid.getNormalizedBoneNode(boneName);
          if (node) {
            const [x, y, z] = frame.bones[boneName];
            node.rotation.set(x, y, z);
          }
        });

        if (expressionController && frame.expressions) {
          Object.keys(frame.expressions).forEach(expName => {
            expressionController.setExpression(expName, frame.expressions[expName], false);
          });
        }
      }

      this.animFrameId = requestAnimationFrame(animatePlay);
    };

    animatePlay();
  }

  stopPlayback(onStateChange) {
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (onStateChange) onStateChange(false);
  }

  exportJSON(actionName = 'vrm-action') {
    if (this.recordedKeyframes.length === 0) return;

    const payload = {
      name: actionName,
      createdAt: new Date().toISOString(),
      duration: this.recordedKeyframes[this.recordedKeyframes.length - 1].time,
      keyframes: this.recordedKeyframes
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${actionName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  saveToLocalStorage(actionName = 'Custom Motion') {
    if (this.recordedKeyframes.length === 0) return [];

    const duration = this.recordedKeyframes[this.recordedKeyframes.length - 1].time;
    const action = {
      id: Date.now(),
      name: actionName,
      duration,
      keyframes: this.recordedKeyframes
    };

    const saved = this.getSavedActions();
    saved.unshift(action);
    localStorage.setItem('vrm_recorded_actions', JSON.stringify(saved));
    return saved;
  }

  getSavedActions() {
    try {
      const data = localStorage.getItem('vrm_recorded_actions');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  deleteSavedAction(id) {
    const saved = this.getSavedActions().filter(item => item.id !== id);
    localStorage.setItem('vrm_recorded_actions', JSON.stringify(saved));
    return saved;
  }
}
