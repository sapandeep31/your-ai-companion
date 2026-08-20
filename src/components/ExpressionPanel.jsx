import React from 'react';

// Friendly display name map for VRM expression presets
const EXPRESSION_DISPLAY_NAMES = {
  neutral: 'Neutral',
  happy: 'Happy / Joy',
  joy: 'Joy',
  fun: 'Fun / Relaxed',
  relaxed: 'Relaxed',
  angry: 'Angry',
  sad: 'Sad / Sorrow',
  sorrow: 'Sorrow',
  surprised: 'Surprised',
  blink: 'Blink Both',
  blinkleft: 'Blink Left',
  blinkright: 'Blink Right',
  aa: 'Mouth: A (aa)',
  ih: 'Mouth: I (ih)',
  ou: 'Mouth: U (ou)',
  ee: 'Mouth: E (ee)',
  oh: 'Mouth: O (oh)',
  a: 'Mouth: A',
  i: 'Mouth: I',
  u: 'Mouth: U',
  e: 'Mouth: E',
  o: 'Mouth: O',
};

export function ExpressionPanel({
  expressions = [],
  activeExpression,
  activeAnimation,
  onSelectExpression,
  onSelectAnimation,
  onReset
}) {
  const filteredExpressions = expressions.filter(e => {
    const lower = e.toLowerCase();
    const isVowel = ['aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'].includes(lower);
    const isLook = ['lookdown', 'lookup', 'lookleft', 'lookright'].includes(lower);
    return !isVowel && !isLook;
  });

  return (
    <div className="panel-card expression-panel">
      <div className="panel-header">
        <h3>Body Motion & Poses</h3>
      </div>
      <div className="expression-grid" style={{ marginBottom: '16px' }}>
        <button
          className={`btn-expression ${activeAnimation === 'wave' ? 'active' : ''}`}
          onClick={() => onSelectAnimation('wave')}
        >
          👋 Wave Hand
        </button>
        <button
          className={`btn-expression ${activeAnimation === 'nod' ? 'active' : ''}`}
          onClick={() => onSelectAnimation('nod')}
        >
          😊 Greeting Nod
        </button>
        <button
          className={`btn-expression ${!activeAnimation || activeAnimation === 'idle' ? 'active' : ''}`}
          onClick={() => onSelectAnimation('idle')}
        >
          🧍 Stand Natural
        </button>
      </div>

      <div className="panel-header">
        <h3>Facial Expressions</h3>
        <button
          className="btn-reset"
          onClick={onReset}
          title="Reset all expressions to neutral"
        >
          ↺ Reset Expression
        </button>
      </div>

      {filteredExpressions.length === 0 ? (
        <div className="panel-empty">Inspect loaded model to discover expressions...</div>
      ) : (
        <div className="expression-grid">
          {filteredExpressions.map((expName) => {
            const lowerKey = expName.toLowerCase();
            const label = EXPRESSION_DISPLAY_NAMES[lowerKey] || expName;
            const isActive = activeExpression === expName;

            return (
              <button
                key={expName}
                className={`btn-expression ${isActive ? 'active' : ''}`}
                onClick={() => onSelectExpression(isActive ? null : expName)}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
