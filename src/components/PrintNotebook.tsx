/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { SavedSessionPage } from "../types";

interface PrintNotebookProps {
  sessionPages: SavedSessionPage[];
}

export default function PrintNotebook({ sessionPages }: PrintNotebookProps) {
  if (sessionPages.length === 0) return null;

  return (
    <div id="print-notebook-layout" className="hidden print:block bg-white text-black min-h-screen">
      {sessionPages.map((page, index) => (
        <div 
          key={page.id} 
          className="w-full min-h-[11in] p-12 relative flex flex-col justify-between bg-white border-b-2 border-dashed border-gray-400 print:border-none print:break-after-page"
          style={{ pageBreakAfter: "always" }}
        >
          {/* Header booklet bar */}
          <div className="border-b-2 border-gray-800 pb-3 mb-6 flex justify-between items-end font-sans">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-gray-500 font-bold">Verified Student Transcription</span>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">ScanMyNotes Digital Binder</h1>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-gray-600">Page {index + 1} of {sessionPages.length}</p>
              <p className="text-[10px] font-mono text-gray-400">Scanned: {new Date(page.scannedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Body Content of Page */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-10 gap-8 items-stretch">
            {/* Image Preview thumbnail (if exists) */}
            {page.imagePreviewUrl && (
              <div className="md:col-span-3 border border-gray-300 rounded p-2 bg-gray-50 flex flex-col justify-start">
                <span className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Source Handwritten Scan:</span>
                <img 
                  src={page.imagePreviewUrl} 
                  alt="Original Note Scan" 
                  className="max-h-64 object-contain rounded border border-gray-200 mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Structured Text on elegant ruled-paper styled backdrop */}
            <div className={`${page.imagePreviewUrl ? "md:col-span-7" : "md:col-span-10"} relative border-l-2 border-red-400 pl-8 min-h-[400px]`}>
              <span className="text-[9px] font-mono text-red-500 uppercase block mb-3 font-semibold">Transcription Text ({page.filename}):</span>
              
              <div className="prose prose-sm max-w-none text-gray-900 markdown-body">
                {/* Fallback lightweight Markdown renderer */}
                {page.structuredText.split("\n").map((line, lIdx) => {
                  const trimmed = line.trim();
                  if (trimmed.startsWith("# ")) {
                    return <h1 key={lIdx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{trimmed.substring(2)}</h1>;
                  } else if (trimmed.startsWith("## ")) {
                    return <h2 key={lIdx} className="text-base font-bold text-gray-800 mt-3 mb-1.5">{trimmed.substring(3)}</h2>;
                  } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    return <li key={lIdx} className="ml-4 list-disc text-sm text-gray-700 leading-relaxed mb-1">{trimmed.substring(2)}</li>;
                  } else if (trimmed === "") {
                    return <div key={lIdx} className="h-2"></div>;
                  } else {
                    return <p key={lIdx} className="text-sm text-gray-800 leading-relaxed mb-2">{line}</p>;
                  }
                })}
              </div>
            </div>
          </div>

          {/* Footer of Booklet containing the Rotated Green Ink Stamp */}
          <div className="border-t border-gray-200 pt-4 mt-8 flex justify-between items-center relative h-24">
            <div className="text-[9px] font-mono text-gray-400 max-w-sm">
              <p>ScanMyNotes Free Online Handwriting to Text Converter</p>
              <p className="mt-0.5">Note: This is a verified computer transcription generated for educational purposes.</p>
            </div>

            {/* Stamp Moment - Checked ink stamp rotated */}
            <div className="absolute right-4 bottom-2 select-none pointer-events-none transform -rotate-12">
              <div className="border-4 border-emerald-700 text-emerald-700 font-mono font-bold px-4 py-2 rounded text-center uppercase tracking-widest text-xs">
                <div className="text-[9px] tracking-wider leading-none">SCANMYNOTES</div>
                <div className="text-base tracking-widest leading-normal my-0.5">CHECKED</div>
                <div className="text-lg font-bold leading-none">✓</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
