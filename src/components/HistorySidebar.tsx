import React, { useState, useMemo } from "react";
import { Search, Trash2, Calendar, FileText, Music, BarChart, X } from "lucide-react";
import { SessionItem } from "../types";

interface HistorySidebarProps {
  sessions: SessionItem[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onClearAllSessions: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function HistorySidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onClearAllSessions,
  isOpen = true,
  onClose,
}: HistorySidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const lower = searchTerm.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        s.fileName.toLowerCase().includes(lower) ||
        s.data.transcript.toLowerCase().includes(lower)
    );
  }, [sessions, searchTerm]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className={`h-full flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 w-80 shrink-0 ${
        isOpen ? "translate-x-0 ml-0" : "-translate-x-full -ml-80"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Transcription History
          </h2>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search transcripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 mt-4 text-slate-500">
            <FileText className="h-8 w-8 text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-xs">No sessions saved yet</p>
            {searchTerm && <p className="text-[10px] mt-1 text-slate-600">Try matching on another name or keyword</p>}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`group flex items-center justify-between rounded-xl p-3 border cursor-pointer transition-all ${
                selectedSessionId === session.id
                  ? "bg-slate-800 border-blue-500/50 shadow-[0_2px_8px_rgba(37,99,235,0.06)]"
                  : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-950/90 hover:border-slate-800"
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-1">
                  {session.mode === "music" ? (
                    <Music className="h-3 w-3 text-blue-400 shrink-0" />
                  ) : (
                    <FileText className="h-3 w-3 text-sky-400 shrink-0" />
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {session.mode.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                  {session.title}
                </div>

                <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                  {session.fileName}
                </div>

                <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-500 font-mono">
                  <span>{formatDate(session.timestamp)}</span>
                  <span>•</span>
                  <span>{session.fileSizeMB.toFixed(1)} MB</span>
                </div>
              </div>

              <button
                onClick={(e) => onDeleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-all shrink-0"
                title="Delete Session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {sessions.length > 0 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/30">
          <button
            onClick={onClearAllSessions}
            className="w-full py-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-[10px] font-semibold text-red-300 border border-red-900/30 transition uppercase tracking-wider"
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}
