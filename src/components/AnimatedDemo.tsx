/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, FileText, ArrowRight } from "lucide-react";

export default function AnimatedDemo() {
  const [revealedLines, setRevealedLines] = useState<number>(0);
  const totalLines = 6;

  useEffect(() => {
    const interval = setInterval(() => {
      setRevealedLines((prev) => (prev >= totalLines ? 0 : prev + 1));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const handwrittenLines = [
    "12 July, 2026 - Bio Notes",
    "Topic: Photosynthesis Intro",
    "- Plants absorb CO2 from air & water from soil.",
    "- Chlorophyll absorbs sunlight to synthesize food.",
    "- Output: Glucose and Oxygen are released.",
    "Formula: 6CO2 + 6H2O + Sunlight -> C6H12O6 + 6O2"
  ];

  const typedLines = [
    {
      type: "header",
      text: "# Bio Notes: Photosynthesis Overview"
    },
    {
      type: "subheader",
      text: "## Process Overview"
    },
    {
      type: "bullet",
      text: "• Plants absorb Carbon Dioxide (CO₂) from air and water (H₂O) from soil."
    },
    {
      type: "bullet",
      text: "• **Chlorophyll** absorbs sunlight to synthesize chemical energy."
    },
    {
      type: "bullet",
      text: "• **Reaction Output:** Carbon Dioxide and Water convert to **Glucose** and **Oxygen** is released."
    },
    {
      type: "formula",
      text: "🧪 6CO₂ + 6H₂O + Sunlight ➔ C₆H₁₂O₆ + 6O₂"
    }
  ];

  return (
    <div id="interactive-demo" className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto my-12 px-4">
      {/* Left: Ruled Paper Handwritten Sample */}
      <div className="border border-ink-navy/20 rounded-xl overflow-hidden shadow-sm relative bg-paper flex flex-col">
        {/* Paper top strip */}
        <div className="h-8 bg-margin-red/10 border-b border-margin-red/20 px-4 flex items-center justify-between text-[10px] font-mono tracking-wider text-margin-red uppercase">
          <span>Student Answer Booklet (Page 1)</span>
          <span className="text-ink-navy/40">Handwritten Sample</span>
        </div>
        
        {/* Ruled lines area */}
        <div className="ruled-lines margin-rule min-h-[300px] p-6 pl-16 flex-1 text-ink-blue font-handwriting text-2xl leading-[2.5rem]">
          {handwrittenLines.map((line, idx) => (
            <div 
              key={idx} 
              className={`transition-opacity duration-500 ${
                idx <= revealedLines ? "opacity-100" : "opacity-30"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
        
        {/* Active scan overlay indicator */}
        {revealedLines < totalLines && (
          <div 
            className="absolute left-16 right-0 bg-gradient-to-b from-transparent via-marigold/10 to-transparent h-12 border-y border-marigold/30 pointer-events-none transition-all duration-1000"
            style={{ 
              top: `${40 + (revealedLines * 40)}px` 
            }}
          />
        )}
      </div>

      {/* Right: Typed Clean Organized Text */}
      <div className="border border-ink-navy/20 rounded-xl overflow-hidden shadow-sm bg-white flex flex-col justify-between p-6 relative">
        <div className="absolute top-4 right-4 bg-stamp-green/10 text-stamp-green text-[10px] px-2 py-1 rounded font-mono font-bold tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AUTO-TYPED
        </div>

        <div>
          <h3 className="text-xs font-mono tracking-wider text-ink-navy/40 uppercase mb-4 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            ScanMyNotes Output Preview
          </h3>

          <div className="space-y-4">
            {typedLines.map((line, idx) => {
              const isVisible = idx <= revealedLines;
              return (
                <div 
                  key={idx}
                  className={`transition-all duration-700 transform ${
                    isVisible 
                      ? "opacity-100 translate-y-0" 
                      : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
                >
                  {line.type === "header" && (
                    <h1 className="text-xl font-display font-bold text-ink-navy tracking-tight">{line.text}</h1>
                  )}
                  {line.type === "subheader" && (
                    <h2 className="text-sm font-display font-bold text-ink-blue/80 uppercase tracking-wide mt-2">{line.text}</h2>
                  )}
                  {line.type === "bullet" && (
                    <p className="text-sm font-sans text-ink-navy/80 leading-relaxed pl-1">{line.text}</p>
                  )}
                  {line.type === "formula" && (
                    <div className="bg-paper/50 border border-ink-navy/10 rounded px-3 py-2 font-mono text-xs text-ink-navy tracking-wide my-1">
                      {line.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sync indicator */}
        <div className="border-t border-ink-navy/10 pt-4 mt-6 flex items-center justify-between text-xs text-ink-navy/50 font-mono">
          <span>Accuracy: 99.4% (High-precision OCR)</span>
          <span class="flex items-center gap-1 text-stamp-green font-bold">
            Processed in 0.8s
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}
