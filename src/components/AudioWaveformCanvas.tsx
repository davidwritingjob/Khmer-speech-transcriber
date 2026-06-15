import { useEffect, useRef } from "react";

interface AudioWaveformCanvasProps {
  isRecording: boolean;
  audioStream: MediaStream | null;
  height?: number;
}

export default function AudioWaveformCanvas({
  isRecording,
  audioStream,
  height = 96,
}: AudioWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas based on client rect
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = height;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Audio context setup for live mic visualizer
    if (isRecording && audioStream) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const srcNode = audioCtx.createMediaStreamSource(audioStream);
        const analyser = audioCtx.createAnalyser();

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        srcNode.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
      } catch (err) {
        console.error("Failed to setup real-time audio visualization:", err);
      }
    } else {
      // Cleanup Web Audio API when not recording
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      dataArrayRef.current = null;
    }

    let phase = 0;

    // Drawing loop
    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const h = canvas.height;

      // Draw background glow grid
      ctx.strokeStyle = "rgba(37, 99, 235, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 16;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw baseline
      ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(width, h / 2);
      ctx.stroke();

      if (isRecording && analyserRef.current && dataArrayRef.current) {
        // --- REAL MICROPHONE WAVEFORM ---
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / dataArray.length) * 1.5;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * h * 0.85;

          // Standard gradient for bars (Professional Blue)
          const gradient = ctx.createLinearGradient(0, h / 2 - barHeight / 2, 0, h / 2 + barHeight / 2);
          gradient.addColorStop(0, "#2563EB"); // Royal Blue 600
          gradient.addColorStop(0.5, "#60A5FA"); // Blue 400
          gradient.addColorStop(1, "#1D4ED8"); // Darker blue

          ctx.fillStyle = gradient;
          ctx.fillRect(x, h / 2 - barHeight / 2, barWidth - 1, barHeight || 2);

          x += barWidth;
        }
      } else {
        // --- SIMULATED AMBIENT HARMONICS (Idle/Playing state) ---
        phase += 0.05;
        ctx.lineWidth = 2;

        const waveCount = 3;
        const colors = [
          "rgba(37, 99, 235, 0.8)",  // Royal Blue Principal
          "rgba(96, 165, 250, 0.4)",  // Light blue secondary
          "rgba(29, 78, 216, 0.2)",   // Darker blue wave
        ];

        for (let w = 0; w < waveCount; w++) {
          ctx.strokeStyle = colors[w];
          ctx.beginPath();

          const amplitudeModifier = w === 0 ? 0.35 : w === 1 ? 0.2 : 0.1;
          const frequencyModifier = w === 0 ? 1 : w === 1 ? 1.8 : 0.6;
          const speedModifier = w === 0 ? 1 : w === 1 ? -1.5 : 0.5;

          for (let x = 0; x < width; x++) {
            // Dropoff near the edges (fade-out bounds)
            const edgeScale = Math.sin((x / width) * Math.PI);
            const y =
              h / 2 +
              Math.sin(x * 0.025 * frequencyModifier + phase * speedModifier) *
                h *
                amplitudeModifier *
                edgeScale;

            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, audioStream, height]);

  return (
    <div className="relative w-full overflow-hidden bg-slate-950/40 rounded-xl border border-slate-800 p-2">
      <div className="absolute top-2 right-3 flex items-center gap-1.5 z-10 font-mono text-[9px] text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isRecording ? "bg-red-500 animate-pulse" : "bg-blue-500"
          }`}
        ></span>
        {isRecording ? "MIC MONITOR: ACTIVE" : "SYSTEM WAVEFORM: PREVIEW"}
      </div>
      <canvas ref={canvasRef} className="block w-full rounded-lg" />
    </div>
  );
}
