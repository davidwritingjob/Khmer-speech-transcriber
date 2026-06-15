import { useState, useMemo } from "react";
import JSZip from "jszip";
import {
  FileText,
  Clock,
  Subtitles,
  Languages,
  BookOpen,
  Music,
  Copy,
  Check,
  Download,
  Search,
  Hash,
  Volume2
} from "lucide-react";
import { TranscriptionData } from "../types";

interface ResultSectionProps {
  data: TranscriptionData;
  fileName: string;
}

type TabType = "transcript" | "diarization" | "subtitles" | "translation" | "summary" | "music";

export default function ResultSection({ data, fileName }: ResultSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("transcript");
  const [searchText, setSearchText] = useState("");
  const [subType, setSubType] = useState<"srt" | "vtt" | "lrc">("srt");
  const [copied, setCopied] = useState(false);

  // Helper, checking if song features are valid
  const hasMusicFeatures = useMemo(() => {
    return data.music_features && (data.music_features.is_song || (data.music_features.sections && data.music_features.sections.length > 0));
  }, [data]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe file downloader
  const downloadFile = (content: string, ext: string, mimeType: string) => {
    const rawName = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rawName}_transcribed.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Exporters for individual formats
  const handleExportText = () => {
    downloadFile(data.transcript, "txt", "text/plain;charset=utf-8");
  };

  const handleExportSubtitle = (format: "srt" | "vtt" | "lrc") => {
    const content = data.subtitles[format] || "";
    downloadFile(content, format, "text/plain;charset=utf-8");
  };

  const handleExportDocx = () => {
    // Generate a beautiful structured text document with distinct sections
    let docContent = `KHMER SPEECH TRANSCRIBER - SUMMARY REPORT\n`;
    docContent += `=========================================\n`;
    docContent += `Source File: ${fileName}\n`;
    docContent += `Date Processed: ${new Date().toLocaleDateString()}\n\n`;

    docContent += `1. EXECUTIVE SUMMARY\n`;
    docContent += `--------------------\n`;
    docContent += `${data.summary.executive}\n\n`;

    docContent += `2. CORE TOPICS & HASHTAGS\n`;
    docContent += `-------------------------\n`;
    docContent += `${data.summary.topics.join(", ")}\n\n`;

    docContent += `3. KHMER SPEECH TRANSCRIPT\n`;
    docContent += `-------------------------\n`;
    docContent += `${data.transcript}\n\n`;

    docContent += `4. English Translation\n`;
    docContent += `----------------------\n`;
    docContent += `${data.translation_en}\n\n`;

    docContent += `5. SPEAKER DIARIZATION\n`;
    docContent += `----------------------\n`;
    data.diarization.forEach((seg) => {
      docContent += `[${seg.startTime} - ${seg.endTime}] ${seg.speaker}: ${seg.text}\n`;
    });

    if (hasMusicFeatures) {
      docContent += `\n6. MUSIC OR SONG LYRICS SUMMARY\n`;
      docContent += `-----------------------------\n`;
      docContent += `Vocal Ratio: ${data.music_features?.vocal_ratio}%\n`;
      docContent += `Instrumental Ratio: ${data.music_features?.instrumental_ratio}%\n\n`;
      data.music_features?.sections?.forEach((sec) => {
        docContent += `[${sec.startTime} - ${sec.endTime}] ${sec.type}:\n${sec.lyrics}\n\n`;
      });
    }

    // Standard word processors can open .doc file with plain text or rich formatting
    downloadFile(docContent, "doc", "application/msword;charset=utf-8");
  };

  const handleExportAllZip = async () => {
    try {
      const zip = new JSZip();
      const rawName = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;

      // 1. Khmer Transcript
      zip.file(`${rawName}_transcript_khmer.txt`, data.transcript || "");

      // 2. English Translation
      zip.file(`${rawName}_translation_english.txt`, data.translation_en || "");

      // 3. Subtitles
      if (data.subtitles) {
        if (data.subtitles.srt) zip.file(`${rawName}_subtitle.srt`, data.subtitles.srt);
        if (data.subtitles.vtt) zip.file(`${rawName}_subtitle.vtt`, data.subtitles.vtt);
        if (data.subtitles.lrc) zip.file(`${rawName}_subtitle.lrc`, data.subtitles.lrc);
      }

      // 4. Diarization
      if (data.diarization && data.diarization.length > 0) {
        let diarizationText = `SPEAKER DIARIZATION REPORT\n`;
        diarizationText += `==========================\n\n`;
        data.diarization.forEach((seg) => {
          diarizationText += `[${seg.startTime} - ${seg.endTime}] ${seg.speaker}: ${seg.text}\n`;
        });
        zip.file(`${rawName}_speaker_diarization.txt`, diarizationText);
      }

      // 5. Summary and Vocabulary
      let summaryText = `EXECUTIVE SUMMARY & ANALYSIS REPORT\n`;
      summaryText += `====================================\n\n`;
      summaryText += `Executive Summary:\n`;
      summaryText += `------------------\n`;
      summaryText += `${data.summary?.executive || ""}\n\n`;

      if (data.summary?.topics && data.summary.topics.length > 0) {
        summaryText += `Topics Identified:\n`;
        summaryText += `------------------\n`;
        summaryText += `${data.summary.topics.join(", ")}\n\n`;
      }

      if (data.summary?.keywords && data.summary.keywords.length > 0) {
        summaryText += `Important Vocabulary dictionary:\n`;
        summaryText += `-------------------------------\n`;
        data.summary.keywords.forEach((kw) => {
          summaryText += `- ${kw.word}: ${kw.meaning}\n`;
        });
        summaryText += `\n`;
      }

      if (hasMusicFeatures && data.music_features) {
        summaryText += `Vocal & Music Analysis:\n`;
        summaryText += `-----------------------\n`;
        summaryText += `Vocal Ratio: ${data.music_features.vocal_ratio}%\n`;
        summaryText += `Instrumental Ratio: ${data.music_features.instrumental_ratio}%\n\n`;
        if (data.music_features.cleaned_lyrics) {
          summaryText += `Cleaned Lyrics:\n`;
          summaryText += `${data.music_features.cleaned_lyrics}\n\n`;
        }
        if (data.music_features.sections && data.music_features.sections.length > 0) {
          summaryText += `Chronological Lyrics Sections:\n`;
          data.music_features.sections.forEach((sec) => {
            summaryText += `[${sec.startTime} - ${sec.endTime}] ${sec.type}:\n${sec.lyrics}\n\n`;
          });
        }
      }

      zip.file(`${rawName}_executive_summary.txt`, summaryText);

      // Generate ZIP archive blob
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rawName}_packaged_all_transcriptions.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ZIP Generation failed", e);
      alert("Failed to package ZIP archive properly.");
    }
  };

  // Highlight matches of search inside transcript
  const highlightedTranscript = useMemo(() => {
    const text = data.transcript;
    if (!searchText.trim()) return text;

    try {
      // Escape special characters for regex
      const escapedSearch = searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`(${escapedSearch})`, "gi");
      
      // Simple Split and element map inside JSX during render is safer, 
      // but let's do safe regex replacements with markers, then split.
      return text.split(regex).map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className="bg-blue-500 text-slate-900 rounded px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  }, [data.transcript, searchText]);

  // Speaker Color mapping helper
  const getSpeakerColor = (speaker: string) => {
    const lower = speaker.toLowerCase();
    if (lower.includes("1")) return "bg-blue-500/10 text-blue-405 border-blue-500/20";
    if (lower.includes("2")) return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    if (lower.includes("3")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (lower.includes("vocal") || lower.includes("singer")) return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    return "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Tab Navigation Headers */}
      <div className="flex select-none border-b border-slate-800 bg-slate-900 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => setActiveTab("transcript")}
          className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
            activeTab === "transcript"
              ? "border-blue-500 bg-slate-900 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <FileText className="h-4 w-4" />
          Transcript
        </button>

        <button
          onClick={() => setActiveTab("diarization")}
          className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
            activeTab === "diarization"
              ? "border-blue-500 bg-slate-900 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Clock className="h-4 w-4" />
          Speaker Diarization
        </button>

        <button
          onClick={() => setActiveTab("subtitles")}
          className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
            activeTab === "subtitles"
              ? "border-blue-500 bg-slate-900 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Subtitles className="h-4 w-4" />
          Subtitles & Lyrics
        </button>

        <button
          onClick={() => setActiveTab("translation")}
          className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
            activeTab === "translation"
              ? "border-blue-500 bg-slate-900 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Languages className="h-4 w-4" />
          Translation Comparisons
        </button>

        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
            activeTab === "summary"
              ? "border-blue-500 bg-slate-900 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Summary & Keywords
        </button>

        {hasMusicFeatures && (
          <button
            onClick={() => setActiveTab("music")}
            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 outline-none shrink-0 ${
              activeTab === "music"
                ? "border-blue-500 bg-slate-900 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Music className="h-4 w-4 text-blue-400" />
            Vocal & Music Sections
          </button>
        )}
      </div>

      {/* Global Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/85 border-b border-slate-900 p-3 shrink-0">
        <span className="text-[10px] text-zinc-500 font-mono tracking-wider italic">
          Khmer Spelling Level: Corrected Standard formal
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleCopy(
              activeTab === "transcript" ? data.transcript :
              activeTab === "translation" ? data.translation_en :
              activeTab === "subtitles" ? data.subtitles[subType] :
              JSON.stringify(data, null, 2)
            )}
            className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-blue-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Active"}
          </button>

          <button
            onClick={handleExportText}
            className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition"
            title="Export Pure Khmer Text File"
          >
            <Download className="h-3.5 w-3.5" />
            Plain Text (.txt)
          </button>

          <button
            onClick={handleExportDocx}
            className="flex items-center gap-1 bg-blue-950/30 border border-blue-900/40 hover:bg-blue-900/20 text-blue-300 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition"
            title="Export Word Document Summaries"
          >
            <Download className="h-3.5 w-3.5" />
            Report (.docx)
          </button>

          <button
            onClick={handleExportAllZip}
            className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg cursor-pointer transition shadow-[0_2px_8px_rgba(37,99,235,0.2)]"
            title="Package all transcripts, subtitles, and report summaries into a ZIP archive"
          >
            <Download className="h-3.5 w-3.5" />
            Export All (.zip)
          </button>
        </div>
      </div>

      {/* Tab Panels with Scrollable Areas */}
      <div className="flex-1 overflow-y-auto p-5 pb-8 min-h-0 bg-slate-950">
        
        {/* --- TAB: TRANSCRIPT --- */}
        {activeTab === "transcript" && (
          <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">
                Corrected Transcript (អត្ថបទចម្លង)
              </h3>
              
              {/* Internal Transcript Search */}
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Seach words inside Khmer..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 leading-relaxed text-slate-200 text-sm whitespace-pre-line tracking-wide">
              {highlightedTranscript}
            </div>

            <div className="p-4 rounded-xl border border-dashed border-blue-900/30 bg-blue-950/10 flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-blue-950/60 text-blue-400 text-xs text-[10px] font-bold">INFO</span>
              <p className="text-xs text-slate-400">
                The transcription was aligned of native Khmer speaking phonetics. Grammatical connectors like រឺ (or), ហើយ (and), and spelling corrections for standard dialect are fully optimized.
              </p>
            </div>
          </div>
        )}

        {/* --- TAB: DIARIZATION --- */}
        {activeTab === "diarization" && (
          <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">
              Speaker Turn segments (ការកំណត់អត្តសញ្ញាណអ្នកនិយាយ)
            </h3>

            <div className="space-y-3.5">
              {data.diarization?.map((seg, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/10 hover:border-slate-800 hover:bg-slate-900/30 transition-all flex gap-3.5"
                >
                  <div className="flex flex-col items-center">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${getSpeakerColor(seg.speaker)}`}>
                      {seg.speaker}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1 font-semibold">
                      <Clock className="h-2.5 w-2.5" />
                      {seg.startTime}
                    </span>
                  </div>

                  <div className="flex-1 text-sm text-slate-200 leading-relaxed pt-0.5 tracking-wide">
                    {seg.text}
                  </div>
                </div>
              ))}

              {(!data.diarization || data.diarization.length === 0) && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No speaker segmented blocks found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: SUBTITLES & LYRICS --- */}
        {activeTab === "subtitles" && (
          <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-1 bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
                <button
                  onClick={() => setSubType("srt")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition ${
                    subType === "srt" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  SRT Subtitles
                </button>
                <button
                  onClick={() => setSubType("vtt")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition ${
                    subType === "vtt" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  WebVTT
                </button>
                <button
                  onClick={() => setSubType("lrc")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition ${
                    subType === "lrc" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  LRC Karaoke
                </button>
              </div>

              <button
                onClick={() => handleExportSubtitle(subType)}
                className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download .{subType} File
              </button>
            </div>

            <pre className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-[11px] leading-relaxed text-blue-500 overflow-x-auto max-h-[380px] overflow-y-auto whitespace-pre-wrap select-text">
              {data.subtitles[subType] || `[System] No .${subType} subtitle content available of this audio.`}
            </pre>
          </div>
        )}

        {/* --- TAB: TRANSLATION COMPARISONS --- */}
        {activeTab === "translation" && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex flex-col gap-1.5 border-b border-slate-900 pb-3">
              <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">
                Khmer to English line comparison (បកប្រែភាសា)
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Alternating layout allows synchronized cross-checking. Clean dialect mapping maintains original context.
              </p>
            </div>

            {/* Split Comparison Boxes */}
            <div className="space-y-4">
              {data.translation_km_en?.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-4 rounded-xl border border-slate-800/80 bg-slate-900/10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-teal-400 tracking-wide uppercase font-mono bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-900/30">Khmer</span>
                    <p className="text-sm text-slate-200 font-medium leading-relaxed tracking-wide pt-1">{item.khmer}</p>
                  </div>
                  <div className="space-y-1 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                    <span className="text-[10px] font-bold text-blue-400 tracking-wide uppercase font-mono bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/30">English Translation</span>
                    <p className="text-sm text-stone-300 italic leading-relaxed pt-1 font-serif">{item.english}</p>
                  </div>
                </div>
              ))}

              {(!data.translation_km_en || data.translation_km_en.length === 0) && (
                <div className="p-5 rounded-lg border border-slate-800 bg-slate-900/20 text-stone-300">
                  <h4 className="text-xs font-semibold mb-2">English Prose Translation:</h4>
                  <p className="text-xs leading-relaxed font-serif text-slate-400 italic">{data.translation_en}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: SUMMARY & KEYWORDS --- */}
        {activeTab === "summary" && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            {/* Executive Summary Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Executive Summary</h4>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/20 text-stone-200 leading-relaxed font-serif text-base italic shadow-inner">
                "{data.summary.executive}"
              </div>
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extracted Topics</h4>
              <div className="flex flex-wrap gap-2">
                {data.summary.topics?.map((topic, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white transition cursor-default"
                  >
                    <Hash className="h-3 w-3 text-blue-400" />
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Key Term Meaning Dictionary */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Important Vocabulary dictionary</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="p-3.5 text-xs text-slate-400 font-bold tracking-wider uppercase">Keyword / Word</th>
                      <th className="p-3.5 text-xs text-slate-400 font-bold tracking-wider uppercase">Meaning & Descriptions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {data.summary.keywords?.map((kw, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/20 transition-all">
                        <td className="p-3.5 text-xs text-blue-400 font-semibold tracking-wide">{kw.word}</td>
                        <td className="p-3.5 text-xs text-slate-300 leading-relaxed">{kw.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: MUSIC/SONG DETAILS --- */}
        {activeTab === "music" && hasMusicFeatures && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            
            {/* Auditory composition breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/10 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="h-4 w-4 text-blue-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Audio Composition Meter</span>
                </div>
                
                <div className="space-y-3">
                  {/* Vocal Ratio Indicator */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-mono">
                      <span className="text-blue-300 font-semibold">VOCAL / SINGING LEVEL:</span>
                      <span className="text-white font-bold">{data.music_features?.vocal_ratio}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full shadow-[0_0_8px_#2563EB]"
                        style={{ width: `${data.music_features?.vocal_ratio}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Instrumental Ratio Indicator */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-mono">
                      <span className="text-indigo-300">INSTRUMENTAL / BEAT TRACK:</span>
                      <span className="text-white font-bold">{data.music_features?.instrumental_ratio}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full shadow-[0_0_10px_#6366F1]"
                        style={{ width: `${data.music_features?.instrumental_ratio}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/10 border border-slate-800 rounded-xl leading-relaxed flex flex-col justify-center text-xs">
                <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase tracking-wide font-mono">
                  <Music className="h-4 w-4" />
                  CLEANED SONG STRUCTURE info
                </div>
                <p className="text-slate-400 leading-normal">
                  Our algorithm successfully segmented lyrics sections (Intro, Chorus, Verse) by matching pitch, rhythm signatures, and phoneme pauses, cleaning up accidental noise.
                </p>
              </div>
            </div>

            {/* Song Segment Sections */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chronological Lyrics Sections</h4>
              
              <div className="space-y-3">
                {data.music_features?.sections?.map((sec, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-900/5 hover:border-slate-700 transition">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-blue-900/40 text-blue-300 border border-blue-800">
                        {sec.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">
                        {sec.startTime} - {sec.endTime}
                      </span>
                    </div>
                    
                    <div className="text-sm text-slate-200 leading-relaxed font-sans font-medium hover:text-white transition whitespace-pre-line tracking-wide">
                      {sec.lyrics}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Cleaned Full Text */}
            {data.music_features?.cleaned_lyrics && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cleaned Full Lyrics Output</h4>
                <div className="p-5 rounded-xl border border-slate-805 bg-slate-950/50 text-slate-200 text-sm whitespace-pre-line leading-relaxed text-center italic tracking-wide">
                  {data.music_features.cleaned_lyrics}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
