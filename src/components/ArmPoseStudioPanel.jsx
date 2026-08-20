import React, { useState } from 'react';

export function ArmPoseStudioPanel({ customArmPose, onChangeArmPose, onToggleStudio }) {
  const [copied, setCopied] = useState(false);

  const handleSliderChange = (bone, axisIndex, value) => {
    const newPose = { ...customArmPose };
    newPose.enabled = true;
    newPose[bone] = [...newPose[bone]];
    newPose[bone][axisIndex] = parseFloat(value);
    onChangeArmPose(newPose);
  };

  const poseJson = JSON.stringify(
    {
      rightUpperArm: customArmPose.rightUpperArm,
      rightLowerArm: customArmPose.rightLowerArm,
      rightHand: customArmPose.rightHand
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(poseJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetNatural = () => {
    onChangeArmPose({
      enabled: true,
      rightUpperArm: [-0.05, 0, 1.35],
      rightLowerArm: [0, 0.15, 0],
      rightHand: [0, 0, 0]
    });
  };

  const handleResetWaveBase = () => {
    onChangeArmPose({
      enabled: true,
      rightUpperArm: [-0.1, 0.3, -1.2],
      rightLowerArm: [1.3, 0.1, 0.25],
      rightHand: [0, 0, 0.2]
    });
  };

  return (
    <div className="panel-card arm-studio-panel">
      <div className="panel-header">
        <h3>🎛️ Real-Time Arm Pose Studio</h3>
        <button
          className={`btn-reset ${customArmPose.enabled ? 'active' : ''}`}
          onClick={() => onToggleStudio(!customArmPose.enabled)}
        >
          {customArmPose.enabled ? '🟢 Studio Active' : '⚪ Enable Studio'}
        </button>
      </div>

      {customArmPose.enabled && (
        <>
          <div className="slider-group">
            <h4>Right Upper Arm (Shoulder)</h4>
            <div className="slider-row">
              <label>Rot X: {customArmPose.rightUpperArm[0].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightUpperArm[0]}
                onChange={(e) => handleSliderChange('rightUpperArm', 0, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Y: {customArmPose.rightUpperArm[1].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightUpperArm[1]}
                onChange={(e) => handleSliderChange('rightUpperArm', 1, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Z: {customArmPose.rightUpperArm[2].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightUpperArm[2]}
                onChange={(e) => handleSliderChange('rightUpperArm', 2, e.target.value)}
              />
            </div>
          </div>

          <div className="slider-group" style={{ marginTop: '10px' }}>
            <h4>Right Lower Arm (Elbow / Forearm)</h4>
            <div className="slider-row">
              <label>Rot X: {customArmPose.rightLowerArm[0].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightLowerArm[0]}
                onChange={(e) => handleSliderChange('rightLowerArm', 0, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Y: {customArmPose.rightLowerArm[1].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightLowerArm[1]}
                onChange={(e) => handleSliderChange('rightLowerArm', 1, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Z: {customArmPose.rightLowerArm[2].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightLowerArm[2]}
                onChange={(e) => handleSliderChange('rightLowerArm', 2, e.target.value)}
              />
            </div>
          </div>

          <div className="slider-group" style={{ marginTop: '10px' }}>
            <h4>Right Hand (Wrist)</h4>
            <div className="slider-row">
              <label>Rot X: {customArmPose.rightHand[0].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightHand[0]}
                onChange={(e) => handleSliderChange('rightHand', 0, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Y: {customArmPose.rightHand[1].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightHand[1]}
                onChange={(e) => handleSliderChange('rightHand', 1, e.target.value)}
              />
            </div>
            <div className="slider-row">
              <label>Rot Z: {customArmPose.rightHand[2].toFixed(2)}</label>
              <input
                type="range"
                min="-3.14"
                max="3.14"
                step="0.02"
                value={customArmPose.rightHand[2]}
                onChange={(e) => handleSliderChange('rightHand', 2, e.target.value)}
              />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: '12px' }}>
            <button className="btn-reset" onClick={handleResetNatural}>
              Stand Natural
            </button>
            <button className="btn-reset" onClick={handleResetWaveBase}>
              Wave Preset
            </button>
          </div>

          <div className="output-box" style={{ marginTop: '12px' }}>
            <div className="panel-header" style={{ marginBottom: '6px' }}>
              <span className="saved-title" style={{ margin: 0 }}>Rotation Output JSON</span>
              <button className="btn-reset" onClick={handleCopy}>
                {copied ? '✅ Copied!' : '📋 Copy Values'}
              </button>
            </div>
            <pre className="code-output">{poseJson}</pre>
          </div>
        </>
      )}
    </div>
  );
}
