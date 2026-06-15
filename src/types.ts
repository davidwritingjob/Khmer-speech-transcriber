export interface DiarizationSegment {
  speaker: string;
  startTime: string;
  endTime: string;
  text: string;
}

export interface TranslationLine {
  khmer: string;
  english: string;
}

export interface Keyword {
  word: string;
  meaning: string;
}

export interface MusicSection {
  type: string;
  startTime: string;
  endTime: string;
  lyrics: string;
}

export interface MusicFeatures {
  is_song: boolean;
  vocal_ratio: number;
  instrumental_ratio: number;
  sections?: MusicSection[];
  cleaned_lyrics?: string;
}

export interface TranscriptionData {
  transcript: string;
  diarization: DiarizationSegment[];
  subtitles: {
    srt: string;
    vtt: string;
    lrc: string;
  };
  translation_en: string;
  translation_km_en: TranslationLine[];
  summary: {
    executive: string;
    keywords: Keyword[];
    topics: string[];
  };
  music_features?: MusicFeatures;
}

export interface SessionItem {
  id: string;
  title: string;
  timestamp: string;
  fileName: string;
  fileSizeMB: number;
  mimeType: string;
  mode: string;
  data: TranscriptionData;
}
