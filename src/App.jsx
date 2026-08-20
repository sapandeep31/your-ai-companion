import React, { useState, useRef, useEffect } from 'react';
import { AvatarScene } from './components/AvatarScene';
import { ExpressionPanel } from './components/ExpressionPanel';
import { AudioControls } from './components/AudioControls';
import { ActionRecorderPanel } from './components/ActionRecorderPanel';
import { ArmPoseStudioPanel } from './components/ArmPoseStudioPanel';
import { LipSyncController } from './avatar/LipSyncController';
import { ActionRecorder } from './avatar/ActionRecorder';
import './styles/app.css';

export default function App() {
  const [expressions, setExpressions] = useState([]);
  const [activeExpression, setActiveExpression] = useState(null);
  const [activeAnimation, setActiveAnimation] = useState('idle');
  const [mouthAmplitude, setMouthAmplitude] = useState(0);

  const [customArmPose, setCustomArmPose] = useState({
    enabled: false,
    rightUpperArm: [-0.1, 0.3, -1.2],
    rightLowerArm: [1.3, 0.1, 0.25],
    rightHand: [0, 0, 0.2]
  });

  const [vrmContext, setVrmContext] = useState(null);

  const [audioState, setAudioState] = useState({
    isRecording: false,
    hasRecording: false,
    isPlaying: false
  });

  const [recorderState, setRecorderState] = useState({
    isRecording: false,
    hasData: false,
    isPlaying: false,
    duration: 0
  });

  const [savedActions, setSavedActions] = useState([]);

  const lipSyncRef = useRef(null);
  const actionRecorderRef = useRef(null);

  // Initialize Controllers
  useEffect(() => {
    lipSyncRef.current = new LipSyncController();
    actionRecorderRef.current = new ActionRecorder();

    setSavedActions(actionRecorderRef.current.getSavedActions());

    return () => {
      if (lipSyncRef.current) {
        lipSyncRef.current.dispose();
      }
    };
  }, []);

  const handleVrmLoaded = (ctx) => {
    console.log("VRM loaded into App. Available expressions:", ctx.expressions);
    setExpressions(ctx.expressions);
    setVrmContext(ctx);
  };

  const handleStartRecordingAudio = async () => {
    if (!lipSyncRef.current) return;
    try {
      await lipSyncRef.current.startRecording(setAudioState);
    } catch (err) {
      alert("Microphone permission was denied or is unavailable in your browser.");
    }
  };

  const handleStopRecordingAudio = () => {
    if (lipSyncRef.current) {
      lipSyncRef.current.stopRecording();
    }
  };

  const handlePlayRecordingAudio = () => {
    if (!lipSyncRef.current) return;
    lipSyncRef.current.playRecording(
      (amp) => setMouthAmplitude(amp),
      (state) => setAudioState(state)
    );
  };

  const handleStopPlaybackAudio = () => {
    if (lipSyncRef.current) {
      lipSyncRef.current.stopPlayback(setAudioState, (amp) => setMouthAmplitude(amp));
    }
  };

  // Motion / Action Recorder Handlers
  const handleStartRecordMotion = () => {
    if (!actionRecorderRef.current) return;
    actionRecorderRef.current.startRecording();
    setRecorderState({ isRecording: true, hasData: false, isPlaying: false, duration: 0 });
  };

  const handleStopRecordMotion = () => {
    if (!actionRecorderRef.current) return;
    const result = actionRecorderRef.current.stopRecording();
    setRecorderState({
      isRecording: false,
      hasData: result.count > 0,
      isPlaying: false,
      duration: result.duration
    });
  };

  const handlePlayRecordedMotion = () => {
    if (!actionRecorderRef.current || !vrmContext) return;
    const rec = actionRecorderRef.current;
    rec.playKeyframes(
      rec.recordedKeyframes,
      vrmContext.vrm,
      vrmContext.controller,
      (playing) => setRecorderState((prev) => ({ ...prev, isPlaying: playing }))
    );
  };

  const handleStopPlayMotion = () => {
    if (!actionRecorderRef.current) return;
    actionRecorderRef.current.stopPlayback((playing) => 
      setRecorderState((prev) => ({ ...prev, isPlaying: playing }))
    );
  };

  const handleSaveLocalMotion = (name) => {
    if (!actionRecorderRef.current) return;
    const updated = actionRecorderRef.current.saveToLocalStorage(name);
    setSavedActions(updated);
  };

  const handleExportJSONMotion = () => {
    if (!actionRecorderRef.current) return;
    actionRecorderRef.current.exportJSON();
  };

  const handleImportJSONMotion = (name, keyframes) => {
    if (!actionRecorderRef.current || !vrmContext) return;
    actionRecorderRef.current.recordedKeyframes = keyframes;
    const duration = keyframes.length > 0 ? keyframes[keyframes.length - 1].time : 0;
    setRecorderState({
      isRecording: false,
      hasData: true,
      isPlaying: false,
      duration
    });
    actionRecorderRef.current.playKeyframes(
      keyframes,
      vrmContext.vrm,
      vrmContext.controller,
      (playing) => setRecorderState((prev) => ({ ...prev, isPlaying: playing }))
    );
  };

  const handlePlaySavedAction = (item) => {
    if (!actionRecorderRef.current || !vrmContext) return;
    actionRecorderRef.current.playKeyframes(
      item.keyframes,
      vrmContext.vrm,
      vrmContext.controller,
      (playing) => setRecorderState((prev) => ({ ...prev, isPlaying: playing }))
    );
  };

  const handleDeleteSavedAction = (id) => {
    if (!actionRecorderRef.current) return;
    const updated = actionRecorderRef.current.deleteSavedAction(id);
    setSavedActions(updated);
  };

  const handleSelectExpression = (expName) => {
    setActiveExpression(expName);

    if (expName) {
      const lower = expName.toLowerCase();
      if (['blink', 'blinkleft', 'blinkright'].includes(lower)) {
        setTimeout(() => {
          setActiveExpression((current) => (current === expName ? null : current));
        }, 350);
      }
    }
  };

  const handleSelectAnimation = (animName) => {
    setActiveAnimation(animName);
    if (customArmPose.enabled) {
      setCustomArmPose((prev) => ({ ...prev, enabled: false }));
    }
  };

  const handleResetExpression = () => {
    setActiveExpression('reset');
    setActiveAnimation('idle');
    setCustomArmPose((prev) => ({ ...prev, enabled: false }));
    setTimeout(() => setActiveExpression(null), 100);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-title">
          <h1>VRM Avatar Interactive Prototype</h1>
          <span className="badge-vrm">Three-VRM + Pose Studio</span>
        </div>
      </header>

      <main className="app-content">
        <section className="viewport-section">
          <AvatarScene
            activeExpression={activeExpression}
            activeAnimation={activeAnimation}
            customArmPose={customArmPose}
            lipSyncController={lipSyncRef.current}
            actionRecorder={actionRecorderRef.current}
            onVrmLoaded={handleVrmLoaded}
          />
        </section>

        <aside className="controls-sidebar">
          <ArmPoseStudioPanel
            customArmPose={customArmPose}
            onChangeArmPose={setCustomArmPose}
            onToggleStudio={(enabled) => setCustomArmPose((prev) => ({ ...prev, enabled }))}
          />

          <ActionRecorderPanel
            isRecording={recorderState.isRecording}
            hasRecordedData={recorderState.hasData}
            isPlayingRecorded={recorderState.isPlaying}
            recordedDuration={recorderState.duration}
            onStartRecord={handleStartRecordMotion}
            onStopRecord={handleStopRecordMotion}
            onPlayRecorded={handlePlayRecordedMotion}
            onStopPlay={handleStopPlayMotion}
            onSaveLocal={handleSaveLocalMotion}
            onExportJSON={handleExportJSONMotion}
            onImportJSON={handleImportJSONMotion}
            savedActions={savedActions}
            onPlaySavedAction={handlePlaySavedAction}
            onDeleteSavedAction={handleDeleteSavedAction}
          />

          <ExpressionPanel
            expressions={expressions}
            activeExpression={activeExpression}
            activeAnimation={activeAnimation}
            onSelectExpression={handleSelectExpression}
            onSelectAnimation={handleSelectAnimation}
            onReset={handleResetExpression}
          />

          <AudioControls
            isRecording={audioState.isRecording}
            hasRecording={audioState.hasRecording}
            isPlaying={audioState.isPlaying}
            mouthAmplitude={mouthAmplitude}
            onStartRecording={handleStartRecordingAudio}
            onStopRecording={handleStopRecordingAudio}
            onPlayRecording={handlePlayRecordingAudio}
            onStopPlayback={handleStopPlaybackAudio}
          />
        </aside>
      </main>
    </div>
  );
}
