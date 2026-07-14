/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

/**
 * Detects if a markdown string contains a tabular structure.
 */
export function detectMarkdownTable(text: string): boolean {
  if (!text) return false;
  const lines = text.split("\n");
  let hasPipeLine = false;
  let hasSeparatorLine = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      hasPipeLine = true;
      // Detect separator line e.g., |---| or | :--- |
      if (/^\|[\s-:|]+$/g.test(trimmed) && trimmed.includes("-")) {
        hasSeparatorLine = true;
      }
    }
  }
  return hasPipeLine && hasSeparatorLine;
}

/**
 * Parses markdown table rows into a 2D array of cells.
 */
export function parseMarkdownTable(text: string): string[][] {
  if (!text) return [];
  const lines = text.split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator lines
      if (/^\|[\s-:|]+$/g.test(trimmed) && trimmed.includes("-")) {
        continue;
      }
      const cols = trimmed
        .split("|")
        .slice(1, -1) // Remove first and last empty elements from outer pipes
        .map(cell => cell.trim());
      rows.push(cols);
    }
  }
  return rows;
}

/**
 * Exports structured text containing a markdown table to an Excel (.xlsx) file.
 */
export function exportToExcel(markdownText: string, filename: string = "ScanMyNotes_Data.xlsx") {
  const tableData = parseMarkdownTable(markdownText);
  if (tableData.length === 0) {
    console.error("No valid tabular data found to export.");
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(tableData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Scanned Notes Data");
  XLSX.writeFile(workbook, filename);
}

/**
 * Exports structured text with Markdown headers to a Microsoft Word (.docx) file.
 */
export async function exportToDocx(markdownText: string, filename: string = "ScanMyNotes_Doc.docx") {
  const lines = markdownText.split("\n");
  const children: Paragraph[] = [];

  // Add a simple top header
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "ScanMyNotes - Digital Transcription",
          color: "1F2C4C",
          size: 20,
          italics: true,
        }),
      ],
      spacing: { after: 240 },
    })
  );

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace("# ", ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace("## ", ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 90 },
        })
      );
    } else if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace("### ", ""),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 70 },
        })
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      children.push(
        new Paragraph({
          children: [new TextRun(trimmed.substring(2))],
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
    } else if (trimmed !== "") {
      children.push(
        new Paragraph({
          children: [new TextRun(line)],
          spacing: { before: 100, after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports raw text to a plain .txt file.
 */
export function exportToTxt(text: string, filename: string = "ScanMyNotes_Text.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports structured text with Markdown styling to a searchable PDF file using jsPDF.
 */
export function exportToPdf(markdownText: string, filename: string = "ScanMyNotes_PDF.pdf") {
  const doc = new jsPDF();
  const lines = markdownText.split("\n");
  
  let y = 20;
  
  // Title Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(31, 44, 76); // Ink navy (#1F2C4C)
  doc.text("ScanMyNotes Transcription Booklet", 15, y);
  
  // Underline
  doc.setDrawColor(179, 58, 58); // Margin red (#B33A3A)
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, 195, y + 2);
  y += 12;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 74, 110); // Ink blue (#3C4A6E)
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    
    if (trimmed.startsWith("# ")) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(31, 44, 76);
      const text = trimmed.substring(2);
      const wrapped = doc.splitTextToSize(text, 180) as string[];
      doc.text(wrapped, 15, y);
      y += (wrapped.length * 6) + 2;
    } else if (trimmed.startsWith("## ")) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 44, 76);
      const text = trimmed.substring(3);
      const wrapped = doc.splitTextToSize(text, 180) as string[];
      doc.text(wrapped, 15, y);
      y += (wrapped.length * 5.5) + 1.5;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 74, 110);
      const text = "• " + trimmed.substring(2);
      const wrapped = doc.splitTextToSize(text, 175) as string[];
      doc.text(wrapped, 20, y);
      y += (wrapped.length * 5) + 1;
    } else if (trimmed !== "") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 74, 110);
      const wrapped = doc.splitTextToSize(line, 180) as string[];
      doc.text(wrapped, 15, y);
      y += (wrapped.length * 5) + 1;
    } else {
      y += 4; // empty line spacing
    }
  }
  
  doc.save(filename);
}

