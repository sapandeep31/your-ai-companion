import React from 'react';

export function MemoryModal({ isOpen, onClose, persona, onClearMemory }) {
  if (!isOpen || !persona) return null;

  const memory = persona.context_memory || {};
  const summary = memory.summary || (typeof memory === 'string' ? memory : '');
  const highlights = memory.highlights || [];
  const updatedAt = memory.updated_at ? new Date(memory.updated_at).toLocaleString() : null;

  const hasMemory = Boolean(summary || highlights.length > 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '520px',
          padding: '2rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
          position: 'relative',
          color: '#f8fafc',
          fontFamily: 'Inter, sans-serif',
          animation: 'modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.4rem',
            lineHeight: 1,
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
        >
          &times;
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🧠</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>
              {persona.name}'s Memory
            </h2>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Consolidated rolling memory & shared context
            </span>
          </div>
        </div>

        {hasMemory ? (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '1.2rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Summary of What She Knows
              </h4>
              <p style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                {summary}
              </p>
            </div>

            {highlights.length > 0 && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '16px',
                padding: '1.2rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Key Highlights & Insights
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  {highlights.map((hl, idx) => (
                    <li key={idx} style={{ marginBottom: '0.3rem' }}>{hl}</li>
                  ))}
                </ul>
              </div>
            )}

            {updatedAt && (
              <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right', marginBottom: '1.2rem' }}>
                Last synced: {updatedAt}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {onClearMemory && (
                <button
                  type="button"
                  onClick={() => {
                    onClearMemory(persona.slug, persona.name);
                    onClose();
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    padding: '0.65rem 1.1rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  🧹 Clear Memory
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn-primary-glow"
                style={{ padding: '0.65rem 1.4rem' }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            marginTop: '1.25rem'
          }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🌱</div>
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>No Memories Yet</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
              {persona.name} hasn't formed any long-term memories with you yet. Start a live conversation to share your day with her!
            </p>
            <button
              onClick={onClose}
              className="btn-primary-glow"
              style={{ padding: '0.65rem 1.4rem' }}
            >
              Got It
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
