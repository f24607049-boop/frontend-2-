/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callGroqChat } from "./_lib/groq";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { text, query } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "No text provided for explanation." });
    }

    const promptContent = query
      ? `Based on these handwritten notes, answer the following student question/query: "${query}".\n\nNotes Context:\n${text}`
      : `Please explain the key academic concepts from these notes in simple, clear terms in English. Define any specialized terms.\n\nNotes Context:\n${text}`;

    const messages = [
      {
        role: "system",
        content:
          "You are an expert academic tutor. Explain clearly, use structured markdown formatting, and provide precise English definitions for complex terms where relevant to improve comprehension.",
      },
      { role: "user", content: promptContent },
    ];

    const explanation = await callGroqChat(messages);
    res.status(200).json({ explanation });
  } catch (error: any) {
    console.error("Error in /api/explain:", error);
    res.status(500).json({ error: error.message || "Failed to generate explanation" });
  }
}
