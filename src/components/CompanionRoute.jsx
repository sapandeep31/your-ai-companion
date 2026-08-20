import React, { useEffect, useRef, useState } from 'react';
import { AvatarScene } from './AvatarScene';
import { StreamLipSyncController } from '../avatar/StreamLipSyncController';
import { ApiKeyModal } from './ApiKeyModal';
import { MemoryModal } from './MemoryModal';
import { API_BASE_URL as API_BASE, WS_BASE_URL } from '../config';
import '../styles/app.css';

export function CompanionRoute({ slug = 'sara' }) {
  const [persona, setPersona] = useState(null);
  const [activeExpression, setActiveExpression] = useState(null);
  const [activeAnimation, setActiveAnimation] = useState('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [quotaError, setQuotaError] = useState(null);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const lipSyncRef = useRef(new StreamLipSyncController());
  const vrmContextRef = useRef(null);
  
  const mediaStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const micContextRef = useRef(null);
  const videoElementRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));

  const [hasStarted, setHasStarted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const token = localStorage.getItem('token') || '';

  const stopAndClearAudioPlayback = () => {
    if (activeSourcesRef.current.length > 0) {
      activeSourcesRef.current.forEach(source => {
        try {
          source.stop(0);
          source.disconnect();
        } catch (e) {}
      });
      activeSourcesRef.current = [];
    }

    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }

    if (lipSyncRef.current) {
      lipSyncRef.current.reset();
    }
    setIsAiSpeaking(false);
  };

  useEffect(() => {
    // If not authenticated, prompt user
    if (!token) {
      setErrorMsg("Authentication required. Please log in from the Hub.");
      return;
    }

    // Fetch persona details
    const headers = { Authorization: `Bearer ${token}` };
    
    fetch(`${API_BASE}/api/personas/${slug}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Could not load persona");
        return res.json();
      })
      .then(data => {
        if (data.name) setPersona(data);
      })
      .catch(err => console.error("Failed to load persona details:", err));
  }, [slug, token]);

  const handleClearMemory = async () => {
    if (!token || !persona) return;
    if (!window.confirm(`Clear all memories for ${companionName}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/personas/${slug}/clear-memory`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPersona(prev => ({ ...prev, context_memory: {} }));
      }
    } catch (err) {
      console.error("Failed to clear memory:", err);
    }
  };

  const handleOpenMemoryModal = async () => {
    setShowMemoryModal(true);
    if (persona?.slug && token) {
      try {
        const res = await fetch(`${API_BASE}/api/personas/${persona.slug}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const fresh = await res.json();
          setPersona(prev => ({ ...prev, ...fresh }));
        }
      } catch (e) {
        console.error("Failed to refresh memory:", e);
      }
    }
  };

  const startSession = async () => {
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      setHasStarted(true);
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const customApiKey = (localStorage.getItem('gemini_api_key') || '').trim();
        const keyParam = customApiKey ? `&gemini_api_key=${encodeURIComponent(customApiKey)}` : '';
        const wsUrl = `${WS_BASE_URL}/ws/${slug}?token=${token}${keyParam}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log(`Connected to Gemini Live Backend for persona: ${slug}`);
          setIsConnected(true);
          startMediaCapture();
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status' && msg.persona) {
            setPersona(prev => ({ ...prev, ...msg.persona }));
          }
          else if (msg.type === 'memory_updated') {
            console.log("Realtime memory update received:", msg.context_memory);
            setPersona(prev => ({ ...prev, context_memory: msg.context_memory }));
          }
          else if (msg.type === 'audio') {
            setIsAiSpeaking(true);
            const audioData = atob(msg.data);
            const buffer = new ArrayBuffer(audioData.length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < audioData.length; i++) {
              view[i] = audioData.charCodeAt(i);
            }
            
            const int16View = new Int16Array(buffer);
            const float32Data = new Float32Array(int16View.length);
            for (let i = 0; i < int16View.length; i++) {
              float32Data[i] = int16View[i] / 32768.0;
            }

            const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
            audioBuffer.getChannelData(0).set(float32Data);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            
            // Track audio source node for instant cancellation
            activeSourcesRef.current.push(source);
            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
              if (activeSourcesRef.current.length === 0) {
                setIsAiSpeaking(false);
              }
            };

            lipSyncRef.current.connectStream(audioContextRef.current, source);

            const currentTime = audioContextRef.current.currentTime;
            const playTime = Math.max(currentTime, nextPlayTimeRef.current);
            source.start(playTime);
            nextPlayTimeRef.current = playTime + audioBuffer.duration;
          }
          else if (msg.type === 'api_key_exhausted') {
            console.warn("API Key quota exhausted event received:", msg);
            stopAndClearAudioPlayback();
            setQuotaError({
              title: msg.title || 'API Key Limit Exceeded',
              message: msg.message || 'The Gemini API key quota has been exhausted. Please add your own key or contact sapandeep318@gmail.com for premium tier access.',
              contact_email: msg.contact_email || 'sapandeep318@gmail.com'
            });
          }
          else if (msg.type === 'error') {
            const errText = (msg.message || '').toLowerCase();
            if (
              errText.includes('quota') ||
              errText.includes('exhaust') ||
              errText.includes('429') ||
              errText.includes('rate limit') ||
              errText.includes('api_key') ||
              errText.includes('invalid') ||
              errText.includes('unregistered')
            ) {
              stopAndClearAudioPlayback();
              setQuotaError({
                title: 'Gemini API Quota Exhausted',
                message: msg.message || 'The Gemini API key has exceeded its rate limit or is invalid.',
                contact_email: 'sapandeep318@gmail.com'
              });
            } else {
              setErrorMsg(msg.message);
            }
          }
          else if (msg.type === 'interrupted') {
            console.log("Interruption signal received from backend. Stopping audio immediately.");
            stopAndClearAudioPlayback();
          }
          else if (msg.type === 'input_transcript') {
            stopAndClearAudioPlayback();
            setTranscript('');
          }
          else if (msg.type === 'output_transcript') {
            setTranscript((prev) => prev + msg.text);
          }
          else if (msg.type === 'tool_call') {
            console.log("Tool call from Gemini:", msg);
            if (msg.function === 'set_expression' && msg.args.expression) {
              setActiveExpression(msg.args.expression);
              if (['blink', 'blinkleft', 'blinkright'].includes(msg.args.expression.toLowerCase())) {
                setTimeout(() => setActiveExpression(null), 350);
              }
            }
            else if (msg.function === 'play_animation' && msg.args.animation) {
              setActiveAnimation(msg.args.animation);
              setTimeout(() => setActiveAnimation('idle'), 3500);
            }
          }
        };

        ws.onerror = (err) => {
          console.error('WebSocket Error:', err);
          setErrorMsg("Failed to connect to backend.");
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed.');
          setIsConnected(false);
          stopMediaCapture();
        };
      }
    } catch (err) {
      console.error("Start session error:", err);
      setErrorMsg("Failed to initialize session: " + err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.onopen = () => wsRef.current.close();
        }
      }
      stopMediaCapture();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      lipSyncRef.current.stopPlayback();
    };
  }, []);

  const startMediaCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
      });
      mediaStreamRef.current = stream;

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        videoElementRef.current.play().catch(e => console.log("Video play warning:", e));
      }

      // Audio Capture Pipeline (16kHz PCM)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      micContextRef.current = new AudioCtx({ sampleRate: 16000 });

      const audioTrack = stream.getAudioTracks()[0];
      const audioStream = new MediaStream([audioTrack]);
      const source = micContextRef.current.createMediaStreamSource(audioStream);
      const processor = micContextRef.current.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        let sumSq = 0;
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = inputData[i];
          sumSq += sample * sample;
          const s = Math.max(-1, Math.min(1, sample));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Instant local barge-in: If user speaks into mic while AI is talking, cut AI audio immediately!
        const rms = Math.sqrt(sumSq / inputData.length);
        if (rms > 0.038 && activeSourcesRef.current.length > 0) {
          stopAndClearAudioPlayback();
        }

        const buffer = int16Data.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }));
      };

      source.connect(processor);
      processor.connect(micContextRef.current.destination);

      // Video Capture Pipeline (1 Frame Per Second JPEG)
      const canvas = canvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      videoIntervalRef.current = setInterval(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (!videoElementRef.current || !videoElementRef.current.videoWidth) return;

        ctx.drawImage(videoElementRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64Data = dataUrl.split(',')[1];

        if (base64Data) {
          wsRef.current.send(JSON.stringify({
            type: 'video',
            data: base64Data
          }));
        }
      }, 1000);

    } catch (err) {
      console.error("Media error:", err);
      setErrorMsg("Camera/Microphone permission denied: " + err.message);
    }
  };

  const stopMediaCapture = () => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (micProcessorRef.current && micContextRef.current) {
      micProcessorRef.current.disconnect();
    }
    if (micContextRef.current) {
      micContextRef.current.close();
    }
  };

  const handleVrmLoaded = (ctx) => {
    console.log(`VRM Loaded for ${persona?.name || slug}`, ctx);
    vrmContextRef.current = ctx;
  };

  const companionName = persona?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
  const shirtColor = persona?.shirt_color || '#e84393';
  const memoryCount = Array.isArray(persona?.context_memory) ? persona.context_memory.length : 0;

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <section className="viewport-section" style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}>
        {/* Top Floating Control Bar */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 20
        }}>
          <a
            href="/"
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
            }}
          >
            ← Hub
          </a>

          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'white',
            padding: '8px 18px',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <span>{companionName}</span>
            {persona?.preset_type && (
              <span style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '10px',
                color: '#38bdf8'
              }}>
                {persona.preset_type}
              </span>
            )}
          </div>

          <button
            onClick={handleOpenMemoryModal}
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(129, 140, 248, 0.35)',
              color: '#c7d2fe',
              padding: '8px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease'
            }}
            title="Click to view what she remembers"
          >
            <span>🧠</span>
            <span>Memory</span>
          </button>

          <button
            onClick={() => setShowApiKeyModal(true)}
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${localStorage.getItem('gemini_api_key') ? '#22c55e' : 'rgba(255, 255, 255, 0.12)'}`,
              color: localStorage.getItem('gemini_api_key') ? '#86efac' : '#94a3b8',
              padding: '8px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease'
            }}
            title="Configure Custom Gemini API Key"
          >
            <span>🔑</span>
            <span>{localStorage.getItem('gemini_api_key') ? 'Custom Key' : 'API Key'}</span>
          </button>

          <button
            onClick={handleClearMemory}
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              padding: '8px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease'
            }}
            title="Clear memory for this companion"
          >
            🧹 Clear Memory
          </button>
        </div>

        <AvatarScene
          activeExpression={activeExpression}
          activeAnimation={activeAnimation}
          lipSyncController={lipSyncRef.current}
          onVrmLoaded={handleVrmLoaded}
          backgroundImage="/homebackground.png"
          shirtColor={shirtColor}
        />

        {/* Hidden video element for background frame capture */}
        <video
          ref={videoElementRef}
          playsInline
          muted
          style={{ display: 'none' }}
        />
        
        {/* Overlay UI for connection status and full sentence transcript */}
        <div style={{
          position: 'absolute',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '85%',
          maxWidth: '680px',
          textAlign: 'center',
          color: 'white',
          background: 'rgba(15, 23, 42, 0.75)',
          padding: '16px 28px',
          borderRadius: '16px',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontFamily: 'Inter, sans-serif'
        }}>
          {errorMsg && (
            <div style={{ color: '#ff4d4f', marginBottom: '8px' }}>{errorMsg}</div>
          )}

          {!hasStarted ? (
            <div>
              <p style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#cbd5e1' }}>
                Ready to talk with {companionName}?
              </p>
              <button
                onClick={startSession}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                  transition: 'transform 0.15s ease'
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                🎙️ Start Session with {companionName}
              </button>
            </div>
          ) : !isConnected ? (
            <div style={{ color: '#94a3b8' }}>Connecting to {companionName}...</div>
          ) : (
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 500,
              lineHeight: 1.5,
              color: '#f8fafc',
              minHeight: '1.5em'
            }}>
              {transcript || (isAiSpeaking ? `🗣️ ${companionName} is speaking...` : `🎧 Listening to you...`)}
            </div>
          )}
        </div>
      </section>

      {/* Custom Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      {/* Memory Viewer Modal */}
      <MemoryModal
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        persona={persona}
        onClearMemory={handleClearMemory}
      />

      {/* API Key Quota Exhausted Modal */}
      {quotaError && (
        <div
          onClick={() => setQuotaError(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000000,
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '24px',
              maxWidth: '490px',
              width: '100%',
              padding: '2.2rem 2rem',
              boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 35px rgba(234, 179, 8, 0.15)',
              color: '#f8fafc',
              textAlign: 'center',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <div style={{ fontSize: '2.8rem', marginBottom: '0.6rem' }}>⚠️</div>
            <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.6rem', color: '#fef08a', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
              {quotaError.title}
            </h3>
            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.55', margin: '0 0 1.5rem' }}>
              {quotaError.message}
            </p>

            <div style={{
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '0.88rem',
              color: '#fef08a',
              marginBottom: '1.75rem',
              textAlign: 'left',
              lineHeight: '1.5'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                💎 Want Dedicated High-Speed Access?
              </div>
              <div>
                To purchase premium tier access with no rate limits, email{' '}
                <a
                  href="mailto:sapandeep318@gmail.com?subject=Buy%20Premium%20Tier%20Access"
                  style={{ color: '#fed7aa', fontWeight: 700, textDecoration: 'underline' }}
                >
                  sapandeep318@gmail.com
                </a>.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => { setQuotaError(null); setShowApiKeyModal(true); }}
                className="btn-primary-glow"
                style={{ padding: '0.7rem 1.4rem', fontSize: '0.95rem' }}
              >
                🔑 Add Free / Custom Key
              </button>
              <button
                onClick={() => setQuotaError(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#94a3b8',
                  padding: '0.7rem 1.1rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
