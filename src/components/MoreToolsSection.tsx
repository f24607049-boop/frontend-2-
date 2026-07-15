/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  MessageSquare, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  Sparkles, 
  ArrowLeft, 
  HelpCircle, 
  Loader2, 
  Copy, 
  Check, 
  RotateCw,
  RefreshCw
} from "lucide-react";
import { requestExplain, requestGlossary, requestFlashcards } from "../lib/api";
import { GlossaryItem, FlashcardItem } from "../types";

interface MoreToolsProps {
  scannedText: string;
  onLoadSampleText: () => void;
}

type ToolType = "none" | "explain" | "glossary" | "flashcards";

// Helper function to render Markdown and clean LaTeX directly without dynamic imports
function parseMarkdownAndMath(text: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const parsedElements: React.ReactNode[] = [];
  let currentTable: { headers: string[]; rows: string[][] } | null = null;

  const cleanText = (rawStr: string) => {
    // 1. Remove LaTeX dollar signs and convert subscripts ($CO_2$ -> CO₂)
    let clean = rawStr.replace(/\$(.*?)\$/g, "$1");
    clean = clean.replace(/_(\d+)/g, (_, digit) => {
      const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
      return digit.split("").map((d: string) => subscripts[parseInt(d)] || d).join("");
    });

    // 2. Parse inline bold tags (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(clean)) !== null) {
      if (match.index > lastIndex) {
        parts.push(clean.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold text-ink-navy">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < clean.length) {
      parts.push(clean.substring(lastIndex));
    }

    return parts.length > 0 ? parts : clean;
  };

  const renderCurrentTable = (key: number) => {
    if (!currentTable) return null;
    const tableData = currentTable;
    currentTable = null; // reset
    return (
      <div key={`table-${key}`} className="overflow-x-auto my-4 border border-ink-navy/15 rounded-xl">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-paper border-b border-ink-navy/15 text-ink-navy font-bold">
              {tableData.headers.map((header, i) => (
                <th key={i} className="p-3">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-navy/10 bg-white text-ink-navy/80">
            {tableData.rows.map((row, i) => (
              <tr key={i} className="hover:bg-paper/5 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="p-3">{cleanText(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table parsing
    if (line.startsWith("|")) {
      const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Check if it's separator line (e.g. |---|:---|)
      if (cells.every(cell => cell.match(/^:?-+:?$/))) {
        continue; 
      }

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    }

    // If a non-table line is found but we were building a table, render it first
    if (currentTable && !line.startsWith("|")) {
      parsedElements.push(renderCurrentTable(i));
    }

    // Bullet Lists
    if (line.startsWith("* ") || line.startsWith("- ")) {
      parsedElements.push(
        <li key={i} className="list-disc list-inside ml-4 text-xs text-ink-navy/80 leading-relaxed">
          {cleanText(line.substring(2))}
        </li>
      );
      continue;
    }

    // Headings (### Title)
    if (line.startsWith("###")) {
      parsedElements.push(
        <h5 key={i} className="text-sm font-display font-bold text-ink-navy mt-4 mb-2">
          {cleanText(line.replace(/^###\s*/, ""))}
        </h5>
      );
      continue;
    }

    // Paragraph
    if (line !== "") {
      parsedElements.push(
        <p key={i} className="text-xs text-ink-navy/80 leading-relaxed py-0.5">
          {cleanText(line)}
        </p>
      );
    } else {
      parsedElements.push(<div key={i} className="h-2" />);
    }
  }

  // Final table output if it is at the end of text
  if (currentTable) {
    parsedElements.push(renderCurrentTable(lines.length));
  }

  return parsedElements;
}

export default function MoreToolsSection({ scannedText, onLoadSampleText }: MoreToolsProps) {
  const [activeTool, setActiveTool] = useState<ToolType>("none");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // States for tool outputs
  const [explanation, setExplanation] = useState<string>("");
  const [customQuery, setCustomQuery] = useState<string>("");
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  
  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);

  // General state
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyText = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectTool = async (tool: ToolType) => {
    setError(null);
    setActiveTool(tool);

    if (tool === "none") return;

    // Check if scanned text exists, if not, do not auto-trigger
    if (!scannedText) return;

    if (tool === "explain" && !explanation) {
      await generateExplanation();
    } else if (tool === "glossary" && glossary.length === 0) {
      await generateGlossary();
    } else if (tool === "flashcards" && flashcards.length === 0) {
      await generateFlashcards();
    }
  };

  const generateExplanation = async (query?: string) => {
    if (!scannedText) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await requestExplain(scannedText, query);
      setExplanation(resp);
    } catch (err: any) {
      setError(err.message || "Failed to generate explanation from Groq. Please check your GROQ_API_KEY.");
    } finally {
      setLoading(false);
    }
  };

  const generateGlossary = async () => {
    if (!scannedText) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await requestGlossary(scannedText);
      setGlossary(resp);
    } catch (err: any) {
      setError(err.message || "Failed to generate glossary. Please verify your connection.");
    } finally {
      setLoading(false);
    }
  };

  const generateFlashcards = async () => {
    if (!scannedText) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await requestFlashcards(scannedText);
      setFlashcards(resp);
      setCurrentCardIndex(0);
      setIsCardFlipped(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate study flashcards.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="more-study-tools" className="max-w-5xl mx-auto my-16 px-4">
      <div className="text-center mb-10">
        <span className="text-xs font-mono tracking-widest text-marigold uppercase">Advanced Features</span>
        <h2 className="text-3xl font-display font-bold text-ink-navy tracking-tight mt-1">
          More Learning Tools
        </h2>
        <p className="text-sm text-ink-blue/70 mt-2 max-w-lg mx-auto">
          Turn your transcribed handwritten notes into powerful study assets with our AI suite, powered by Groq.
        </p>
      </div>

      {/* Tool Teaser Cards Grid (visible when activeTool === "none") */}
      {activeTool === "none" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tile 1: AI Study Companion */}
          <button
            onClick={() => handleSelectTool("explain")}
            className="flex flex-col text-left border border-ink-navy/15 rounded-xl bg-white p-6 shadow-xs hover:shadow-md hover:border-marigold/40 group transition-all duration-300 transform hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-marigold"
          >
            <div className="w-10 h-10 rounded-lg bg-marigold/10 flex items-center justify-center text-marigold mb-5 group-hover:scale-110 transition-transform duration-300">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-ink-navy group-hover:text-marigold transition-colors duration-200">
              AI Study Companion
            </h3>
            <p className="text-xs text-ink-blue/70 mt-2 flex-grow leading-relaxed">
              Ask specific questions about tricky derivations, formulas, or bilingual content. Get friendly tutoring instantly.
            </p>
            <div className="mt-4 pt-4 border-t border-ink-navy/5 flex items-center justify-between text-xs font-mono text-ink-navy font-semibold w-full">
              <span>Open Chat</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </button>

          {/* Tile 2: Study Glossary */}
          <button
            onClick={() => handleSelectTool("glossary")}
            className="flex flex-col text-left border border-ink-navy/15 rounded-xl bg-white p-6 shadow-xs hover:shadow-md hover:border-stamp-green/40 group transition-all duration-300 transform hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-stamp-green"
          >
            <div className="w-10 h-10 rounded-lg bg-stamp-green/10 flex items-center justify-center text-stamp-green mb-5 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-ink-navy group-hover:text-stamp-green transition-colors duration-200">
              Study Glossary
            </h3>
            <p className="text-xs text-ink-blue/70 mt-2 flex-grow leading-relaxed">
              Instantly extract key academic vocabulary and auto-translate into clear, simple English definitions.
            </p>
            <div className="mt-4 pt-4 border-t border-ink-navy/5 flex items-center justify-between text-xs font-mono text-ink-navy font-semibold w-full">
              <span>Extract Terms</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </button>

          {/* Tile 3: Revision Flashcards */}
          <button
            onClick={() => handleSelectTool("flashcards")}
            className="flex flex-col text-left border border-ink-navy/15 rounded-xl bg-white p-6 shadow-xs hover:shadow-md hover:border-margin-red/30 group transition-all duration-300 transform hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-margin-red"
          >
            <div className="w-10 h-10 rounded-lg bg-margin-red/10 flex items-center justify-center text-margin-red mb-5 group-hover:scale-110 transition-transform duration-300">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-ink-navy group-hover:text-margin-red transition-colors duration-200">
              Revision Flashcards
            </h3>
            <p className="text-xs text-ink-blue/70 mt-2 flex-grow leading-relaxed">
              Auto-generate smart Q&A study cards directly from your note's main concepts to test your retention and prep for exams.
            </p>
            <div className="mt-4 pt-4 border-t border-ink-navy/5 flex items-center justify-between text-xs font-mono text-ink-navy font-semibold w-full">
              <span>Generate Cards</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
            </div>
          </button>
        </div>
      )}

      {/* Active Expanded Tool Workspace Area */}
      {activeTool !== "none" && (
        <div className="border border-ink-navy/20 rounded-xl bg-white p-6 shadow-md transition-all duration-300">
          {/* Active Workspace Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-ink-navy/10 pb-4 mb-6 gap-4">
            <button
              onClick={() => handleSelectTool("none")}
              className="flex items-center gap-2 text-xs font-mono text-ink-blue hover:text-ink-navy font-bold focus:outline-none focus:ring-1 focus:ring-ink-blue px-2 py-1 rounded border border-ink-navy/15"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to more tools
            </button>

            <div className="flex items-center gap-2">
              {activeTool === "explain" && (
                <span className="flex items-center gap-1.5 text-xs bg-marigold/10 text-marigold px-2.5 py-1 rounded-full font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI Study Companion
                </span>
              )}
              {activeTool === "glossary" && (
                <span className="flex items-center gap-1.5 text-xs bg-stamp-green/10 text-stamp-green px-2.5 py-1 rounded-full font-semibold">
                  <BookOpen className="w-3.5 h-3.5" />
                  Study Glossary
                </span>
              )}
              {activeTool === "flashcards" && (
                <span className="flex items-center gap-1.5 text-xs bg-margin-red/10 text-margin-red px-2.5 py-1 rounded-full font-semibold">
                  <Layers className="w-3.5 h-3.5" />
                  Revision Flashcards
                </span>
              )}
            </div>
          </div>

          {/* Missing Note Text State Block */}
          {!scannedText ? (
            <div className="text-center py-12 max-w-md mx-auto">
              <HelpCircle className="w-12 h-12 text-marigold mx-auto mb-4 stroke-1" />
              <h4 className="text-lg font-display font-bold text-ink-navy">No scanned text found yet</h4>
              <p className="text-xs text-ink-blue/70 mt-2 leading-relaxed">
                We need text from your handwritten notes to power our study suite. You can upload and scan your own note at the top of the page, or instantly load our premium sample bio note to test the AI.
              </p>
              <button
                onClick={onLoadSampleText}
                className="mt-5 bg-marigold hover:bg-marigold-hover text-white text-xs font-mono font-bold tracking-wider px-4 py-2.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load Sample Study Text
              </button>
            </div>
          ) : (
            <div>
              {/* Error Banner */}
              {error && (
                <div className="bg-margin-red/10 border border-margin-red/20 text-margin-red text-xs p-3 rounded-lg mb-6 flex items-start gap-2 font-mono">
                  <span className="font-bold">Error:</span>
                  <p className="flex-1">{error}</p>
                </div>
              )}

              {/* Loader */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-marigold animate-spin mb-3" />
                  <p className="text-xs text-ink-navy/60 font-mono">Generating insights with Groq LLM...</p>
                </div>
              )}

              {/* Tool 1 Layout: AI Chat Explainer */}
              {activeTool === "explain" && !loading && (
                <div className="space-y-6">
                  {explanation ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      {/* Left 2 cols: Chat History & Output */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="bg-paper/30 border border-ink-navy/10 rounded-xl p-6 min-h-[250px] font-sans text-sm text-ink-navy leading-relaxed prose">
                          <h4 className="font-display font-bold text-ink-navy mb-4 text-base border-b border-ink-navy/10 pb-2">
                            AI Tutor Explanation
                          </h4>
                          <div className="space-y-2">
                            {parseMarkdownAndMath(explanation)}
                          </div>
                        </div>

                        {/* Follow up prompt input */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (customQuery.trim()) {
                              generateExplanation(customQuery);
                            }
                          }}
                          className="flex items-stretch gap-2"
                        >
                          <input
                            type="text"
                            value={customQuery}
                            onChange={(e) => setCustomQuery(e.target.value)}
                            placeholder="Ask a follow-up question (e.g., 'What are the main outputs of this reaction?')"
                            className="flex-1 px-4 py-2.5 border border-ink-navy/15 rounded-lg text-xs font-sans focus:outline-none focus:ring-2 focus:ring-marigold"
                          />
                          <button
                            type="submit"
                            className="bg-ink-navy hover:bg-ink-blue text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors"
                          >
                            Ask AI
                          </button>
                        </form>
                      </div>

                      {/* Right 1 col: Suggestions sidebar */}
                      <div className="bg-paper/40 border border-ink-navy/10 rounded-xl p-4 space-y-3">
                        <h5 className="text-xs font-mono font-bold uppercase text-ink-blue/60 tracking-wider">
                          Suggested Questions
                        </h5>
                        <div className="space-y-2">
                          {[
                            "Summarize this in simple English for revision",
                            "Explain the main keywords clearly",
                            "Convert key facts into brief bullet points",
                            "Describe this like I am 5 years old"
                          ].map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setCustomQuery(suggestion);
                                generateExplanation(suggestion);
                              }}
                              className="w-full text-left p-2.5 rounded border border-ink-navy/5 bg-white hover:border-marigold/40 text-xs text-ink-navy hover:text-marigold transition-colors duration-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-ink-navy/10 pt-3 mt-2 flex items-center justify-between">
                          <button
                            onClick={() => handleCopyText(explanation)}
                            className="flex items-center gap-1 text-[10px] font-mono text-ink-blue hover:text-ink-navy font-bold"
                          >
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-stamp-green" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy explanation
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => generateExplanation()}
                            className="flex items-center gap-1 text-[10px] font-mono text-ink-blue hover:text-ink-navy font-bold"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-ink-blue/80 mb-4">Click below to generate a comprehensive explanation of your study notes with our custom tutoring framework.</p>
                      <button
                        onClick={() => generateExplanation()}
                        className="bg-marigold hover:bg-marigold-hover text-white text-xs font-mono font-bold px-5 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        Analyze & Explain Note
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tool 2 Layout: Study Glossary */}
              {activeTool === "glossary" && !loading && (
                <div className="space-y-6">
                  {glossary.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono text-ink-blue/60">{glossary.length} key terms extracted</span>
                        <button
                          onClick={() => generateGlossary()}
                          className="flex items-center gap-1 text-xs font-mono text-ink-blue hover:text-ink-navy font-bold"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerate Glossary
                        </button>
                      </div>

                      <div className="overflow-x-auto border border-ink-navy/15 rounded-xl">
                        <table className="w-full text-left border-collapse font-sans text-xs">
                          <thead>
                            <tr className="bg-paper border-b border-ink-navy/15 text-ink-navy font-bold">
                              <th className="p-3.5">Academic Term</th>
                              <th className="p-3.5">Context / Category</th>
                              <th className="p-3.5">Simplified Definition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-navy/10 bg-white">
                            {glossary.map((item, idx) => (
                              <tr key={idx} className="hover:bg-paper/10 transition-colors">
                                <td className="p-3.5 font-bold text-ink-navy">{item.term}</td>
                                <td className="p-3.5 text-margin-red font-semibold tracking-wide">{item.urdu}</td>
                                <td className="p-3.5 text-ink-navy/80 leading-relaxed">{item.definition}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-ink-blue/80 mb-4">Extract complex terms and key concepts into an organized vocabulary table.</p>
                      <button
                        onClick={generateGlossary}
                        className="bg-stamp-green hover:bg-stamp-green/90 text-white text-xs font-mono font-bold px-5 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Study Glossary
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tool 3 Layout: Flashcards */}
              {activeTool === "flashcards" && !loading && (
                <div className="space-y-6">
                  {flashcards.length > 0 ? (
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <div className="w-full flex items-center justify-between text-xs font-mono text-ink-blue/60 mb-4">
                        <span>Card {currentCardIndex + 1} of {flashcards.length}</span>
                        <button
                          onClick={generateFlashcards}
                          className="flex items-center gap-1 text-ink-blue hover:text-ink-navy font-bold"
                        >
                          <RotateCw className="w-3 h-3" />
                          Regenerate Cards
                        </button>
                      </div>

                      {/* Interactive Flashcard with Flip */}
                      <button
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                        className="w-full h-64 border border-ink-navy/15 rounded-2xl bg-paper/20 cursor-pointer shadow-sm relative focus:outline-none focus:ring-2 focus:ring-margin-red flex flex-col items-center justify-center p-6 text-center transition-all duration-300 transform active:scale-98 hover:shadow-md"
                      >
                        {isCardFlipped ? (
                          <div className="animate-fadeIn">
                            <span className="text-[10px] font-mono tracking-wider text-stamp-green bg-stamp-green/10 px-2 py-0.5 rounded font-bold uppercase mb-3 inline-block">
                              Answer
                            </span>
                            <div className="text-sm font-sans text-ink-navy leading-relaxed font-semibold">
                              {parseMarkdownAndMath(flashcards[currentCardIndex]?.answer || flashcards[currentCardIndex]?.back || "No Answer Available")}
                            </div>
                          </div>
                        ) : (
                          <div className="animate-fadeIn">
                            <span className="text-[10px] font-mono tracking-wider text-margin-red bg-margin-red/10 px-2 py-0.5 rounded font-bold uppercase mb-3 inline-block">
                              Question
                            </span>
                            <div className="text-base font-display font-bold text-ink-navy leading-snug">
                              {parseMarkdownAndMath(flashcards[currentCardIndex]?.question || flashcards[currentCardIndex]?.front || "No Question Available")}
                            </div>
                            <span className="text-[10px] font-mono text-ink-blue/50 absolute bottom-4 left-1/2 -translate-x-1/2">
                              Click card to flip / reveal answer
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Flashcards Navigation controls */}
                      <div className="flex items-center justify-between w-full mt-6 gap-4">
                        <button
                          disabled={currentCardIndex === 0}
                          onClick={() => {
                            setCurrentCardIndex((p) => Math.max(0, p - 1));
                            setIsCardFlipped(false);
                          }}
                          className="px-4 py-2 rounded-lg border border-ink-navy/15 text-xs font-mono font-bold text-ink-navy bg-white hover:bg-paper/20 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          Previous
                        </button>

                        <button
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className="text-xs font-mono font-bold text-margin-red hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Flip Card
                        </button>

                        <button
                          disabled={currentCardIndex === flashcards.length - 1}
                          onClick={() => {
                            setCurrentCardIndex((p) => Math.min(flashcards.length - 1, p + 1));
                            setIsCardFlipped(false);
                          }}
                          className="px-4 py-2 rounded-lg border border-ink-navy/15 text-xs font-mono font-bold text-ink-navy bg-white hover:bg-paper/20 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs text-ink-blue/80 mb-4">Auto-create customized smart flashcards directly from your handwritten notes to self-test.</p>
                      <button
                        onClick={generateFlashcards}
                        className="bg-margin-red hover:bg-margin-red/90 text-white text-xs font-mono font-bold px-5 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Revision Flashcards
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
