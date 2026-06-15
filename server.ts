import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

// Set limits for file uploads/transfers safely to prevent OOM
app.use(express.json({ limit: "40mb" }));
app.use(express.urlencoded({ limit: "40mb", extended: true }));

// Configure Multer for processing file uploads in memory safely
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB limit matching client-side limit of 25MB safely
  },
});

// Lazy-loaded Gemini initialization helper
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required but missing. Please configure it in your Settings > Secrets."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    api_key_configured: !!process.env.GEMINI_API_KEY,
  });
});

/**
 * Handle audio/video uploads and perform transcription, translation, and audio analysis using Gemini
 */
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const mode = req.body.mode || "general"; // 'general', 'music', 'meeting'
    const promptOverride = req.body.promptOverride || "";

    if (!file) {
      return res.status(400).json({ error: "No audio or video file was provided in the upload." });
    }

    const mimeType = file.mimetype;
    const sizeInMB = file.size / (1024 * 1024);

    // Convert file buffer to base64 for Gemini multimodal API
    const base64Data = file.buffer.toString("base64");

    const promptText = `You are a professional Khmer audio processor, professional linguist, native Khmer transcriber, and musical content analyst.
Analyze the uploaded Khmer audio (or video) file and perform the following tasks with high accuracy:

1. **Khmer Speech-to-Text Transcription**: 
   Provide an exceptionally clean, readable, word-for-word Khmer text transcription. Correct Khmer spelling, grammar, and spoken contractions to standard formal Khmer automatically. 
2. **Speaker Diarization**: 
   Identify distinct speaker parts (e.g. "Speaker 1", "Speaker 2", or "Vocalist" if a song/singing, "Host" if interview). Include timestamps for each turn in the exact HH:MM:SS format, or MM:SS format.
3. **Subtitles Generation**:
   - SubRip (SRT) subtitles. Ensure accurate timings mapped roughly to the spoken words.
   - WebVTT (VTT) subtitles. Format properly.
   - LRC Karaoke lyrics with precise tags formatted in standard [mm:ss.xx] (minutes:seconds.centiseconds) format.
4. **Translation**:
   - English Translation: Translate the full Khmer transcript to natural, articulate, professional English.
   - Dual-Language Comparison: Line-by-line comparison alternating between standard Khmer and English translation.
5. **Executive Summary & Metadata**:
   - Provide a 1-paragraph high-level concise Executive Summary of the spoken content (or song meaning).
   - Extract 5-10 key topics, concepts, or hashtags.
   - Extract a list of important keywords with brief descriptions or Khmer-English terms.
6. **Music Features (Song Analysis)**:
   - Identify if this file features a song, musical accompaniment, or singing ("is_song": true/false).
   - Detect Verse, Chorus, Bridge, or Intro/Outro sections. Match the sections with their respective timestamps (MM:SS) and cleaned lyrics.
   - Detect/estimate Vocal volume ratio vs. Instrumental volume ratio (percentages summing up to 100).
   - Clean up non-verbal audio noise, grunts, or background elements from the cleaned lyrics list.

IMPORTANT: You MUST respond with ONLY a valid, parsable, and well-structured JSON object. Do not wrap the JSON output in markdown code blocks like \`\`\`json. Your output must strictly be raw JSON matching this structure:

{
  "transcript": "Full clean Khmer transcript text here...",
  "diarization": [
    {
      "speaker": "Speaker 1",
      "startTime": "00:00:01",
      "endTime": "00:00:15",
      "text": "Khmer spoken text here..."
    }
  ],
  "subtitles": {
    "srt": "1\\n00:00:01,000 --> 00:00:05,000\\nKhmer subtitle here...",
    "vtt": "WEBVTT\\n\\n1\\n00:00:01.000 --> 00:00:05.000\\nKhmer subtitle here...",
    "lrc": "[00:01.00]Khmer karaoke lyric 1\\n[00:05.15]Khmer karaoke lyric 2"
  },
  "translation_en": "Complete high-quality English translation text here...",
  "translation_km_en": [
    {
      "khmer": "Khmer sentence here...",
      "english": "English translation here..."
    }
  ],
  "summary": {
    "executive": "Concise executive summary of the audio file in English...",
    "keywords": [
      { "word": "ពាក្យគន្លឹះ (Keyword)", "meaning": "English/Khmer explanation..." }
    ],
    "topics": ["Topic 1", "Topic 2", "Topic 3"]
  },
  "music_features": {
    "is_song": true,
    "vocal_ratio": 70,
    "instrumental_ratio": 30,
    "sections": [
      {
        "type": "Verse 1 / Chorus / Bridge / Intro",
        "startTime": "00:00",
        "endTime": "00:45",
        "lyrics": "Khmer clean lyrics here..."
      }
    ],
    "cleaned_lyrics": "Cleaned Khmer lyrics with no verbal gap noise..."
  }
}

Customize your depth of musical or speaking analysis to fit the selected mode ("${mode}"). Extra user instructions: "${promptOverride}". Ensure standard JSON escape characters are used.`;

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Gemini returned an empty response. Let's try again.");
    }

    // Parse safety
    let jsonResult;
    try {
      jsonResult = JSON.parse(outputText.trim());
    } catch (parseErr) {
      console.warn("Direct JSON parsing failed, attempting cleanup of code blocks:", parseErr);
      // Fallback: cleanup common markdown codeblock wrappers if models accidentally outputted them
      let cleanedText = outputText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "");
      }
      jsonResult = JSON.parse(cleanedText.trim());
    }

    return res.json({
      success: true,
      fileName: file.originalname,
      fileSizeMB: parseFloat(sizeInMB.toFixed(2)),
      mimeType: mimeType,
      mode: mode,
      data: jsonResult,
    });
  } catch (err: any) {
    console.error("Transcription error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during audio processing.",
    });
  }
});

// Configure Vite integration or Production Fallback
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Khmer Speech Transcriber] Server actively running on http://localhost:${PORT}`);
  });
}

startServer();
