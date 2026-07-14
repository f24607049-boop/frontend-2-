/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProcessPage {
  label: string;
  success: boolean;
  text: string;
  error: string | null;
  time_sec: number;
}

export interface ProcessResponse {
  filename: string;
  is_pdf: boolean;
  pages: ProcessPage[];
  raw_combined_text: string;
  structured_text: string;
  structuring_error: string | null;
}

export interface UsageResponse {
  remaining_pages_today: number;
  daily_limit: number;
}

export interface GlossaryItem {
  term: string;
  urdu: string;
  definition: string;
}

export interface FlashcardItem {
  question: string;
  answer: string;
}

export interface SavedSessionPage {
  id: string;
  filename: string;
  scannedAt: string;
  rawText: string;
  structuredText: string;
  imagePreviewUrl?: string; // object URL
}
