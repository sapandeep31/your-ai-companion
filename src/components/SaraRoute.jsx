import React, { useEffect, useRef, useState } from 'react';
import { AvatarScene } from './AvatarScene';
import { StreamLipSyncController } from '../avatar/StreamLipSyncController';
import '../styles/app.css';

export function SaraRoute() {
  const [activeExpression, setActiveExpression] = useState(null);
  const [activeAnimation, setActiveAnimation] = useState('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isVideoActive, setIsVideoActive] = useState(true);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const lipSyncRef = useRef(new StreamLipSyncController());
  const vrmContextRef = useRef(null);
  
  const mediaStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const micContextRef = useRef(null);
  const videoElementRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));

  const [hasStarted, setHasStarted] = useState(false);

  const startSession = async () => {
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
        const ws = new WebSocket('ws://localhost:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to Gemini Live Backend');
          setIsConnected(true);
          startMediaCapture();
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'audio') {
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
            
            lipSyncRef.current.connectStream(audioContextRef.current, source);

            const currentTime = audioContextRef.current.currentTime;
            const playTime = Math.max(currentTime, nextPlayTimeRef.current);
            source.start(playTime);
            nextPlayTimeRef.current = playTime + audioBuffer.duration;
          }
          else if (msg.type === 'interrupted') {
            nextPlayTimeRef.current = audioContextRef.current.currentTime;
            lipSyncRef.current.stopPlayback();
          }
          else if (msg.type === 'input_transcript') {
            // User began talking, clear assistant transcript
            setTranscript('');
          }
          else if (msg.type === 'output_transcript') {
            // Accumulate sentence chunks into full text
            setTranscript((prev) => prev + msg.text);
          }
          else if (msg.type === 'interrupted') {
            nextPlayTimeRef.current = audioContextRef.current.currentTime;
            lipSyncRef.current.stopPlayback();
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

      // Attach video to hidden capture element
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
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
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
      }, 1000); // 1 FPS frame rate for Gemini Live API

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
    console.log("Sara VRM Loaded", ctx);
    vrmContextRef.current = ctx;
  };

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <section className="viewport-section" style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}>
        <AvatarScene
          activeExpression={activeExpression}
          activeAnimation={activeAnimation}
          lipSyncController={lipSyncRef.current}
          onVrmLoaded={handleVrmLoaded}
          backgroundImage="/homebackground.png"
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
                Ready to talk with Sara?
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
                🎙️ Start Session
              </button>
            </div>
          ) : !isConnected ? (
            <div style={{ color: '#94a3b8' }}>Connecting to Sara...</div>
          ) : (
            <div style={{
              fontSize: '1.15rem',
              fontWeight: 500,
              lineHeight: 1.5,
              color: '#f8fafc',
              minHeight: '1.5em'
            }}>
              {transcript || "Listening..."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
