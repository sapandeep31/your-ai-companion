import React, { useState, useEffect } from 'react';
import { ApiKeyModal } from './ApiKeyModal';
import { MemoryModal } from './MemoryModal';
import { API_BASE_URL as API_BASE } from '../config';
import '../styles/dashboard.css';

const PRESET_INFO = {
  wholesome: { name: 'Sara', icon: '💖', color: '#e84393', desc: 'Warm, sweet, caring & affectionate girlfriend.' },
  tsundere: { name: 'Asuka', icon: '💢', color: '#ff4757', desc: 'Feisty & haughty, gets flustered, secretly adores you.' },
  yandere: { name: 'Yuno', icon: '🔪', color: '#8854d0', desc: 'Intensely devoted, obsessive & clingy.' },
  playful: { name: 'Maya', icon: '✨', color: '#00d2d3', desc: 'Witty, energetic, constantly teasing & joking.' },
  custom: { name: 'Custom', icon: '🎨', color: '#6366f1', desc: 'Build your own custom personality & prompt.' }
};

export function Dashboard() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedMemoryPersona, setSelectedMemoryPersona] = useState(null);

  // Auth Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signup'); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({ username: '', password: '', about: '' });
  const [authError, setAuthError] = useState('');

  // Create Persona Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: 'Asuka',
    preset_type: 'tsundere',
    voice_name: 'Aoede',
    shirt_color: '#ff4757',
    system_prompt: ''
  });

  // Edit Bio
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');

  useEffect(() => {
    fetchInitialData();

    const handleFocus = () => {
      fetchInitialData();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [token]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch user if token exists
      if (token) {
        const userRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          setBioInput(userData.about || '');
        } else {
          // Token expired
          localStorage.removeItem('token');
          setToken('');
          setUser(null);
        }
      }

      // 2. Fetch Personas
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/personas`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMemoryModal = async (persona) => {
    setSelectedMemoryPersona(persona);
    if (persona && persona.slug) {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/api/personas/${persona.slug}`, { headers });
        if (res.ok) {
          const freshData = await res.json();
          setSelectedMemoryPersona(freshData);
          setPersonas(prev => prev.map(p => p.slug === persona.slug ? { ...p, context_memory: freshData.context_memory } : p));
        }
      } catch (e) {
        console.error("Failed to fetch fresh memory:", e);
      }
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed.');
      }

      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      setBioInput(data.user.about || '');
      setShowAuthModal(false);
      fetchInitialData();
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    fetchInitialData();
  };

  const handleSaveBio = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ about: bioInput })
      });
      if (res.ok) {
        setUser(prev => ({ ...prev, about: bioInput }));
        setIsEditingBio(false);
      }
    } catch (err) {
      console.error("Failed to save bio:", err);
    }
  };

  const handleCreatePersona = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/personas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchInitialData();
      }
    } catch (err) {
      console.error("Failed to create persona:", err);
    }
  };

  const handleClearMemory = async (slug, name) => {
    if (!window.confirm(`Are you sure you want to clear all long-term memories for ${name}? She will start fresh with a clean slate.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/personas/${slug}/clear-memory`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setPersonas(prev => prev.map(p => p.slug === slug ? { ...p, memory_count: 0 } : p));
      }
    } catch (err) {
      console.error("Failed to clear memory:", err);
    }
  };

  const handleSelectPreset = (key) => {
    const preset = PRESET_INFO[key];
    setCreateForm(prev => ({
      ...prev,
      preset_type: key,
      name: preset.name === 'Custom' ? '' : preset.name,
      shirt_color: preset.color,
      voice_name: key === 'tsundere' || key === 'playful' ? 'Aoede' : 'Kore'
    }));
  };

  return (
    <div className="dashboard-container">
      {/* Top Navigation */}
      <header className="dash-header">
        <div className="dash-brand">
          <div className="brand-icon">✨</div>
          <span className="brand-title-dash">Sara AI Companion Hub</span>
        </div>

        <div className="dash-user-section" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            className="btn-outline-dash"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: localStorage.getItem('gemini_api_key') ? '#22c55e' : undefined }}
            onClick={() => setShowApiKeyModal(true)}
            title="Configure Custom Gemini API Key"
          >
            <span>🔑</span>
            <span>{localStorage.getItem('gemini_api_key') ? 'Custom Key Active' : 'API Key'}</span>
          </button>

          {user ? (
            <>
              <span style={{ fontSize: '0.95rem', color: '#cbd5e1' }}>
                👋 Welcome, <strong>{user.username}</strong>
              </span>
              <button className="btn-outline-dash" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline-dash" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                Log In
              </button>
              <button className="btn-primary-glow" onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* User Bio / Context Section */}
      <section className="dash-hero">
        <div className="hero-welcome">
          <h1>Meet Your Personal AI Companions</h1>
          <p>Multi-persona 3D avatars with real-time video vision, speech, and persistent long-term memory.</p>
        </div>

        {user ? (
          <div className="user-bio-card">
            <div className="bio-content" style={{ flex: 1 }}>
              <h4>🧠 About You (Injected into your companion's memory)</h4>
              {isEditingBio ? (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={bioInput}
                    onChange={(e) => setBioInput(e.target.value)}
                    placeholder="Tell your companion what you do, what you like, your daily schedule..."
                  />
                  <button className="btn-primary-glow" onClick={handleSaveBio}>Save</button>
                  <button className="btn-outline-dash" onClick={() => setIsEditingBio(false)}>Cancel</button>
                </div>
              ) : (
                <p>{user.about || "No bio added yet. Click edit to tell your girlfriend about yourself!"}</p>
              )}
            </div>
            {!isEditingBio && (
              <button className="btn-outline-dash" style={{ marginLeft: '1rem' }} onClick={() => setIsEditingBio(true)}>
                ✏️ Edit Bio
              </button>
            )}
          </div>
        ) : (
          <div className="user-bio-card" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)', marginTop: '2rem' }}>
            <div className="bio-content">
              <h4 style={{ color: '#a5b4fc' }}>🔒 Private & Secure Long-Term Memory</h4>
              <p>Please log in or create an account to access your personal AI companions, custom personalities, and private memory logs.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline-dash" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}>
                Log In
              </button>
              <button className="btn-primary-glow" onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}>
                Sign Up
              </button>
            </div>
          </div>
        )}

        {/* Premium Access Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: '16px',
          padding: '14px 20px',
          marginTop: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>💎</span>
            <div>
              <div style={{ fontWeight: 600, color: '#fef08a', fontSize: '0.92rem' }}>
                High-Speed Dedicated Quota & Premium Tier
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                Bring your own free Gemini API key in the navbar or contact{' '}
                <a
                  href="mailto:sapandeep318@gmail.com?subject=Premium%20Tier%20Access%20Inquiry"
                  style={{ color: '#fed7aa', fontWeight: 600, textDecoration: 'underline' }}
                >
                  sapandeep318@gmail.com
                </a>{' '}
                for dedicated premium access.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="btn-outline-dash"
            style={{ borderColor: 'rgba(234, 179, 8, 0.4)', color: '#fef08a', fontSize: '0.85rem' }}
          >
            🔑 Configure Key
          </button>
        </div>
      </section>

      {/* Personas Section */}
      <main className="dash-content">
        {user ? (
          <>
            <div className="section-header-dash">
              <h2>Your Companions ({personas.length})</h2>
              <button className="btn-primary-glow" onClick={() => setShowCreateModal(true)}>
                + Create New Companion
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading companions...</div>
            ) : personas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                No companions created yet. Click "+ Create New Companion" to get started!
              </div>
            ) : (
              <div className="personas-grid">
                {personas.map((p) => {
                  const preset = PRESET_INFO[p.preset_type] || PRESET_INFO.wholesome;
                  return (
                    <div key={p.id || p.slug} className="persona-card">
                      <div className="persona-card-top">
                        <div
                          className="avatar-preview-circle"
                          style={{ background: `radial-gradient(circle, ${p.shirt_color || '#e84393'}44 0%, #0f172a 80%)` }}
                        >
                          {preset.icon}
                        </div>
                        <span className="badge-preset">{p.preset_type}</span>
                      </div>

                      <div className="persona-info">
                        <h3>{p.name}</h3>
                        <p>{preset.desc}</p>
                      </div>

                      <div className="persona-meta">
                        <span className="meta-chip">🎙️ {p.voice_name || 'Kore'}</span>
                        <button
                          className="meta-chip"
                          onClick={() => handleOpenMemoryModal(p)}
                          style={{
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#c7d2fe',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
                          title="Click to view what she remembers"
                        >
                          🧠 Memory
                        </button>
                      </div>

                      <div className="persona-card-actions" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                        <a href={`/${p.slug}`} className="btn-talk">
                          💬 Start Live Chat
                        </a>
                        <button
                          className="btn-outline-dash"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem', color: '#94a3b8' }}
                          onClick={() => handleClearMemory(p.slug, p.name)}
                          title="Clear all stored conversation memories for this character"
                        >
                          🧹 Clear Memories
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '24px',
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
            <h3 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem' }}>Sign In to Unlock Your Companions</h3>
            <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              Create and chat with realistic 3D companions like Sara, Tsundere Asuka, Yandere Yuno, or build your own custom character with long-term memory.
            </p>
            <button className="btn-primary-glow" onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}>
              Get Started for Free
            </button>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{authMode === 'signup' ? 'Create Your Account' : 'Welcome Back'}</h2>
              <button className="btn-close-modal" onClick={() => setShowAuthModal(false)}>✕</button>
            </div>

            {authError && (
              <div style={{ color: '#ff4d4f', marginBottom: '1rem', fontSize: '0.9rem' }}>{authError}</div>
            )}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  placeholder="Enter your username"
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>

              {authMode === 'signup' && (
                <div className="form-group">
                  <label>About You (Your job, interests, habits for your GF to know):</label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    value={authForm.about}
                    onChange={(e) => setAuthForm({ ...authForm, about: e.target.value })}
                    placeholder="e.g. I work as a backend engineer, love playing video games, enjoy iced coffee, and like working out in the evening."
                  />
                </div>
              )}

              <button type="submit" className="btn-primary-glow" style={{ width: '100%', marginTop: '0.5rem' }}>
                {authMode === 'signup' ? 'Sign Up & Meet Sara' : 'Log In'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                {authMode === 'signup' ? (
                  <>Already have an account? <span style={{ color: '#6366f1', cursor: 'pointer' }} onClick={() => setAuthMode('login')}>Log In</span></>
                ) : (
                  <>Don't have an account? <span style={{ color: '#6366f1', cursor: 'pointer' }} onClick={() => setAuthMode('signup')}>Sign Up</span></>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Companion Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Companion</h2>
              <button className="btn-close-modal" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreatePersona}>
              <div className="form-group">
                <label>Choose Persona Preset:</label>
                <div className="preset-selector-grid">
                  {Object.entries(PRESET_INFO).map(([key, info]) => (
                    <div
                      key={key}
                      className={`preset-chip-btn ${createForm.preset_type === key ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(key)}
                    >
                      <span className="preset-chip-title">{info.icon} {key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      <span className="preset-chip-sub">{info.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Companion Name:</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Asuka, Maya, Yuno..."
                />
              </div>

              <div className="form-group">
                <label>Voice:</label>
                <select
                  className="form-select"
                  value={createForm.voice_name}
                  onChange={(e) => setCreateForm({ ...createForm, voice_name: e.target.value })}
                >
                  <option value="Kore">Kore (Soft & Warm Female)</option>
                  <option value="Aoede">Aoede (Energetic & Expressive Female)</option>
                  <option value="Puck">Puck (Playful / Bright)</option>
                  <option value="Fenrir">Fenrir (Deep & Confident)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Outfit / Top Color:</label>
                <input
                  type="color"
                  className="form-input"
                  style={{ height: '42px', padding: '4px', cursor: 'pointer' }}
                  value={createForm.shirt_color}
                  onChange={(e) => setCreateForm({ ...createForm, shirt_color: e.target.value })}
                />
              </div>

              {createForm.preset_type === 'custom' && (
                <div className="form-group">
                  <label>Custom System Prompt:</label>
                  <textarea
                    rows={4}
                    className="form-textarea"
                    value={createForm.system_prompt}
                    onChange={(e) => setCreateForm({ ...createForm, system_prompt: e.target.value })}
                    placeholder="Describe how she acts, her relationship with you, and her quirks..."
                  />
                </div>
              )}

              <button type="submit" className="btn-primary-glow" style={{ width: '100%', marginTop: '0.8rem' }}>
                Create Companion
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      {/* Memory Viewer Modal */}
      <MemoryModal
        isOpen={Boolean(selectedMemoryPersona)}
        onClose={() => setSelectedMemoryPersona(null)}
        persona={selectedMemoryPersona}
        onClearMemory={handleClearMemory}
      />
    </div>
  );
}
