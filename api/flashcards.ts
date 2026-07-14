/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callGroqChat, parseJSONFromResponse } from "./_lib/groq";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "No text provided for flashcards." });
    }

    const messages = [
      {
        role: "system",
        content: `You are a study guide generator. Create helpful revision flashcards from the provided note text. Each flashcard must test a core concept. Keep descriptions direct, clear, and entirely in pure English. Return strictly a JSON array of objects with keys "question" and "answer". Do not include any explanation or extra text outside the JSON.
Example response format:
[
  {
    "question": "What is the formula for kinetic energy?",
    "answer": "KE = 0.5 * m * v²"
  }
]`,
      },
      { role: "user", content: `Notes text:\n${text}` },
    ];

    const responseText = await callGroqChat(messages);
    try {
      const flashcards = parseJSONFromResponse(responseText);
      res.status(200).json({ flashcards });
    } catch {
      console.error("JSON parsing error for flashcards. Raw response:", responseText);
      res.status(500).json({ error: "AI response was not in the correct JSON format. Please try again." });
    }
  } catch (error: any) {
    console.error("Error in /api/flashcards:", error);
    res.status(500).json({ error: error.message || "Failed to generate flashcards" });
  }
}
