/**
 * ExpressionController
 * Encapsulates expression control, lerp updates, pose state, and body animations (wave, nod, standing pose) for VRM models.
 * Extensible for Gemini tool-call hooks (e.g. expressEmotion, playAnimation).
 */

export class ExpressionController {
  constructor(vrm) {
    this.vrm = vrm;
    this.expressionManager = vrm?.expressionManager || null;
    this.humanoid = vrm?.humanoid || null;
    
    // Track target weights and current weights for smooth interpolation
    this.targetWeights = new Map();
    this.currentWeights = new Map();
    this.availableExpressions = [];
    
    // Active body animation state ('idle' / 'standing', 'wave', 'nod')
    this.activeAnimation = 'idle';
    this.animTimer = null;

    this.initExpressions();
  }

  initExpressions() {
    if (!this.expressionManager) {
      console.warn("ExpressionController: VRM has no expressionManager.");
      return;
    }

    const expressionsMap = this.expressionManager.expressions || {};
    const names = [];

    // Process expression names from VRM expression manager
    if (Array.isArray(expressionsMap)) {
      expressionsMap.forEach(e => {
        if (e.expressionName) names.push(e.expressionName);
      });
    } else if (typeof expressionsMap === 'object') {
      Object.keys(expressionsMap).forEach(key => names.push(key));
    }

    // Also check presetExpressionMap / customExpressionMap if present
    if (this.expressionManager.presetExpressionMap) {
      Object.keys(this.expressionManager.presetExpressionMap).forEach(name => {
        if (!names.includes(name)) names.push(name);
      });
    }
    if (this.expressionManager.customExpressionMap) {
      Object.keys(this.expressionManager.customExpressionMap).forEach(name => {
        if (!names.includes(name)) names.push(name);
      });
    }

    // De-duplicate names
    this.availableExpressions = Array.from(new Set(names));

    // Initialize weight tracking maps
    this.availableExpressions.forEach(name => {
      this.targetWeights.set(name, 0);
      this.currentWeights.set(name, 0);
    });

    console.log("VRM ExpressionController initialized with expressions:", this.availableExpressions);
  }

  getAvailableExpressions() {
    return this.availableExpressions;
  }

  /**
   * Set target weight for a specific expression (0.0 to 1.0)
   */
  setExpression(name, weight = 1.0, exclusive = false) {
    if (!this.expressionManager) return;

    if (exclusive) {
      this.targetWeights.forEach((_, key) => {
        const isVowel = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'].includes(key.toLowerCase());
        if (!isVowel) {
          this.targetWeights.set(key, 0);
        }
      });
    }

    if (this.targetWeights.has(name)) {
      this.targetWeights.set(name, Math.max(0, Math.min(1, weight)));
    } else {
      const found = this.availableExpressions.find(e => e.toLowerCase() === name.toLowerCase());
      if (found) {
        this.targetWeights.set(found, Math.max(0, Math.min(1, weight)));
      }
    }
  }

  /**
   * Directly update vowel weights (aa, ih, ou, ee, oh / a, i, u, e, o) for real-time lip-sync
   */
  setVowelWeights(vowels = {}) {
    if (!this.expressionManager) return;

    const vowelKeys = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'];

    vowelKeys.forEach(key => {
      const matchingExp = this.availableExpressions.find(e => e.toLowerCase() === key);
      if (matchingExp) {
        const weight = vowels[key] || 0;
        this.targetWeights.set(matchingExp, Math.max(0, Math.min(1, weight)));
      }
    });
  }

  /**
   * Reset vowel weights back to 0
   */
  resetVowels() {
    if (!this.expressionManager) return;
    const vowelKeys = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'];
    vowelKeys.forEach(key => {
      const matchingExp = this.availableExpressions.find(e => e.toLowerCase() === key);
      if (matchingExp) {
        this.targetWeights.set(matchingExp, 0);
      }
    });
  }

  /**
   * Reset all target expression weights to 0
   */
  resetExpressions() {
    this.targetWeights.forEach((_, key) => {
      this.targetWeights.set(key, 0);
    });
  }

  /**
   * Express emotion helper (Gemini tool-call entrypoint)
   */
  expressEmotion(emotionName, weight = 1.0) {
    this.setExpression(emotionName, weight, true);
  }

  /**
   * Trigger body animation / pose ('wave', 'nod', 'idle')
   * Extensible for Gemini tool calls: playAnimation("wave")
   */
  playAnimation(animationName, durationMs = 3500) {
    console.log(`[Animation Hook] Triggering body animation: "${animationName}"`);
    this.activeAnimation = animationName.toLowerCase();

    if (this.animTimer) {
      clearTimeout(this.animTimer);
      this.animTimer = null;
    }

    if (this.activeAnimation === 'wave') {
      // Trigger pleasant Happy facial expression while waving
      const happyExp = this.availableExpressions.find(e => ['happy', 'joy', 'fun'].includes(e.toLowerCase()));
      if (happyExp) {
        this.setExpression(happyExp, 0.45, true);
      }
    } else if (this.activeAnimation === 'idle' || this.activeAnimation === 'standing') {
      this.resetExpressions();
    }

    if (animationName !== 'idle' && animationName !== 'standing' && durationMs > 0) {
      this.animTimer = setTimeout(() => {
        this.activeAnimation = 'idle';
        this.resetExpressions();
      }, durationMs);
    }
  }

  /**
   * Apply natural standing posture and procedural animations (wave, breathing, nod)
   */
  updatePose(timeSec = 0) {
    if (!this.humanoid) return;

    const leftUpperArm = this.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = this.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = this.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = this.humanoid.getNormalizedBoneNode('rightLowerArm');
    const rightHand = this.humanoid.getNormalizedBoneNode('rightHand');
    const spine = this.humanoid.getNormalizedBoneNode('spine');
    const head = this.humanoid.getNormalizedBoneNode('head');

    // 1. Set pristine base standing posture for all bones every frame (arms resting down naturally)
    if (leftUpperArm) leftUpperArm.rotation.set(-0.05, 0, -Math.PI / 2.35);
    if (leftLowerArm) leftLowerArm.rotation.set(0, -0.15, 0);

    if (rightUpperArm) rightUpperArm.rotation.set(-0.05, 0, Math.PI / 2.35);
    if (rightLowerArm) rightLowerArm.rotation.set(0, 0.15, 0);
    if (rightHand) rightHand.rotation.set(0, 0, 0);

    if (head) head.rotation.set(Math.sin(timeSec * 1.2) * 0.02, 0, 0);

    if (spine) {
      spine.rotation.set(Math.sin(timeSec * 1.8) * 0.015, 0, Math.cos(timeSec * 1.2) * 0.008);
    }

    // 2. Apply active animation overrides on top of clean base standing pose
    if (this.activeAnimation === 'wave') {
      // Custom Wave Animation configured by user via Pose Studio
      if (rightUpperArm) {
        rightUpperArm.rotation.set(-0.12, 0.52, -1.2);
      }
      if (rightLowerArm) {
        // Rot Y sweeps smoothly between 0.40 and 0.70 radians
        const rotY = 0.55 + Math.sin(timeSec * 7) * 0.15;
        rightLowerArm.rotation.set(-0.88, rotY, -0.18);
      }
      if (rightHand) {
        const handZ = 0.08 + Math.sin(timeSec * 7 + 0.5) * 0.1;
        rightHand.rotation.set(-0.26, 0, handZ);
      }
    } else if (this.activeAnimation === 'nod') {
      if (head) {
        head.rotation.set(0.08 + Math.sin(timeSec * 5) * 0.12, 0, 0);
      }
    }
  }

  /**
   * Update weights smoothly (lerp) each frame.
   */
  update(delta = 0.016, lerpSpeed = 24) {
    if (!this.expressionManager) return;

    const factor = Math.min(1, delta * lerpSpeed);

    this.targetWeights.forEach((target, name) => {
      const current = this.currentWeights.get(name) || 0;
      if (Math.abs(target - current) > 0.001) {
        const next = current + (target - current) * factor;
        this.currentWeights.set(name, next);
        this.expressionManager.setValue(name, next);
      } else if (current !== target) {
        this.currentWeights.set(name, target);
        this.expressionManager.setValue(name, target);
      }
    });

    this.expressionManager.update();
  }
}
