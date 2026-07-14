import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Vite's client-side env handling automatically picks up .env.local, but plain
// dotenv (used here for the Express server) only reads ".env" by default.
// Checking both keeps GROQ_API_KEY working regardless of which filename is used.
dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to call Groq API
async function callGroqChat(messages: { role: string; content: string }[]) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured on the server.");
  }
  
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Robust JSON clean and parser helper
function parseJSONFromResponse(responseText: string) {
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

// 1. /api/explain endpoint
app.post("/api/explain", async (req, res) => {
  try {
    const { text, query } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided for explanation." });
    }

    const promptContent = query 
      ? `Based on these handwritten notes, answer the following student question/query: "${query}".\n\nNotes Context:\n${text}`
      : `Please explain the key academic concepts from these notes in simple, clear terms in English. Define any specialized terms.\n\nNotes Context:\n${text}`;

    const messages = [
      {
        role: "system",
        content: "You are an expert academic tutor. Explain clearly, use structured markdown formatting, and provide precise English definitions for complex terms where relevant to improve comprehension."
      },
      {
        role: "user",
        content: promptContent
      }
    ];

    const explanation = await callGroqChat(messages);
    res.json({ explanation });
  } catch (error: any) {
    console.error("Error in /api/explain:", error);
    res.status(500).json({ error: error.message || "Failed to generate explanation" });
  }
});

// 2. /api/glossary endpoint
app.post("/api/glossary", async (req, res) => {
  try {
    const { text } = req.body;
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
]`
      },
      {
        role: "user",
        content: `Notes text:\n${text}`
      }
    ];

    const responseText = await callGroqChat(messages);
    try {
      const glossary = parseJSONFromResponse(responseText);
      res.json({ glossary });
    } catch (parseErr) {
      console.error("JSON parsing error for glossary. Raw response:", responseText);
      res.status(500).json({ error: "AI response was not in the correct JSON format. Please try again.", raw: responseText });
    }
  } catch (error: any) {
    console.error("Error in /api/glossary:", error);
    res.status(500).json({ error: error.message || "Failed to generate glossary" });
  }
});

// 3. /api/flashcards endpoint
app.post("/api/flashcards", async (req, res) => {
  try {
    const { text } = req.body;
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
]`
      },
      {
        role: "user",
        content: `Notes text:\n${text}`
      }
    ];

    const responseText = await callGroqChat(messages);
    try {
      const flashcards = parseJSONFromResponse(responseText);
      res.json({ flashcards });
    } catch (parseErr) {
      console.error("JSON parsing error for flashcards. Raw response:", responseText);
      res.status(500).json({ error: "AI response was not in the correct JSON format. Please try again.", raw: responseText });
    }
  } catch (error: any) {
    console.error("Error in /api/flashcards:", error);
    res.status(500).json({ error: error.message || "Failed to generate flashcards" });
  }
});

// Vite server or static serving
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
