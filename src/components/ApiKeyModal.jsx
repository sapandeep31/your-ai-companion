import React, { useState, useEffect } from 'react';

export function ApiKeyModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('gemini_api_key') || '';
      setApiKey(stored);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (cleanKey) {
      localStorage.setItem('gemini_api_key', cleanKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const hasCustomKey = Boolean(localStorage.getItem('gemini_api_key'));

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
          maxWidth: '490px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🔑</span>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>
            Gemini API Key
          </h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
          Add your Google Gemini API key. Stored locally in your browser and used for real-time video vision, speech generation, and memory analysis.
        </p>

        <div style={{
          background: hasCustomKey ? 'rgba(34, 197, 94, 0.12)' : 'rgba(99, 102, 241, 0.12)',
          border: `1px solid ${hasCustomKey ? 'rgba(34, 197, 94, 0.35)' : 'rgba(99, 102, 241, 0.3)'}`,
          padding: '10px 14px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          color: hasCustomKey ? '#86efac' : '#c7d2fe',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem'
        }}>
          <span>{hasCustomKey ? '🟢' : 'ℹ️'}</span>
          <span style={{ fontWeight: 500 }}>
            {hasCustomKey ? 'Active: Using your custom Gemini API key' : 'Active: Using server default Gemini API key'}
          </span>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.45rem' }}>
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'monospace'
              }}
              onFocus={(e) => e.target.style.borderColor = '#818cf8'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.18)'}
            />
          </div>

          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            <span>Don't have a key? Get one for free from </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38bdf8', textDecoration: 'underline' }}
            >
              Google AI Studio
            </a>.
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '1.5rem',
            fontSize: '0.84rem',
            color: '#fef08a',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <span>💎</span>
              <span>Need High-Limit / Dedicated Premium Quota?</span>
            </div>
            <div>
              If your free quota is exhausted, you can buy dedicated high-speed access. Contact us at{' '}
              <a
                href="mailto:sapandeep318@gmail.com?subject=Premium%20Tier%20Access%20Inquiry"
                style={{ color: '#fed7aa', fontWeight: 600, textDecoration: 'underline' }}
              >
                sapandeep318@gmail.com
              </a>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {hasCustomKey && (
              <button
                type="button"
                onClick={handleClear}
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
                Clear / Use Server Key
              </button>
            )}
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1.4rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1.0)'}
            >
              {isSaved ? 'Saved! ✨' : 'Save Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
