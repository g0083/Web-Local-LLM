import React, { useEffect, useRef, useState } from 'react';
import './LiveOverlay.css'; // We'll create this CSS next

export default function LiveOverlay({ isSpeaking, isListening, onClose }) {
    const canvasRef = useRef(null);
    const [volume, setVolume] = useState(0);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);

    // Initialize Audio for Input Visualization
    useEffect(() => {
        let animationFrame;

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;

                sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

                const update = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);

                    // improved average calculation
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;

                    // Normalize to 0-1 range roughly
                    setVolume(avg / 128);

                    animationFrame = requestAnimationFrame(update);
                };
                update();
            } catch (err) {
                console.error("Error accessing microphone for visualizer:", err);
            }
        };

        if (isListening) {
            initAudio();
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (sourceRef.current) {
                // We don't stop the media stream tracks here because useWebSpeech might be using them?
                // Actually getUserMedia returns a NEW stream. We should stop it to clean up.
                sourceRef.current.mediaStream?.getTracks().forEach(track => track.stop());
                sourceRef.current.disconnect();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, [isListening]);

    // Canvas Animation
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationId;
        let phase = 0;

        const render = () => {
            // Resize if needed
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }

            // Determine current activity level
            // If speaking (output), use a simulated sine wave + noise or just high volume
            // If listening (input), use detected volume
            let currentLevel = 0;
            let color = '';

            if (isSpeaking) {
                // Simulated level for output
                currentLevel = 0.3 + Math.sin(Date.now() / 100) * 0.2 + Math.random() * 0.1;
                color = '130, 200, 255'; // Blue-ish for assistant
            } else if (isListening) {
                currentLevel = volume * 1.5; // Boost input slightly
                color = '255, 100, 150'; // Pink/Red for user (matching accent?) or White
                if (currentLevel < 0.05) currentLevel = 0.05; // Base idle movement
            } else {
                currentLevel = 0.02; // Idle
                color = '150, 150, 150';
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw "Orb" or "Wave"
            // Let's do a Gemini Live style center blob/wave

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
            const radius = 100 + currentLevel * 100; // Base 100 + volume

            // Create gradient
            const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
            gradient.addColorStop(0, `rgba(${color}, 0.8)`);
            gradient.addColorStop(0.5, `rgba(${color}, 0.3)`);
            gradient.addColorStop(1, `rgba(${color}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Additional "Wave" lines
            ctx.strokeStyle = `rgba(${color}, 0.5)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= canvas.width; i += 10) {
                const y = centerY + Math.sin((i / 200) + phase) * (currentLevel * 100);
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.stroke();

            phase += 0.05;
            animationId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [volume, isSpeaking, isListening]);

    return (
        <div className="live-overlay">
            <canvas ref={canvasRef} className="visualizer-canvas" />

            <div className="live-controls">
                {/* Close Button or Status */}
                <div className="live-status">
                    {isSpeaking ? "Assistant is speaking..." : (isListening ? "Listening..." : "Waiting...")}
                </div>
                <button onClick={onClose} className="live-close-btn">
                    End Live Mode
                </button>
            </div>
        </div>
    );
}
