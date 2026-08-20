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
          background: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '490px',
          padding: '2rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.15), 0 0 40px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          color: '#000000',
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
            background: 'rgba(0, 0, 0, 0.05)',
            border: 'none',
            color: '#64748b',
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
          onMouseEnter={(e) => { e.currentTarget.style.color = '#000'; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'; }}
        >
          &times;
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🔑</span>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>
            Gemini API Key
          </h2>
        </div>

        <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
          Add your Google Gemini API key. Stored locally in your browser and used for real-time video vision, speech generation, and memory analysis.
        </p>

        <div style={{
          background: hasCustomKey ? 'rgba(21, 128, 61, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          border: `1px solid ${hasCustomKey ? 'rgba(21, 128, 61, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
          padding: '10px 14px',
          borderRadius: '12px',
          fontSize: '0.85rem',
          color: hasCustomKey ? '#15803d' : '#333333',
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
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#333333', marginBottom: '0.45rem' }}>
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
                background: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '10px',
                color: '#000000',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'monospace'
              }}
              onFocus={(e) => e.target.style.borderColor = '#000000'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(0, 0, 0, 0.1)'}
            />
          </div>

          <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            <span>Don't have a key? Get one for free from </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0284c7', textDecoration: 'underline' }}
            >
              Google AI Studio
            </a>.
          </div>

          <div style={{
            background: 'rgba(217, 119, 6, 0.05)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '1.5rem',
            fontSize: '0.84rem',
            color: '#b45309',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <span>💎</span>
              <span>Need High-Limit / Dedicated Premium Quota?</span>
            </div>
            <div style={{ color: '#92400e' }}>
              If your free quota is exhausted, you can buy dedicated high-speed access. Contact us at{' '}
              <a
                href="mailto:sapandeep318@gmail.com?subject=Premium%20Tier%20Access%20Inquiry"
                style={{ color: '#d97706', fontWeight: 600, textDecoration: 'underline' }}
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
                  border: '1px solid rgba(220, 38, 38, 0.35)',
                  color: '#dc2626',
                  padding: '0.65rem 1.1rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Clear / Use Server Key
              </button>
            )}
            <button
              type="submit"
              style={{
                background: '#000000',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1.4rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#333333'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#000000'}
            >
              {isSaved ? 'Saved! ✨' : 'Save Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
