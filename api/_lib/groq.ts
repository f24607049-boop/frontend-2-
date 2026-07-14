/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared Groq helper for the Vercel serverless functions (api/explain.ts,
 * api/glossary.ts, api/flashcards.ts). Files under api/_lib are NOT treated
 * as their own routes by Vercel (the underscore prefix opts them out), so
 * this can be imported safely without creating a stray endpoint.
 *
 * Logic ported unchanged from the local-dev Express server (server.ts) so
 * behavior is identical between local development and production.
 */

export async function callGroqChat(
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured on the server.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export function parseJSONFromResponse(responseText: string): unknown {
  let clean = responseText.trim();
  if (clean.startsWith("```json")) {
    clean = clean.substring(7);
  } else if (clean.startsWith("```")) {
    clean = clean.substring(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.substring(0, clean.length - 3);
  }
  return JSON.parse(clean.trim());
}
