import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Sparkles,
  History,
  Layers,
  AlertTriangle,
  Menu,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Volume2,
  FileAudio,
  Play
} from "lucide-react";
import { SessionItem, TranscriptionData } from "./types";
import AudioWaveformCanvas from "./components/AudioWaveformCanvas";
import UploadArea from "./components/UploadArea";
import HistorySidebar from "./components/HistorySidebar";
import ResultSection from "./components/ResultSection";

const LOCAL_STORAGE_KEY = "khmer_transcriber_sessions_v1";

interface QueueItem {
  id: string;
  file: File;
  mode: "general" | "meeting" | "music";
  promptOverride: string;
}

export default function App() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Upload/Config States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"general" | "meeting" | "music">("general");
  const [promptOverride, setPromptOverride] = useState("");

  // Batch Queue States
  const [batchQueue, setBatchQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // UI Panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Live microphone recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Loading indicator states of current jobs
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Steps tracking
  const loadingSteps = [
    "Establishing link to server APIs...",
    "Uploading audio files in background...",
    "Feeding multimodal streams into Google Gemini LLM...",
    "Aligning phonetic Khmer accents and syllable spacings...",
    "Constructing SubRip (SRT) and Karaoke (LRC) subtitles...",
    "Performing dual-language translation matrix mappings...",
    "Compiling summarize indexes and vocab dictionaries...",
    "Finalizing visual reporting boards..."
  ];

  // Load history from LocalStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionItem[];
        setSessions(parsed);
        if (parsed.length > 0) {
          setSelectedSessionId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load local storage sessions history:", e);
    }
  }, []);

  // Save history to LocalStorage
  const saveSessions = (updatedList: SessionItem[]) => {
    setSessions(updatedList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.error("Failed to persist sessions in local storage:", e);
    }
  };

  // Timer loop for mic recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Clean recording on unmount
  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioStream]);

  // Start Live Mic Recording
  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      // Create a media recorder. WebM is supported in most modern browsers.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const dateStamp = new Date().toISOString().replace(/T/, "_").substring(0, 19);
        const fileName = `Microphone_Recording_${dateStamp}.webm`;
        const file = new File([audioBlob], fileName, { type: "audio/webm" });
        
        setSelectedFile(file);
        
        // Stops raw audio hardware instantly to clear system light indicators
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        setAudioStream(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Get chunks every 250ms
      setIsRecording(true);
    } catch (err: any) {
      console.error("Microphone hardware connection failed:", err);
      setErrorMsg(
        "Could not access your microphone. Please check system permissions or configure input sources correctly."
      );
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Add file to Batch Queue
  const addToQueue = () => {
    if (!selectedFile) return;
    const newItem: QueueItem = {
      id: crypto.randomUUID(),
      file: selectedFile,
      mode: mode,
      promptOverride: promptOverride,
    };
    setBatchQueue((prev) => [...prev, newItem]);
    setSelectedFile(null); // Clear selected file for next queue addition
  };

  // Remove from Batch Queue
  const removeFromQueue = (queueId: string) => {
    setBatchQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  // Sequential execution of transcribing single item
  const performTranscriptionRequest = async (
    file: File,
    itemMode: string,
    overrideText: string
  ): Promise<SessionItem> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", itemMode);
    formData.append("promptOverride", overrideText);

    // Dynamic fake step updates to reassure users during API delay
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 4500);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Server disconnected mid-request." }));
        throw new Error(errData.error || `Server returned error status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "An undocumented exception was returned from backend transcriber.");
      }

      // Generate a nice title
      const userTitle = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
      const formattedTitle = userTitle.replace(/[_-]/g, " ");

      const newSession: SessionItem = {
        id: crypto.randomUUID(),
        title: formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1),
        timestamp: new Date().toISOString(),
        fileName: file.name,
        fileSizeMB: result.fileSizeMB,
        mimeType: result.mimeType,
        mode: itemMode,
        data: result.data as TranscriptionData,
      };

      return newSession;
    } catch (err) {
      clearInterval(interval);
      throw err;
    }
  };

  // Transcribe Current selected single file immediately
  const handleTranscribeSingle = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setLoadingStep(0);
    setErrorMsg(null);

    try {
      const newSession = await performTranscriptionRequest(selectedFile, mode, promptOverride);
      const updated = [newSession, ...sessions];
      saveSessions(updated);
      setSelectedSessionId(newSession.id);
      setSelectedFile(null);
      setPromptOverride("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while transcribing your file.");
    } finally {
      setIsLoading(false);
    }
  };

  // Start sequential batch job processing for queue
  const processBatchQueue = async () => {
    if (batchQueue.length === 0) return;
    setIsProcessingQueue(true);
    setIsLoading(true);
    setErrorMsg(null);

    const completedSessions: SessionItem[] = [];
    let hasErrors = false;

    for (let i = 0; i < batchQueue.length; i++) {
      const item = batchQueue[i];
      setLoadingStep(0);
      try {
        const newSession = await performTranscriptionRequest(item.file, item.mode, item.promptOverride);
        completedSessions.push(newSession);
      } catch (err: any) {
        console.error(`Failed to batch item ${item.file.name}:`, err);
        setErrorMsg(`Batch error during processing '${item.file.name}': ${err.message || ""}. Skipping to next.`);
        hasErrors = true;
      }
    }

    if (completedSessions.length > 0) {
      const updated = [...completedSessions, ...sessions];
      saveSessions(updated);
      setSelectedSessionId(completedSessions[0].id); // select first processed item
    }

    setBatchQueue([]); // Clear queue upon finishing
    setIsProcessingQueue(false);
    setIsLoading(false);
  };

  // Select a session from sidebar
  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
  };

  // Delete individual session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    if (selectedSessionId === id) {
      setSelectedSessionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Clear all history
  const handleClearAllSessions = () => {
    if (window.confirm("Are you absolutely sure you want to purge your complete Khmer transcription history?")) {
      saveSessions([]);
      setSelectedSessionId(null);
    }
  };

  // Find currently active session item
  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Format Duration seconds -> mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      
      {/* HEADER SECTION */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition"
            title="Toggle Sidebar History"
          >
            <History className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg font-black tracking-widest text-xs animate-[pulse_3s_infinite]">
              STT
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-slate-200">
                KHMER SPEECH TRANSCRIBER
              </h1>
              <p className="text-[10px] text-blue-400 tracking-wider uppercase font-mono font-bold leading-none mt-0.5">
                Powered by Google Gemini 3.5
              </p>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full py-1 px-3.5">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-[10px] text-stone-400 font-mono font-medium tracking-wide">
            GEMINI: DEPLOYED (25MB SAFE LIMIT)
          </span>
        </div>
      </header>

      {/* DASHBOARD BODY MODULE */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Dynamic sliding History sidebar */}
        <HistorySidebar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAllSessions={handleClearAllSessions}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* MAIN PANEL CONTENT GRID */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 min-w-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/50">
          
          {/* If currently transcribing, display gorgeous progression board */}
          {isLoading ? (
            <div className="max-w-xl mx-auto mt-12 bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden animate-[fadeIn_0.3s_ease-out]">
              <div className="space-y-6">
                
                {/* Sonic loader pulse bubbles */}
                <div className="flex items-center justify-center gap-1.5 py-4">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></div>
                  <div className="h-5.5 w-1 rounded-full bg-blue-500 animate-[bounce_1s_infinite_0.1s]"></div>
                  <div className="h-8 w-1 rounded-full bg-blue-500 animate-[bounce_1s_infinite_0.2s]"></div>
                  <div className="h-10 w-1.5 rounded-full bg-blue-400 animate-[bounce_1s_infinite_0.3s] shadow-[0_0_10px_rgba(59,130,246,0.4)]"></div>
                  <div className="h-12 w-1.5 rounded-full bg-blue-400 animate-[bounce_1s_infinite_0.4s] shadow-[0_0_12px_rgba(59,130,246,0.5)]"></div>
                  <div className="h-8 w-1.5 rounded-full bg-blue-500 animate-[bounce_1s_infinite_0.5s]"></div>
                  <div className="h-5.5 w-1 rounded-full bg-blue-500 animate-[bounce_1s_infinite_0.6s]"></div>
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-base font-bold text-slate-100 tracking-wide uppercase">
                    Analyzing Khmer Audio
                  </h2>
                  <p className="text-xs text-slate-400">
                    This can take between 20 to 60 seconds depending on audio size.
                  </p>
                </div>

                {/* Main progression slider */}
                <div className="space-y-2.5">
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-blue-600 h-full rounded-full shadow-[0_0_12px_#2563EB] transition-all duration-700"
                      style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    <span>PROGRESS STATUS</span>
                    <span>{Math.round(((loadingStep + 1) / loadingSteps.length) * 100)}%</span>
                  </div>
                </div>

                {/* Current progression step details */}
                <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1.5 min-h-[72px] flex flex-col justify-center">
                  <div className="text-[10px] text-blue-400 font-mono uppercase tracking-widest font-extrabold">
                    ACTIVE STEP {loadingStep + 1} OF {loadingSteps.length}
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    {loadingSteps[loadingStep]}
                  </p>
                </div>
              </div>

              {/* Shimmer overlay line details */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[shimmer_3s_infinite]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT PANEL CONTROLS (6 COLS IF TRANSCRIBED, 12 COLS IF IDLE) */}
              <div className={`space-y-6 ${currentSession ? "lg:col-span-4" : "max-w-2xl mx-auto lg:col-span-12 w-full"}`}>
                
                {/* Title info block for empty dashboard state */}
                {!currentSession && (
                  <div className="text-center mb-6 max-w-xl mx-auto space-y-3">
                    <h2 className="text-2xl md:text-3xl font-black font-sans tracking-tight text-slate-100 mt-2">
                      TRANSCRIPTION & LYRIC ENGINE FOR <span className="text-blue-400">KHMER</span>
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload meeting logs, speeches, vocal audio, or songs. Our high-precision system performs verbatim spelling correction, diarizes speakers, aligns dual English subtitles, and formats karaoke LRC lines natively.
                    </p>
                  </div>
                )}

                {/* CONTROL MODULE CARD */}
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>1. Input Configuration</span>
                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  </h3>

                  {/* Mode select board */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Transcription Context Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setMode("general")}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold uppercase tracking-wider transition ${
                          mode === "general"
                            ? "bg-blue-950/40 text-blue-300 border-blue-500/50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                        title="Optimize for standard speaking dialog and voice memos"
                      >
                        General Speech
                      </button>
                      <button
                        onClick={() => setMode("meeting")}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold uppercase tracking-wider transition ${
                          mode === "meeting"
                            ? "bg-blue-950/40 text-blue-300 border-blue-500/50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                        title="Optimize for interviews and panel speakings with distinct diarization"
                      >
                        Dialogue/Meeting
                      </button>
                      <button
                        onClick={() => setMode("music")}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold uppercase tracking-wider transition ${
                          mode === "music"
                            ? "bg-blue-950/40 text-blue-300 border-blue-500/50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                        title="Optimize for songs, detecting instrumental rhythms, Verse, and Chorus parts"
                      >
                        Vocal Music
                      </button>
                    </div>
                  </div>

                  {/* Upload Field */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Audio / Video Target Source
                    </label>
                    
                    <UploadArea
                      onFileSelected={(file) => {
                        setSelectedFile(file);
                        setErrorMsg(null);
                      }}
                      isLoading={isLoading}
                      selectedFile={selectedFile}
                      onClear={() => setSelectedFile(null)}
                    />
                  </div>

                  {/* Microphones audio recorder */}
                  <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold uppercase tracking-wider">
                        <Mic className="h-4 w-4 text-blue-400" />
                        Live Recording Console
                      </div>
                      {isRecording && (
                        <span className="text-[10px] font-mono text-red-400 bg-red-950/30 border border-red-900/50 px-2 py-0.5 rounded animate-pulse">
                          LIVE: {formatTime(recordingDuration)}
                        </span>
                      )}
                    </div>

                    <AudioWaveformCanvas isRecording={isRecording} audioStream={audioStream} />

                    <div className="flex gap-2">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex-1 py-2 px-3 bg-red-950/30 hover:bg-red-900/30 border border-red-900/40 hover:border-red-500 text-red-200 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          Start Live Record
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="flex-1 py-2 px-3 bg-red-500 hover:bg-red-600 text-slate-950 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                        >
                          <Square className="h-3.5 w-3.5 fill-current" />
                          Stop & Auto-Stage File
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Prompt override custom rules input */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex justify-between">
                      <span>Translation & Accent Overrides (Optional)</span>
                      <span className="text-[9px] text-slate-500 italic lowercase">e.g. spelling guidelines</span>
                    </label>
                     <textarea
                      value={promptOverride}
                      onChange={(e) => setPromptOverride(e.target.value)}
                      placeholder="e.g. Include background details, translate into poetic English prose, or note this features historic royal Khmer..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors h-16 resize-none"
                    />
                  </div>

                  {/* Submit / Queue buttons */}
                  <div className="flex gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      disabled={!selectedFile || isLoading}
                      onClick={addToQueue}
                      className="px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-45 text-xs text-white font-semibold transition cursor-pointer"
                      title="Add to sequence batch list and stage another"
                    >
                      Stage Batch Queue ({batchQueue.length})
                    </button>

                    <button
                      type="button"
                      disabled={!selectedFile || isLoading}
                      onClick={handleTranscribeSingle}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white text-xs font-black tracking-wider uppercase flex items-center justify-center gap-1.5 transition shadow-[0_4px_12px_rgba(37,99,235,0.15)] cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 fill-current" />
                      Transcribe Immediate
                    </button>
                  </div>
                </div>

                 {/* BATCH QUEUE SECTION */}
                {batchQueue.length > 0 && (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-blue-400" />
                        Sequence Batch Queue ({batchQueue.length})
                      </span>
                      <button
                        onClick={() => setBatchQueue([])}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Reset Queue
                      </button>
                    </div>

                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 p-1">
                      {batchQueue.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-zinc-300"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <FileAudio className="h-3.5 w-3.5 text-zinc-500" />
                            <span className="truncate" title={item.file.name}>{item.file.name}</span>
                            <span className="text-[9px] text-blue-500 font-bold uppercase shrink-0">({item.mode})</span>
                          </div>
                          
                          <button
                            onClick={() => removeFromQueue(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={processBatchQueue}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-[0_0_12px_rgba(37,99,235,0.2)]"
                    >
                      Process Queue Sequentially
                    </button>
                  </div>
                )}

                {/* ERROR FEEDBACK BAR */}
                {errorMsg && (
                  <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-start gap-3 text-xs text-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-300 mb-0.5 uppercase tracking-wide">Audio Engine Exception</h4>
                      <p className="leading-relaxed">{errorMsg}</p>
                    </div>
                  </div>
                )}

              </div>

              {/* RIGHT PANEL TRANSCRIBED DATA VIEWER */}
              <div className={`col-span-12 ${currentSession ? "lg:col-span-8 h-[calc(100vh-100px)] flex flex-col" : "hidden md:flex flex-col items-center justify-center p-12 text-center text-slate-500 max-w-xl mx-auto rounded-3xl border border-dashed border-slate-800 bg-slate-950/15"}`}>
                
                {currentSession ? (
                  <ResultSection data={currentSession.data} fileName={currentSession.fileName} />
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <Sparkles className="h-10 w-10 text-blue-500/40 mb-3 animate-[pulse_3s_infinite]" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Report Screen Idle
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Select or record an audio file to the left and click transcribe to witness full visual indexes. Previous jobs can be retrieved using history button.
                    </p>
                  </div>
                )}

              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
}
