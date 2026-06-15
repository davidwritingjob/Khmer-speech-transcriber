import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, FileAudio, FileVideo, AlertCircle, Sparkles } from "lucide-react";

interface UploadAreaProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  selectedFile: File | null;
  onClear: () => void;
}

export default function UploadArea({
  onFileSelected,
  isLoading,
  selectedFile,
  onClear,
}: UploadAreaProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Supported extensions
  const allowedExtensions = [".mp3", ".wav", ".m4a", ".webm", ".mp4"];
  const maxFileSizeMB = 25;

  const validateAndProcessFile = (file: File) => {
    setErrorMsg(null);
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

    // Check extension
    if (!allowedExtensions.includes(fileExtension)) {
      setErrorMsg(
        `Unsupported format (${fileExtension}). We support MP3, WAV, M4A, WEBM, and MP4.`
      );
      return;
    }

    // Check size (25MB limit)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMB) {
      setErrorMsg(
        `File too large (${fileSizeMB.toFixed(1)}MB). Please choose a file under ${maxFileSizeMB}MB.`
      );
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const triggerBrowse = () => {
    if (isLoading) return;
    fileInputRef.current?.click();
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "mp4") {
      return <FileVideo className="h-10 w-10 text-blue-400" />;
    }
    return <FileAudio className="h-10 w-10 text-blue-400" />;
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.webm,.mp4"
        onChange={handleFileChange}
        className="hidden"
        disabled={isLoading}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={selectedFile ? undefined : triggerBrowse}
        className={`w-full relative overflow-hidden rounded-xl border-2 border-dashed transition-all p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] ${
          isDragActive
            ? "border-blue-400 bg-blue-950/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
            : selectedFile
            ? "border-blue-500/50 bg-slate-900/60"
            : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/20"
        } ${isLoading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
      >
        {selectedFile ? (
          <div className="w-full flex flex-col items-center">
            {getFileIcon(selectedFile.name)}
            
            <div className="mt-3 text-sm font-medium text-white max-w-md break-all">
              {selectedFile.name}
            </div>
            
            <div className="mt-1 text-xs text-slate-400 font-mono">
              Type: {selectedFile.type || "Audio/Video File"} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerBrowse();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white border border-slate-700 transition"
              >
                Change File
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/60 text-xs text-red-200 border border-red-900/50 transition"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg group-hover:scale-105 transition-transform">
              <Upload className="h-6 w-6 text-blue-400 animate-pulse" />
            </div>
            
            <div className="mt-4 text-sm font-medium text-slate-200">
              Drag & Drop files here, or <span className="text-blue-400 hover:underline">browse</span>
            </div>
            
            <p className="mt-1.5 text-xs text-slate-400">
              Supports MP3, WAV, M4A, WEBM, MP4 (Max 25MB)
            </p>

            <div className="mt-4 flex items-center justify-center gap-1.5 bg-blue-950/30 border border-blue-900/30 rounded-full px-3 py-1">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] text-blue-300 font-mono uppercase tracking-widest">
                Multimodal transcribe
              </span>
            </div>
          </div>
        )}

        {/* Laser scanner line effect during drag or select */}
        {isDragActive && (
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[shimmer_2s_infinite] shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 flex items-start gap-2 bg-red-950/40 border border-red-900/50 rounded-xl p-3 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
    </div>
  );
}
