/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  FileText, 
  Check, 
  Trash2, 
  FileSpreadsheet, 
  Download, 
  Copy, 
  Sparkles, 
  Loader2, 
  BookOpen, 
  Plus, 
  AlertCircle,
  HelpCircle,
  FileDigit,
  Maximize2,
  Printer
} from "lucide-react";
// ReactMarkdown standard rendering
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; // Table support ke liye plugin import kiya

// NAYA IMPORT: Image Compression Library
import imageCompression from "browser-image-compression"; 

import { processNotes, fetchUsage } from "./lib/api";
import { exportToDocx, exportToExcel, exportToTxt, exportToPdf, detectMarkdownTable } from "./lib/exports";
import { SavedSessionPage, ProcessResponse } from "./types";

import AnimatedDemo from "./components/AnimatedDemo";
import MoreToolsSection from "./components/MoreToolsSection";
import PrintNotebook from "./components/PrintNotebook";

export default function App() {
  // Usage tracking state
  const [usage, setUsage] = useState<{ remaining_pages_today: number; daily_limit: number } | null>(null);

  // File & Upload States
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);

  // Conversion States
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Scanning note layout..."); // NAYA STATE: Dynamic messages ke liye
  const [conversionResult, setConversionResult] = useState<ProcessResponse | null>(null);
  const [convertError, setConvertError] = useState<React.ReactNode | null>(null); 

  // Session state (multi-page scan booklet)
  const [sessionPages, setSessionPages] = useState<SavedSessionPage[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  // Print Guidelines Modal State
  const [isPrintGuideOpen, setIsPrintGuideOpen] = useState<boolean>(false);

  // Download Dialog Modal State
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [downloadText, setDownloadText] = useState<string>("");
  const [downloadSelectedFormat, setDownloadSelectedFormat] = useState<"docx" | "pdf" | "txt">("docx");
  const [downloadFilenameInput, setDownloadFilenameInput] = useState<string>("document");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load usage on mount
  useEffect(() => {
    fetchUsage()
      .then((data) => setUsage(data))
      .catch((err) => {
        console.warn("Usage fetch failed (this is handled silently):", err);
      });

    // Check if session exists in localStorage
    try {
      const saved = localStorage.getItem("scanmynotes_session_pages");
      if (saved) {
        setSessionPages(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to restore session from storage:", e);
    }
  }, []);

  // Save session to localStorage when it updates
  useEffect(() => {
    try {
      localStorage.setItem("scanmynotes_session_pages", JSON.stringify(sessionPages));
    } catch (e) {
      console.error("Failed to save session to storage:", e);
    }
  }, [sessionPages]);

  // Clean up Object URL to prevent leaks
  const cleanupFilePreview = () => {
    if (filePreview && !filePreview.startsWith("data:")) {
      URL.revokeObjectURL(filePreview);
    }
    setFilePreview(null);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleSelectedFile = (selectedFile: File) => {
    // Client-side validations
    if (selectedFile.size > 15 * 1024 * 1024) {
      setConvertError(
        <div className="space-y-1">
          <p className="font-bold">File Size Exceeded (Max 15MB)</p>
          <p>Aapki file ka size bohot zyada hai. Baraye meherbani humare standard parameters ke mutabiq 15MB se choti file upload karein.</p>
        </div>
      );
      return;
    }

    const type = selectedFile.type;
    const isImage = type.startsWith("image/");
    const isPDF = type === "application/pdf";

    // Graceful formatting error handling
    if (!isImage && !isPDF) {
      setConvertError(
        <div className="space-y-2 text-left">
          <p className="font-bold text-sm text-margin-red">Format Not Supported / Ghair-Mutabiq Format</p>
          <p className="text-xs text-ink-blue/80 leading-relaxed">
            Aapki upload karda file ka format humare system se match nahi karta. Humare standards ke mutabiq sirf darj-zail formats hi accept kiye jaate hain:
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px] text-ink-navy">
            <span className="bg-white/50 border border-ink-navy/10 px-2 py-1.5 rounded flex items-center gap-1.5">
              📸 PNG Images
            </span>
            <span className="bg-white/50 border border-ink-navy/10 px-2 py-1.5 rounded flex items-center gap-1.5">
              🖼️ JPG / JPEG
            </span>
            <span className="bg-white/50 border border-ink-navy/10 px-2 py-1.5 rounded flex items-center gap-1.5 col-span-2">
              📄 PDF Documents (Max 15MB)
            </span>
          </div>
          <p className="text-[11px] text-ink-blue/60 italic mt-1">
            Meherbani farma kar in formats ke mutabiq file dobara upload karein takay OCR system ise sahi se scan kar sake.
          </p>
        </div>
      );
      return;
    }

    // Reset old conversion states on successful upload
    setConvertError(null);
    setConversionResult(null);
    cleanupFilePreview();

    setFile(selectedFile);
    setIsPdf(isPDF);

    if (isImage) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleOpenDownload = (text: string, originalFilename?: string) => {
    setDownloadText(text);
    let baseName = "document";
    if (originalFilename) {
      baseName = originalFilename.replace(/\.[^/.]+$/, "");
    }
    baseName = baseName.replace(/[\s_]+/g, "_");
    setDownloadFilenameInput(baseName);
    setDownloadSelectedFormat("docx");
    setIsDownloadOpen(true);
  };

  const handleExecuteDownload = async () => {
    if (!downloadText) return;
    
    const rawFilename = downloadFilenameInput.trim() || "document";
    
    if (downloadSelectedFormat === "docx") {
      await exportToDocx(downloadText, `${rawFilename}.docx`);
    } else if (downloadSelectedFormat === "pdf") {
      exportToPdf(downloadText, `${rawFilename}.pdf`);
    } else if (downloadSelectedFormat === "txt") {
      exportToTxt(downloadText, `${rawFilename}.txt`);
    }
    
    setIsDownloadOpen(false);
  };

  const handleCancelFile = () => {
    setFile(null);
    cleanupFilePreview();
    setConvertError(null);
    setConversionResult(null);
  };

  // Convert execution (UPDATED WITH COMPRESSION LOGIC)
  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setConvertError(null);
    setConversionResult(null);
    setLoadingMessage("Scanning note layout..."); // Reset message

    try {
      let fileToProcess = file;

      // PROGRESS 1: Image Compression
      if (file.type.startsWith("image/")) {
        setLoadingMessage("⏳ Compressing image to make upload faster...");
        
        const options = {
          maxSizeMB: 0.5,           // 500KB tak compress karega
          maxWidthOrHeight: 1024,   // AI ke liye perfect size
          useWebWorker: true        // Browser hang nahi hoga
        };

        fileToProcess = await imageCompression(file, options);
      }

      // PROGRESS 2: Upload & AI Processing
      setLoadingMessage("🧠 AI is extracting text & structuring notes (Please wait 10-20s)...");

      const resp = await processNotes(fileToProcess);
      
      if (!resp || (!resp.structured_text && !resp.raw_combined_text)) {
        throw new Error("No text found");
      }
      
      setConversionResult(resp);
      
      const updatedUsage = await fetchUsage().catch(() => null);
      if (updatedUsage) setUsage(updatedUsage);
    } catch (err: any) {
      setConvertError(
        <div className="space-y-1.5 text-left">
          <p className="font-bold text-sm">We couldn't read your notes!</p>
          <p className="text-xs leading-relaxed text-margin-red/90">
            It looks like we couldn't find or scan any written text in this file. Please make sure that:
          </p>
          <ul className="list-disc list-inside text-xs space-y-1 mt-1 text-margin-red/80">
            <li>The handwriting or typed text is clear and easy to read.</li>
            <li>There is enough light on the page and the image isn't blurry.</li>
            <li>You are uploading an image or PDF containing actual text, not a blank page.</li>
          </ul>
          <p className="text-[11px] italic mt-2 text-margin-red/70">Please take a clearer picture and try uploading again!</p>
        </div>
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleAddToSession = () => {
    if (!conversionResult) return;

    const newPage: SavedSessionPage = {
      id: crypto.randomUUID(),
      filename: file?.name || conversionResult.filename || "ScannedPage.jpg",
      scannedAt: new Date().toISOString(),
      rawText: conversionResult.raw_combined_text,
      structuredText: conversionResult.structured_text,
      imagePreviewUrl: filePreview || undefined,
    };

    setSessionPages((prev) => [...prev, newPage]);
    setFile(null);
    setConversionResult(null);
  };

  const handleClearSession = () => {
    if (window.confirm("Are you sure you want to clear your current multi-page scanning session?")) {
      sessionPages.forEach((p) => {
        if (p.imagePreviewUrl && !p.imagePreviewUrl.startsWith("data:")) {
          URL.revokeObjectURL(p.imagePreviewUrl);
        }
      });
      setSessionPages([]);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintSession = () => {
    setIsPrintGuideOpen(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const hasTable = conversionResult && detectMarkdownTable(conversionResult.structured_text);

  const preprocessMarkdown = (text: string) => {
    if (!text) return "";
    let processed = text;
    processed = processed.replace(/\\n/g, "\n");
    processed = processed.replace(/(\n\|[^\n]+\|\r?\n\|:?-+:?\|)/g, "\n\n$1");
    return processed;
  };

  const getActiveTextForStudyTools = () => {
    if (conversionResult && conversionResult.structured_text) {
      return conversionResult.structured_text;
    }
    if (sessionPages.length > 0 && sessionPages[sessionPages.length - 1].structuredText) {
      return sessionPages[sessionPages.length - 1].structuredText;
    }
    return "";
  };

  return (
    <>
      <div id="root-app-layout" className="min-h-screen flex flex-col justify-between font-sans">
        
        {/* Navigation / Header */}
        <header className="border-b border-ink-navy/15 bg-white py-4 px-6 shadow-xs sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" aria-hidden="true">📝</span>
              <div>
                <span className="text-xl font-display font-extrabold text-ink-navy tracking-tight">ScanMyNotes</span>
                <span className="text-[9px] font-mono bg-marigold/10 text-marigold px-1.5 py-0.5 rounded ml-2 font-bold uppercase tracking-wider">BETA</span>
              </div>
            </div>

            <nav className="flex items-center gap-6">
              <a href="#interactive-demo" className="text-xs font-mono font-bold text-ink-blue hover:text-ink-navy transition-colors">How it works</a>
              <a href="#more-study-tools" className="text-xs font-mono font-bold text-ink-blue hover:text-ink-navy transition-colors">Study Tools</a>
              
              {usage && (
                <span className="text-[10px] font-mono bg-paper border border-ink-navy/10 text-ink-blue px-2.5 py-1 rounded-full font-semibold">
                  Today: {usage.remaining_pages_today} / {usage.daily_limit} Scans Left
                </span>
              )}
            </nav>
          </div>
        </header>

        {/* Hero Section & Core App */}
        <main className="flex-grow py-12 px-4 bg-paper/30">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center mb-10">
              <span className="text-xs font-mono tracking-widest text-margin-red uppercase font-semibold">Free Handwriting-to-Text OCR</span>
              <h1 className="text-4xl md:text-5xl font-display font-extrabold text-ink-navy tracking-tight mt-2 leading-tight">
                Get Clean, Typed Text From Your Handwritten Notes
              </h1>
              <p className="text-sm text-ink-blue/70 mt-3 max-w-xl mx-auto leading-relaxed">
                Scan your class pages instantly. Fully optimized for <strong>handwritten notes</strong>, <strong>lecture transcripts</strong>, and <strong>cursive styles</strong>, including complex page structures.
              </p>
            </div>

            {/* Core Upload Area */}
            <div className="bg-white border border-ink-navy/20 rounded-2xl shadow-sm p-6 md:p-8 mb-8 relative">
              
              {/* Red Left Margin Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-margin-red/20 pointer-events-none" />

              {/* Upload Drop Zone Area */}
              {!file && !conversionResult && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[250px] ${
                    dragActive 
                      ? "border-marigold bg-marigold/5 scale-99" 
                      : "border-ink-navy/20 bg-paper/10 hover:border-marigold/50 hover:bg-paper/20"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept="image/png, image/jpeg, image/jpg, application/pdf"
                    className="hidden"
                  />
                  
                  <div className="w-14 h-14 rounded-full bg-marigold/10 flex items-center justify-center text-marigold mb-4 shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-display font-bold text-ink-navy">
                    Drag & drop your handwritten note, or click to browse
                  </h3>
                  
                  <p className="text-xs text-ink-blue/60 mt-2 max-w-md leading-relaxed">
                    Supports high-resolution PNG, JPG, or PDF booklets up to 15MB.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3 text-[10px] font-mono uppercase tracking-wider">
                    <span className="bg-white px-2 py-1 rounded border border-ink-navy/10 text-ink-blue">📝 English Prints</span>
                    <span className="bg-white px-2 py-1 rounded border border-ink-navy/10 text-ink-blue">✍️ Cursive Script</span>
                    <span className="bg-white px-2 py-1 rounded border border-ink-navy/10 text-ink-blue">📖 Lecture Notes</span>
                  </div>
                </div>
              )}

              {/* Step 1: Preview Screen */}
              {file && !conversionResult && !isConverting && (
                <div className="border border-ink-navy/10 rounded-xl p-6 bg-paper/10 flex flex-col items-center">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-blue/50 mb-4">
                    Step 1: Preview Note Scan
                  </h3>

                  <div className="max-w-xs w-full bg-white rounded-lg border border-ink-navy/15 p-4 shadow-xs flex flex-col items-center mb-6">
                    {isPdf ? (
                      <div className="py-6 flex flex-col items-center">
                        <FileText className="w-16 h-16 text-margin-red stroke-1" />
                        <span className="text-xs font-mono text-gray-500 mt-2">PDF Document</span>
                      </div>
                    ) : (
                      filePreview && (
                        <img
                          src={filePreview}
                          alt="Scanned Note Preview"
                          className="max-h-48 object-contain rounded border border-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      )
                    )}
                    <span className="text-xs font-sans font-bold text-ink-navy mt-3 truncate max-w-full block">
                      {file.name}
                    </span>
                    <span className="text-[10px] font-mono text-ink-blue/60 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  <div className="flex items-center gap-4 w-full max-w-sm">
                    <button
                      onClick={handleCancelFile}
                      className="flex-1 border border-ink-navy/20 hover:border-ink-navy text-ink-blue px-4 py-2.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors text-center"
                    >
                      Change File
                    </button>
                    
                    <button
                      onClick={handleConvert}
                      className="flex-1 bg-marigold hover:bg-marigold-hover text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider cursor-pointer transition-colors text-center shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      Convert to Text
                    </button>
                  </div>
                </div>
              )}

              {/* Laser Animation Screen (UPDATED FOR DYNAMIC MESSAGES) */}
              {isConverting && (
                <div className="border border-ink-navy/10 rounded-xl py-12 px-6 bg-paper/20 flex flex-col items-center justify-center relative overflow-hidden min-h-[250px]">
                  <div className="absolute left-0 right-0 h-1 bg-stamp-green shadow-[0_0_15px_#3F6B4A] animate-pulse" style={{ animationDuration: "1.5s", top: "50%" }} />
                  <Loader2 className="w-10 h-10 text-marigold animate-spin mb-4" />
                  <h3 className="text-lg font-display font-bold text-ink-navy animate-pulse text-center px-4">
                    {loadingMessage}
                  </h3>
                  <p className="text-xs text-ink-blue/70 mt-2 text-center max-w-xs font-mono">
                    Analyzing bilingual syntax, handwritten scripts and converting to clean structured Markdown...
                  </p>
                </div>
              )}

              {/* Dynamic Error box */}
              {convertError && (
                <div className="bg-margin-red/10 border border-margin-red/20 text-margin-red text-xs p-5 rounded-xl mt-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-margin-red" />
                  <div className="flex-grow text-left">
                    {convertError}
                    <button
                      onClick={handleCancelFile}
                      className="text-[10px] font-mono font-bold underline text-margin-red hover:text-red-800 block mt-3 uppercase tracking-wider"
                    >
                      Try uploading correct file / File dobara upload karein
                    </button>
                  </div>
                </div>
              )}

              {/* Conversion Results Area */}
              {conversionResult && !isConverting && (
                <div className="border border-ink-navy/15 rounded-xl bg-white overflow-hidden shadow-xs relative">
                  <div className="bg-paper px-6 py-3 border-b border-ink-navy/15 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-stamp-green animate-ping" />
                      <span className="text-xs font-mono font-bold text-stamp-green uppercase tracking-wide">
                        Scan Successful (Checked ✓)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyText(conversionResult.structured_text || "")}
                        className="p-1.5 rounded hover:bg-ink-navy/5 text-ink-blue hover:text-ink-navy transition-colors focus:outline-none"
                        title="Copy raw text to clipboard"
                        aria-label="Copy raw text"
                      >
                        {copied ? <Check className="w-4 h-4 text-stamp-green" /> : <Copy className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={handleCancelFile}
                        className="text-xs font-mono text-margin-red hover:underline ml-2"
                      >
                        Scan New Note
                      </button>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 pl-12 md:pl-16 relative min-h-[300px]">
                    <div className="absolute left-8 md:left-10 top-0 bottom-0 w-0.5 bg-margin-red/20 pointer-events-none" />

                    <div className="absolute right-6 bottom-6 select-none pointer-events-none ink-stamp">
                      <div className="border-4 border-emerald-700 text-emerald-700 font-mono font-bold px-3 py-1.5 rounded text-center uppercase tracking-widest text-[10px]">
                        <div>SCANMYNOTES</div>
                        <div className="text-xs tracking-wider leading-none my-0.5 font-extrabold">CHECKED</div>
                        <div className="text-base font-bold leading-none">✓</div>
                      </div>
                    </div>

                    <div className="text-ink-navy font-sans leading-relaxed text-sm space-y-4 prose max-w-none text-left">
                      {conversionResult.structured_text || conversionResult.raw_combined_text ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: (props) => <h1 className="text-2xl font-extrabold text-ink-navy mb-4 mt-2 block" {...props} />,
                            h2: (props) => <h2 className="text-xl font-bold text-ink-navy border-b border-ink-navy/10 pb-1 mb-3 mt-4 block" {...props} />,
                            h3: (props) => <h3 className="text-lg font-bold text-ink-navy mb-2 mt-3 block" {...props} />,
                            p: (props) => <p className="text-sm text-ink-navy/90 leading-relaxed mb-3 block" {...props} />,
                            strong: (props) => <strong className="font-bold text-ink-navy" {...props} />,
                            em: (props) => <em className="italic" {...props} />,
                            ul: (props) => <ul className="list-disc list-inside pl-4 space-y-1 mb-4 block" {...props} />,
                            ol: (props) => <ol className="list-decimal list-inside pl-4 space-y-1 mb-4 block" {...props} />,
                            li: (props) => <li className="text-sm text-ink-navy/95 list-item" {...props} />,
                            table: (props) => (
                              <div className="overflow-x-auto my-6 border border-ink-navy/10 rounded-lg">
                                <table className="min-w-full divide-y divide-ink-navy/10" {...props} />
                              </div>
                            ),
                            thead: (props) => <thead className="bg-paper" {...props} />,
                            tbody: (props) => <tbody className="divide-y divide-ink-navy/10 bg-white" {...props} />,
                            tr: (props) => <tr className="hover:bg-paper/30 transition-colors" {...props} />,
                            th: (props) => <th className="px-4 py-2.5 text-left text-xs font-mono font-bold text-ink-navy uppercase tracking-wider border-r border-ink-navy/10 last:border-0" {...props} />,
                            td: (props) => <td className="px-4 py-2 text-sm text-ink-navy/85 border-r border-ink-navy/10 last:border-0" {...props} />,
                          }}
                        >
                          {preprocessMarkdown(conversionResult.structured_text || conversionResult.raw_combined_text || "")}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-gray-400 italic">No text extracted from this image. Please make sure the handwriting is clear.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-paper/30 border-t border-ink-navy/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-ink-blue/60 mr-2">Export:</span>
                      
                      <button
                        onClick={() => handleOpenDownload(conversionResult.structured_text || conversionResult.raw_combined_text || "", conversionResult.filename || "Note")}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Document...
                      </button>

                      {hasTable && (
                        <button
                          onClick={() => exportToExcel(conversionResult.structured_text || conversionResult.raw_combined_text || "", `ScanMyNotes_${conversionResult.filename || "Note"}.xlsx`)}
                          className="bg-white border border-ink-navy/15 hover:border-emerald-700 text-emerald-800 text-xs font-mono font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          Excel (.XLSX)
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleAddToSession}
                      className="bg-ink-navy hover:bg-ink-blue text-white text-xs font-mono font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Page Session
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Binder Multi-Page Session Container */}
            {sessionPages.length > 0 && (
              <div className="bg-white border border-ink-navy/15 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stamp-green/10 flex items-center justify-center text-stamp-green">
                    <FileDigit className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono font-bold text-ink-navy">
                      Active Multi-Page Binder Session
                    </h4>
                    <p className="text-[10px] text-ink-blue/70">
                      Accumulated <strong>{sessionPages.length} {sessionPages.length === 1 ? "page" : "pages"}</strong> this session to print/save.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearSession}
                    className="border border-ink-navy/15 text-ink-blue hover:text-margin-red hover:border-margin-red px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Session
                  </button>

                  <button
                    onClick={() => setIsPrintGuideOpen(true)}
                    className="bg-stamp-green hover:bg-stamp-green/90 text-white px-4 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Finish & Save PDF Binder
                  </button>
                </div>
              </div>
            )}

            {/* Typing Animation Showcase */}
            <div className="bg-white border border-ink-navy/10 rounded-2xl py-6 mb-12 shadow-2xs">
              <div className="text-center px-4 max-w-lg mx-auto mb-2">
                <h3 className="text-lg font-display font-extrabold text-ink-navy">See Conversion In Action</h3>
                <p className="text-xs text-ink-blue/70 mt-1">Watch how physical handwritten script and cursive annotations resolve automatically.</p>
              </div>
              <AnimatedDemo />
            </div>

            {/* Advanced Tools Suite */}
            <MoreToolsSection 
              scannedText={getActiveTextForStudyTools()} 
              onLoadSampleText={() => {}} 
            />

            {/* FAQ Area */}
            <section id="faq-section" className="border-t border-ink-navy/10 pt-12 mt-16 max-w-3xl mx-auto">
              <h2 className="text-2xl font-display font-extrabold text-ink-navy text-center tracking-tight mb-8">
                Frequently Asked Questions
              </h2>
              
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-ink-navy/10 shadow-3xs">
                  <h3 className="font-display font-bold text-ink-navy text-sm">How does the handwriting conversion work?</h3>
                  <p className="text-xs text-ink-blue/70 mt-2 leading-relaxed">
                    ScanMyNotes is uniquely tailored with smart OCR layout logic. It analyzes physical page structures, margin spaces, lists, and headings to isolate and render cursive handwriting and scribbled text into digital Markdown formats.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-ink-navy/10 shadow-3xs">
                  <h3 className="font-display font-bold text-ink-navy text-sm">How do I generate a Word document or spreadsheet?</h3>
                  <p className="text-xs text-ink-blue/70 mt-2 leading-relaxed">
                    Once notes are scanned, export cards appear dynamically. You can instantly download a structured `.docx` with headings, bullet points, or list formatting. If we detect tabular grid layouts inside the transcribed output, a custom `.xlsx` Microsoft Excel option launches automatically.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-ink-navy/10 shadow-3xs">
                  <h3 className="font-display font-bold text-ink-navy text-sm">Is my uploaded notes data private?</h3>
                  <p className="text-xs text-ink-blue/70 mt-2 leading-relaxed">
                    Yes. All files are securely processed server-side in memory for transcription and are never stored or logged permanently on our servers. Local cookies/cache are only used to synchronize your active page-by-page binder sessions.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-ink-navy/15 bg-white py-8 px-6 text-center text-xs text-ink-blue/60 font-mono">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 ScanMyNotes Team. Built for students and educators.</p>
            <div className="flex items-center gap-4">
              <span>Verified High-Precision OCR</span>
              <span>•</span>
              <span>100% Free & Secure</span>
            </div>
          </div>
        </footer>

        {/* PDF Guide Modal */}
        {isPrintGuideOpen && (
          <div className="fixed inset-0 bg-ink-navy/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-ink-navy/20 rounded-2xl p-6 max-w-md w-full shadow-lg relative animate-fadeIn">
              <h3 className="text-lg font-display font-bold text-ink-navy flex items-center gap-2">
                <Printer className="w-5 h-5 text-stamp-green" />
                Preparing Your Digital Binder
              </h3>
              
              <p className="text-xs text-ink-blue/70 mt-3 leading-relaxed">
                You are about to export a unified PDF booklet of all <strong>{sessionPages.length} scanned pages</strong> accumulated in this binder.
              </p>

              <div className="bg-paper p-4 rounded-xl my-4 text-xs font-mono space-y-2 text-ink-navy">
                <p className="font-bold border-b border-ink-navy/15 pb-1">Recommended Print Settings:</p>
                <div className="space-y-1 pl-2">
                  <p>1. <strong>Destination:</strong> Select "Save as PDF".</p>
                  <p>2. <strong>Pages:</strong> Select "All".</p>
                  <p>3. <strong>Background Graphics:</strong> Check/Enable this box in "More settings" to render the notebook lined rules & stamps.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsPrintGuideOpen(false)}
                  className="px-4 py-2 text-xs font-mono font-bold border border-ink-navy/15 text-ink-blue hover:text-ink-navy rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handlePrintSession}
                  className="bg-stamp-green hover:bg-stamp-green/90 text-white px-5 py-2 text-xs font-mono font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Open Print Dialogue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download Dialog Modal */}
        {isDownloadOpen && (
          <div className="fixed inset-0 bg-ink-navy/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-ink-navy/15 rounded-2xl p-8 max-w-lg w-full shadow-lg relative animate-fadeIn">
              
              <h3 className="text-2xl font-display font-extrabold text-ink-navy text-center mb-6 tracking-tight">
                Which format do you want to download?
              </h3>
              
              <div className="space-y-3 mb-6">
                {/* Word Document */}
                <div 
                  onClick={() => setDownloadSelectedFormat("docx")}
                  className={`group cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all duration-200 ${
                    downloadSelectedFormat === "docx" 
                      ? "border-indigo-600 bg-indigo-50/10 shadow-xs" 
                      : "border-gray-200 bg-white hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        downloadSelectedFormat === "docx" ? "border-indigo-600" : "border-gray-300"
                      }`}>
                        {downloadSelectedFormat === "docx" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-ink-navy">Word document</h4>
                      <p className="text-xs text-ink-blue/70">Ready for editing and formatting.</p>
                    </div>
                  </div>
                  
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>

                {/* PDF */}
                <div 
                  onClick={() => setDownloadSelectedFormat("pdf")}
                  className={`group cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all duration-200 ${
                    downloadSelectedFormat === "pdf" 
                      ? "border-indigo-600 bg-indigo-50/10 shadow-xs" 
                      : "border-gray-200 bg-white hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        downloadSelectedFormat === "pdf" ? "border-indigo-600" : "border-gray-300"
                      }`}>
                        {downloadSelectedFormat === "pdf" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-ink-navy">Searchable PDF</h4>
                      <p className="text-xs text-ink-blue/70">Easily search and select text in the file.</p>
                    </div>
                  </div>
                  
                  <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                    <Download className="w-4 h-4 text-red-500" />
                  </div>
                </div>

                {/* Plain Text */}
                <div 
                  onClick={() => setDownloadSelectedFormat("txt")}
                  className={`group cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all duration-200 ${
                    downloadSelectedFormat === "txt" 
                      ? "border-indigo-600 bg-indigo-50/10 shadow-xs" 
                      : "border-gray-200 bg-white hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        downloadSelectedFormat === "txt" ? "border-indigo-600" : "border-gray-300"
                      }`}>
                        {downloadSelectedFormat === "txt" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-ink-navy">Plain text</h4>
                      <p className="text-xs text-ink-blue/70">Just text, no formatting.</p>
                    </div>
                  </div>
                  
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileText className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
              </div>
              
              <div className="mb-6 text-left">
                <label className="text-xs font-mono font-bold text-ink-blue/70 uppercase tracking-wide block mb-1.5">
                  File name
                </label>
                <input 
                  type="text" 
                  value={downloadFilenameInput}
                  onChange={(e) => setDownloadFilenameInput(e.target.value)}
                  placeholder="document"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-ink-navy bg-paper/10"
                />
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setIsDownloadOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:border-gray-300 text-ink-blue hover:text-ink-navy font-bold rounded-xl transition-all cursor-pointer text-center text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleExecuteDownload}
                  className="flex-1 py-3 bg-[#c92a42] hover:bg-[#b22037] text-white font-bold rounded-xl transition-all cursor-pointer text-center text-sm font-mono shadow-md flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              
            </div>
          </div>
        )}

      </div>

      {/* Hidden Booklet Component */}
      <PrintNotebook sessionPages={sessionPages} />
    </>
  );
}
