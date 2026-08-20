import React, { useState, useEffect } from 'react';

export function ActionRecorderPanel({
  isRecording,
  hasRecordedData,
  isPlayingRecorded,
  recordedDuration,
  onStartRecord,
  onStopRecord,
  onPlayRecorded,
  onStopPlay,
  onSaveLocal,
  onExportJSON,
  onImportJSON,
  savedActions = [],
  onPlaySavedAction,
  onDeleteSavedAction
}) {
  const [actionName, setActionName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSaveSubmit = (e) => {
    e.preventDefault();
    const nameToSave = actionName.trim() || `Motion ${savedActions.length + 1}`;
    onSaveLocal(nameToSave);
    setActionName('');
    setShowSaveInput(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && (Array.isArray(parsed) || Array.isArray(parsed.keyframes))) {
          const keyframes = Array.isArray(parsed) ? parsed : parsed.keyframes;
          const name = parsed.name || file.name.replace('.json', '');
          onImportJSON(name, keyframes);
        } else {
          alert("Invalid JSON motion keyframe format.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="panel-card action-recorder-panel">
      <div className="panel-header">
        <h3>UI Action / Motion Recorder</h3>
        <div className={`status-badge ${isRecording ? 'recording' : isPlayingRecorded ? 'playing' : hasRecordedData ? 'ready' : 'idle'}`}>
          {isRecording && <span className="pulse-dot"></span>}
          {isRecording ? 'Recording Motion...' : isPlayingRecorded ? 'Playing Motion...' : hasRecordedData ? 'Motion Captured' : 'Idle'}
        </div>
      </div>

      <div className="audio-actions">
        {!isRecording ? (
          <button
            className="btn-action btn-record"
            onClick={onStartRecord}
            disabled={isPlayingRecorded}
          >
            🔴 Record UI Motion
          </button>
        ) : (
          <button
            className="btn-action btn-stop"
            onClick={onStopRecord}
          >
            ⏹️ Stop Motion Recording
          </button>
        )}

        {!isPlayingRecorded ? (
          <button
            className="btn-action btn-play"
            onClick={onPlayRecorded}
            disabled={!hasRecordedData || isRecording}
          >
            ▶️ Play Motion ({recordedDuration > 0 ? `${recordedDuration.toFixed(1)}s` : '0s'})
          </button>
        ) : (
          <button
            className="btn-action btn-pause"
            onClick={onStopPlay}
          >
            ⏸️ Stop Motion Playback
          </button>
        )}
      </div>

      {hasRecordedData && !isRecording && (
        <div className="recorder-save-options">
          {!showSaveInput ? (
            <div className="btn-row">
              <button
                className="btn-reset"
                onClick={() => setShowSaveInput(true)}
              >
                💾 Save to Local Storage
              </button>
              <button
                className="btn-reset"
                onClick={onExportJSON}
              >
                📥 Export JSON File
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveSubmit} className="save-form">
              <input
                type="text"
                placeholder="Motion name (e.g. My Wave)"
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
                className="input-motion-name"
                autoFocus
              />
              <button type="submit" className="btn-reset">Save</button>
              <button type="button" className="btn-reset" onClick={() => setShowSaveInput(false)}>Cancel</button>
            </form>
          )}
        </div>
      )}

      <div className="import-section" style={{ marginTop: '12px' }}>
        <label className="btn-reset file-upload-label">
          📤 Load Motion JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {savedActions.length > 0 && (
        <div className="saved-actions-list">
          <h4 className="saved-title">Saved Local Motions</h4>
          <div className="saved-items">
            {savedActions.map((item) => (
              <div key={item.id} className="saved-item">
                <span className="saved-name">{item.name} ({item.duration ? item.duration.toFixed(1) : 0}s)</span>
                <div className="saved-btns">
                  <button
                    className="btn-expression active"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => onPlaySavedAction(item)}
                  >
                    ▶️ Play
                  </button>
                  <button
                    className="btn-reset"
                    style={{ color: '#ff5252' }}
                    onClick={() => onDeleteSavedAction(item.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
