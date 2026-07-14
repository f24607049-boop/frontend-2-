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
      return res.status(400).json({ error: "No text provided for glossary." });
    }

    const messages = [
      {
        role: "system",
        content: `You are an expert educational tool. Extract key academic, technical, or specialized terms from the notes. For each term, provide its English category or context, and a simple definition in English. Return strictly a JSON array of objects with keys "term", "urdu", and "definition" (where the "urdu" key must contain the English category/context to maintain client-type compatibility). Do not include any intro, outro, or explanation. 
Example response format:
[
  {
    "term": "Photosynthesis",
    "urdu": "Plant Biology",
    "definition": "The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water."
  }
]`,
      },
      { role: "user", content: `Notes text:\n${text}` },
    ];

    const responseText = await callGroqChat(messages);
    try {
      const glossary = parseJSONFromResponse(responseText);
      res.status(200).json({ glossary });
    } catch {
      console.error("JSON parsing error for glossary. Raw response:", responseText);
      res.status(500).json({ error: "AI response was not in the correct JSON format. Please try again." });
    }
  } catch (error: any) {
    console.error("Error in /api/glossary:", error);
    res.status(500).json({ error: error.message || "Failed to generate glossary" });
  }
}
