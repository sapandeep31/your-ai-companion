import React from 'react';

export function AudioControls({
  isRecording,
  hasRecording,
  isPlaying,
  mouthAmplitude,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onStopPlayback
}) {
  return (
    <div className="panel-card audio-panel">
      <div className="panel-header">
        <h3>Audio Recording & Lip Sync</h3>
        <div className={`status-badge ${isRecording ? 'recording' : isPlaying ? 'playing' : hasRecording ? 'ready' : 'idle'}`}>
          {isRecording && <span className="pulse-dot"></span>}
          {isRecording ? 'Recording...' : isPlaying ? 'Playing Audio...' : hasRecording ? 'Audio Saved' : 'Idle'}
        </div>
      </div>

      <div className="audio-actions">
        {!isRecording ? (
          <button
            className="btn-action btn-record"
            onClick={onStartRecording}
            disabled={isPlaying}
          >
            🎙️ Start Recording
          </button>
        ) : (
          <button
            className="btn-action btn-stop"
            onClick={onStopRecording}
          >
            ⏹️ Stop Recording
          </button>
        )}

        {!isPlaying ? (
          <button
            className="btn-action btn-play"
            onClick={onPlayRecording}
            disabled={!hasRecording || isRecording}
          >
            ▶️ Play Recording
          </button>
        ) : (
          <button
            className="btn-action btn-pause"
            onClick={onStopPlayback}
          >
            ⏸️ Stop Playback
          </button>
        )}
      </div>

      <div className="amplitude-visualizer">
        <div className="meter-label">
          <span>Lip Sync Amplitude</span>
          <span>{(mouthAmplitude * 100).toFixed(0)}%</span>
        </div>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${Math.min(100, mouthAmplitude * 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
