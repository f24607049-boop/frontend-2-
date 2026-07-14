/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessResponse, UsageResponse, GlossaryItem, FlashcardItem } from "../types";

const getApiBaseUrl = (): string => {
  return ((import.meta as any).env?.VITE_API_BASE_URL as string) || "http://localhost:8000";
};

/**
 * Uploads a file (photo or PDF) to the OCR processing backend.
 * @param file The image or PDF file to process.
 */
export async function processNotes(file: File): Promise<ProcessResponse> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/api/process`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorMessage = errorJson.detail;
      }
    } catch {
      // Fallback if not JSON
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Fetches remaining pages count and daily limit from backend.
 */
export async function fetchUsage(): Promise<UsageResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/usage`);
  if (!response.ok) {
    throw new Error(`Failed to fetch usage limits (${response.status})`);
  }
  return response.json();
}

/**
 * Request detailed explanation of structured text from local server (Groq API).
 */
export async function requestExplain(text: string, query?: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  // FIXED: Vercel ke bajaye Render backend URL use kiya
  const response = await fetch(`${baseUrl}/api/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, query }),
  });

  if (!response.ok) {
    let msg = `Server error (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) msg = data.error;
    } catch {
      // Ignored
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.explanation;
}

/**
 * Request bilingual glossary from local server (Groq API).
 */
export async function requestGlossary(text: string): Promise<GlossaryItem[]> {
  const baseUrl = getApiBaseUrl();
  // FIXED: Vercel ke bajaye Render backend URL use kiya
  const response = await fetch(`${baseUrl}/api/glossary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    let msg = `Server error (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) msg = data.error;
    } catch {
      // Ignored
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.glossary;
}

/**
 * Request flashcards from local server (Groq API).
 */
export async function requestFlashcards(text: string): Promise<FlashcardItem[]> {
  const baseUrl = getApiBaseUrl();
  // FIXED: Vercel ke bajaye Render backend URL use kiya
  const response = await fetch(`${baseUrl}/api/flashcards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    let msg = `Server error (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) msg = data.error;
    } catch {
      // Ignored
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.flashcards;
}
