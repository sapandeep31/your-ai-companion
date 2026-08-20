/**
 * Gemini Live API Web Studio - Client JavaScript
 * Handles Web Audio API (16kHz PCM input, 24kHz PCM output), Canvas Video Capture, and WebSocket.
 */

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const webcamVideo = document.getElementById('webcamVideo');
const videoCanvas = document.getElementById('videoCanvas');
const audioVisualizer = document.getElementById('audioVisualizer');
const camStatus = document.getElementById('camStatus');
const micStatus = document.getElementById('micStatus');
const btnConnect = document.getElementById('btnConnect');
const btnConnectText = document.getElementById('btnConnectText');
const btnToggleMic = document.getElementById('btnToggleMic');
const btnToggleCam = document.getElementById('btnToggleCam');
const chatMessages = document.getElementById('chatMessages');
const textForm = document.getElementById('textForm');
const textInput = document.getElementById('textInput');
const btnSendText = document.getElementById('btnSendText');

// Application State
let ws = null;
let mediaStream = null;
let audioContextInput = null;
let audioContextOutput = null;
let scriptProcessor = null;
let micSourceNode = null;
let videoInterval = null;
let visualizerAnimation = null;
let isMicActive = true;
let isCamActive = true;
let isConnected = false;

// Audio Output Playback State (24kHz PCM)
let outputAudioQueue = [];
let isPlayingAudio = false;
let currentAudioSource = null;
let nextStartTime = 0;

// Current Active Transcript Bubbles
let currentInputBubble = null;
let currentOutputBubble = null;

// Initialize Audio Contexts on User Gesture
function getOutputAudioContext() {
    if (!audioContextOutput) {
        audioContextOutput = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextOutput.state === 'suspended') {
        audioContextOutput.resume();
    }
    return audioContextOutput;
}

// ----------------------------------------------------
// UI Update Helpers
// ----------------------------------------------------
function updateStatus(state, text) {
    statusBadge.className = 'session-badge ' + state;
    statusText.textContent = text;
}

function appendMessage(sender, text, isPartial = false) {
    const isUser = sender === 'User';
    let bubble = isUser ? currentInputBubble : currentOutputBubble;

    if (!bubble || !isPartial) {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-bubble ${isUser ? 'msg-user' : 'msg-gemini'}`;

        const speaker = document.createElement('div');
        speaker.className = 'msg-speaker';
        speaker.textContent = isUser ? 'You' : 'Gemini';

        const content = document.createElement('div');
        content.className = 'msg-text';
        content.textContent = text;

        wrapper.appendChild(speaker);
        wrapper.appendChild(content);
        chatMessages.appendChild(wrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (isUser) currentInputBubble = wrapper;
        else currentOutputBubble = wrapper;
    } else {
        const textEl = bubble.querySelector('.msg-text');
        if (textEl) {
            textEl.textContent += text;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

// ----------------------------------------------------
// WebSocket Connection
// ----------------------------------------------------
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    updateStatus('', 'Connecting...');
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket Connected.');
        updateStatus('connected', 'Live Session Active');
        isConnected = true;
        setControlsState(true);
        startMediaStreams();
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleServerMessage(msg);
        } catch (e) {
            console.error('Error parsing WebSocket message:', e);
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        updateStatus('', 'Error');
    };

    ws.onclose = () => {
        console.log('WebSocket Closed.');
        updateStatus('', 'Disconnected');
        isConnected = false;
        stopMediaStreams();
        setControlsState(false);
    };
}

function handleServerMessage(msg) {
    switch (msg.type) {
        case 'status':
            console.log('Session status:', msg);
            break;
        case 'audio':
            // Receive 24kHz PCM audio chunk (Base64)
            queueOutputAudio(msg.data);
            break;
        case 'input_transcript':
            // User speech transcription update
            appendMessage('User', msg.text, false);
            break;
        case 'output_transcript':
            // Gemini speech transcription update
            updateStatus('speaking', 'Gemini Speaking');
            appendMessage('Gemini', msg.text, true);
            break;
        case 'interrupted':
            console.log('Gemini interrupted by user!');
            stopAudioOutputQueue();
            currentOutputBubble = null;
            updateStatus('connected', 'Live Session Active');
            break;
        case 'error':
            alert(`Server Error: ${msg.message}`);
            console.error('Server error:', msg.message);
            break;
    }
}

// ----------------------------------------------------
// Media Capture (Microphone & Camera)
// ----------------------------------------------------
async function startMediaStreams() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            },
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { max: 10 }
            }
        });

        // Set Video Stream
        webcamVideo.srcObject = mediaStream;
        camStatus.textContent = 'Camera On';
        camStatus.classList.add('active');
        micStatus.textContent = 'Mic Active';
        micStatus.classList.add('active');

        // Setup Audio Input Capture (16kHz PCM Mono)
        setupAudioInput(mediaStream);

        // Setup Video Frame Streamer (~1 FPS)
        startVideoFrameCapture();

        // Start Audio Visualizer
        startVisualizer(mediaStream);

    } catch (err) {
        console.error('Error accessing camera/mic:', err);
        alert('Could not access camera or microphone. Please check browser permissions!');
    }
}

function stopMediaStreams() {
    if (videoInterval) {
        clearInterval(videoInterval);
        videoInterval = null;
    }

    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }

    if (audioContextInput) {
        audioContextInput.close();
        audioContextInput = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (visualizerAnimation) {
        cancelAnimationFrame(visualizerAnimation);
    }

    webcamVideo.srcObject = null;
    camStatus.textContent = 'Camera Off';
    camStatus.classList.remove('active');
    micStatus.textContent = 'Mic Off';
    micStatus.classList.remove('active');
}

// Convert Audio Input to PCM 16kHz 16-bit mono bytes
function setupAudioInput(stream) {
    audioContextInput = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    micSourceNode = audioContextInput.createMediaStreamSource(stream);

    // BufferSize 2048 at 16kHz = ~128ms chunks
    scriptProcessor = audioContextInput.createScriptProcessor(2048, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
        if (!isMicActive || !ws || ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16 PCM array
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert Int16Array to Base64 byte string
        const buffer = pcm16.buffer;
        const binary = String.fromCharCode.apply(null, new Uint8Array(buffer));
        const base64Data = btoa(binary);

        ws.send(JSON.stringify({
            type: 'audio',
            data: base64Data
        }));
    };

    micSourceNode.connect(scriptProcessor);
    scriptProcessor.connect(audioContextInput.destination);
}

// Send Canvas JPEG frames to server over WS (~1 FPS)
function startVideoFrameCapture() {
    const ctx = videoCanvas.getContext('2d');
    videoCanvas.width = 320;
    videoCanvas.height = 240;

    videoInterval = setInterval(() => {
        if (!isCamActive || !ws || ws.readyState !== WebSocket.OPEN || webcamVideo.readyState !== 4) return;

        ctx.drawImage(webcamVideo, 0, 0, videoCanvas.width, videoCanvas.height);
        const dataUrl = videoCanvas.toDataURL('image/jpeg', 0.5);
        const base64Data = dataUrl.split(',')[1];

        ws.send(JSON.stringify({
            type: 'video',
            data: base64Data
        }));
    }, 1000); // 1 frame per second is recommended for optimal video performance
}

// ----------------------------------------------------
// PCM Output Audio Player (24kHz PCM Mono)
// ----------------------------------------------------
function queueOutputAudio(base64PCM) {
    const ctx = getOutputAudioContext();

    // Decode Base64 string to Uint8Array bytes
    const binary = atob(base64PCM);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // Convert 16-bit PCM Little Endian to Float32 [-1.0, 1.0]
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create AudioBuffer at 24000 Hz
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    outputAudioQueue.push(audioBuffer);

    if (!isPlayingAudio) {
        playNextAudioChunk();
    }
}

function playNextAudioChunk() {
    if (outputAudioQueue.length === 0) {
        isPlayingAudio = false;
        if (isConnected) updateStatus('connected', 'Live Session Active');
        return;
    }

    isPlayingAudio = true;
    const ctx = getOutputAudioContext();
    const buffer = outputAudioQueue.shift();

    currentAudioSource = ctx.createBufferSource();
    currentAudioSource.buffer = buffer;
    currentAudioSource.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    if (nextStartTime < currentTime) {
        nextStartTime = currentTime;
    }

    currentAudioSource.start(nextStartTime);
    nextStartTime += buffer.duration;

    currentAudioSource.onended = () => {
        playNextAudioChunk();
    };
}

function stopAudioOutputQueue() {
    outputAudioQueue = [];
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {}
        currentAudioSource = null;
    }
    isPlayingAudio = false;
    nextStartTime = 0;
}

// ----------------------------------------------------
// Audio Waveform Visualizer
// ----------------------------------------------------
function startVisualizer(stream) {
    const canvasCtx = audioVisualizer.getContext('2d');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;

    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        visualizerAnimation = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        canvasCtx.fillRect(0, 0, audioVisualizer.width, audioVisualizer.height);

        const barWidth = (audioVisualizer.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * audioVisualizer.height;

            const gradient = canvasCtx.createLinearGradient(0, audioVisualizer.height, 0, 0);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#8b5cf6');

            canvasCtx.fillStyle = gradient;
            canvasCtx.fillRect(x, audioVisualizer.height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    draw();
}

// ----------------------------------------------------
// Event Listeners & Controls
// ----------------------------------------------------
btnConnect.addEventListener('click', () => {
    if (isConnected) {
        if (ws) ws.close();
    } else {
        connectWebSocket();
    }
});

btnToggleMic.addEventListener('click', () => {
    isMicActive = !isMicActive;
    btnToggleMic.classList.toggle('active', isMicActive);
    micStatus.textContent = isMicActive ? 'Mic Active' : 'Mic Muted';
    micStatus.classList.toggle('active', isMicActive);
});

btnToggleCam.addEventListener('click', () => {
    isCamActive = !isCamActive;
    btnToggleCam.classList.toggle('active', isCamActive);
    camStatus.textContent = isCamActive ? 'Camera On' : 'Camera Off';
    camStatus.classList.toggle('active', isCamActive);
});

textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (text && ws && ws.readyState === WebSocket.OPEN) {
        appendMessage('User', text, false);
        ws.send(JSON.stringify({
            type: 'text',
            text: text
        }));
        textInput.value = '';
    }
});

function setControlsState(active) {
    btnConnect.classList.toggle('btn-danger', active);
    btnConnectText.textContent = active ? 'End Session' : 'Start Session';
    btnToggleMic.disabled = !active;
    btnToggleCam.disabled = !active;
    textInput.disabled = !active;
    btnSendText.disabled = !active;

    if (active) {
        btnToggleMic.classList.add('active');
        btnToggleCam.classList.add('active');
    }
}
