import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  block?: boolean;
}

// Helper to recursively extract a balanced LaTeX brace group and replace with HTML tags
function replaceMacro(str: string, macroName: string, tagName: string, className?: string): string {
  const macroStr = `\\${macroName}`;
  let index = str.indexOf(macroStr);
  while (index !== -1) {
    const braceStart = index + macroStr.length;
    if (braceStart < str.length && str[braceStart] === "{") {
      let braceCount = 1;
      let j = braceStart + 1;
      while (j < str.length && braceCount > 0) {
        if (str[j] === "{" && str[j - 1] !== "\\") {
          braceCount++;
        } else if (str[j] === "}" && str[j - 1] !== "\\") {
          braceCount--;
        }
        j++;
      }
      if (braceCount === 0) {
        const contentStr = str.substring(braceStart + 1, j - 1);
        const classAttr = className ? ` class="${className}"` : "";
        const html = `<${tagName}${classAttr}>${contentStr}</${tagName}>`;
        str = str.substring(0, index) + html + str.substring(j);
        index = str.indexOf(macroStr); // Search for next occurrence
        continue;
      }
    }
    index = str.indexOf(macroStr, index + 1);
  }
  return str;
}

// Helper to beautifully parse LaTeX list items with balanced extraction
function formatList(content: string, listType: "ol" | "ul"): string {
  const parts = content.split(/\\item\b/g);
  let html = "";

  // parts[0] is anything written before the first \item (often whitespace)
  if (parts[0].trim()) {
    html += `<div class="mb-1 text-slate-700 font-sans">${parts[0].trim()}</div>`;
  }

  for (let i = 1; i < parts.length; i++) {
    let itemContent = parts[i];
    let customLabel = "";

    // Check for explicit custom item labels like \item[a)] or \item[(1)]
    if (itemContent.trim().startsWith("[")) {
      const trimmed = itemContent.trim();
      const closeBracketIdx = trimmed.indexOf("]");
      if (closeBracketIdx !== -1) {
        customLabel = trimmed.substring(1, closeBracketIdx).trim();
        itemContent = trimmed.substring(closeBracketIdx + 1);
      }
    }

    if (customLabel) {
      html += `<li class="list-none flex items-start gap-2 my-1">
        <span class="font-bold text-slate-600 shrink-0 select-none">${customLabel}</span>
        <span class="flex-1">${itemContent.trim()}</span>
      </li>`;
    } else {
      html += `<li class="my-1.5 leading-relaxed text-slate-700">${itemContent.trim()}</li>`;
    }
  }

  const listClass = listType === "ol" 
    ? "list-decimal pl-6 space-y-1 my-2" 
    : "list-disc pl-6 space-y-1 my-2";
    
  return `<${listType} class="${listClass}">${html}</${listType}>`;
}

// Preprocessor function to parse LaTeX layout commands and environments before mapping math blocks
function preprocessLaTeX(text: string): string {
  if (!text) return "";

  let current = text;

  // Clean document structural tags that aren't body text
  current = current.replace(/\\documentclass\{[^]*?\}/gi, "");
  current = current.replace(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]*\}/gi, "");
  current = current.replace(/\\begin\{document\}/gi, "");
  current = current.replace(/\\end\{document\}/gi, "");
  current = current.replace(/\\begin\{ex\}/gi, "");
  current = current.replace(/\\end\{ex\}/gi, "");
  current = current.replace(/\\begin\{cau\}/gi, "");
  current = current.replace(/\\end\{cau\}/gi, "");
  current = current.replace(/\\begin\{question\}/gi, "");
  current = current.replace(/\\end\{question\}/gi, "");

  // 1. Convert standard parallel lines typo \parrell -> \parallel
  current = current.replace(/\\parrell\b/gi, "\\parallel");

  // 2. Parse \heva (systems of equations) with balanced braces recursively
  let hevaIndex = current.indexOf("\\heva");
  while (hevaIndex !== -1) {
    const braceStart = hevaIndex + 5; // length of \heva
    let startIdx = braceStart;
    while (startIdx < current.length && (current[startIdx] === " " || current[startIdx] === "\t" || current[startIdx] === "\n")) {
      startIdx++;
    }
    if (startIdx < current.length && current[startIdx] === "{") {
      let count = 1;
      let j = startIdx + 1;
      while (j < current.length && count > 0) {
        if (current[j] === "{" && current[j-1] !== "\\") {
          count++;
        } else if (current[j] === "}" && current[j-1] !== "\\") {
          count--;
        }
        j++;
      }
      if (count === 0) {
        const hevaContent = current.substring(startIdx + 1, j - 1);
        const latexReplacement = `\\left\\{\\begin{aligned} ${hevaContent} \\end{aligned}\\right.`;
        current = current.substring(0, hevaIndex) + latexReplacement + current.substring(j);
        hevaIndex = current.indexOf("\\heva");
        continue;
      }
    }
    hevaIndex = current.indexOf("\\heva", hevaIndex + 1);
  }

  // 2b. Parse \hoac (alternatives / solutions list) with balanced braces recursively
  let hoacIndex = current.indexOf("\\hoac");
  while (hoacIndex !== -1) {
    const braceStart = hoacIndex + 5; // length of \hoac
    let startIdx = braceStart;
    while (startIdx < current.length && (current[startIdx] === " " || current[startIdx] === "\t" || current[startIdx] === "\n")) {
      startIdx++;
    }
    if (startIdx < current.length && current[startIdx] === "{") {
      let count = 1;
      let j = startIdx + 1;
      while (j < current.length && count > 0) {
        if (current[j] === "{" && current[j-1] !== "\\") {
          count++;
        } else if (current[j] === "}" && current[j-1] !== "\\") {
          count--;
        }
        j++;
      }
      if (count === 0) {
        const hoacContent = current.substring(startIdx + 1, j - 1);
        const latexReplacement = `\\left[\\begin{aligned} ${hoacContent} \\end{aligned}\\right.`;
        current = current.substring(0, hoacIndex) + latexReplacement + current.substring(j);
        hoacIndex = current.indexOf("\\hoac");
        continue;
      }
    }
    hoacIndex = current.indexOf("\\hoac", hoacIndex + 1);
  }

  // 3. Convert \begin{tabular} ... \end{tabular} to \begin{array} and wrap in display math $$ if not already inside math delimiters
  const tabularRegex = /\\begin\{tabular\}([^]*?)\\end\{tabular\}/gi;
  current = current.replace(tabularRegex, (match, inner) => {
    let arrayContent = match;
    arrayContent = arrayContent.replace(/\\begin\{tabular\}/gi, "\\begin{array}");
    arrayContent = arrayContent.replace(/\\end\{tabular\}/gi, "\\end{array}");
    return `$$\n${arrayContent}\n$$`;
  });

  // Handle nested layout/text environments (enumerate, itemize, center, itemchoice)
  let lastLength;
  do {
    lastLength = current.length;

    // enumerate
    current = current.replace(/\\begin\{enumerate\}([^]*?)\\end\{enumerate\}/gi, (_, inner) => {
      return formatList(inner, "ol");
    });

    // itemize
    current = current.replace(/\\begin\{itemize\}([^]*?)\\end\{itemize\}/gi, (_, inner) => {
      return formatList(inner, "ul");
    });

    // center
    current = current.replace(/\\begin\{center\}([^]*?)\\end\{center\}/gi, (_, inner) => {
      return `<div class="text-center my-3 mx-auto w-full">${inner.trim()}</div>`;
    });

    // itemchoice (matchmaking sequential option letters matching a), b), c), d))
    current = current.replace(/\\begin\{itemchoice\}([^]*?)\\end\{itemchoice\}/gi, (_, inner) => {
      const parts = inner.split(/\\itemch\s*/gi);
      let html = "";
      const letters = ["a", "b", "c", "d", "e", "f", "g"];
      
      let itemIdx = 0;
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i].trim();
        if (!part) continue;
        
        // If it starts with a curly brace, extract the balanced content
        if (part.startsWith("{")) {
          let braceCount = 1;
          let k = 1;
          while (k < part.length && braceCount > 0) {
            if (part[k] === "{" && part[k - 1] !== "\\") {
              braceCount++;
            } else if (part[k] === "}" && part[k - 1] !== "\\") {
              braceCount--;
            }
            k++;
          }
          if (braceCount === 0) {
            part = part.substring(1, k - 1).trim();
          }
        }
        
        const label = letters[itemIdx] ? `${letters[itemIdx]})` : `Option:`;
        html += `<div class="flex items-start gap-2 py-1 px-1.5 hover:bg-slate-800/20 rounded transition-all">
          <span class="font-bold text-indigo-400 select-none shrink-0 min-w-[20px] text-right font-mono text-xs">${label}</span>
          <span class="text-slate-200">${part}</span>
        </div>`;
        itemIdx++;
      }

      return `<div class="my-3 p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1.5 w-full">
        <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
          <span>📝</span> Các lựa chọn liên kết:
        </div>
        <div class="space-y-1">
          ${html}
        </div>
      </div>`;
    });

  } while (current.length !== lastLength);

  // Convert TeX math alignment modes into KaTeX aligned block wrapped in display-mode $$ ... $$
  const mathEnvs = [
    "eqnarray", "eqnarray\\*", 
    "align", "align\\*", 
    "equation", "equation\\*", 
    "gather", "gather\\*", 
    "multline", "multline\\*"
  ];
  for (const env of mathEnvs) {
    const regex = new RegExp(`\\\\begin\\{${env}\\}([^]*?)\\\\end\\{${env}\\}`, "gi");
    current = current.replace(regex, (_, inner) => {
      let cleanedInner = inner;
      if (env.startsWith("eqnarray")) {
        // Replace LaTeX eqnarray triple relations "&=&" with single column alignments "&="
        cleanedInner = cleanedInner.replace(/&[\s]*([=<>~]|\\le|\\ge|\\approx|\\equiv|\\ne)[\s]*&/g, " &$1 ");
      }
      return `$$\n\\begin{aligned}\n${cleanedInner.trim()}\n\\end{aligned}\n$$`;
    });
  }

  // Pre-render text styling macros safely
  current = replaceMacro(current, "textbf", "strong", "font-bold text-slate-900");
  current = replaceMacro(current, "textit", "em");
  current = replaceMacro(current, "underline", "span", "underline decoration-indigo-400 decoration-1 underline-offset-2");
  current = replaceMacro(current, "emph", "em");
  current = replaceMacro(current, "mbox", "span");

  // Clean raw spacing and layout structures that frequently slip through
  current = current.replace(/\\noindent\b/gi, "");
  current = current.replace(/\\large\b/gi, "");
  current = current.replace(/\\Large\b/gi, "");
  current = current.replace(/\\small\b/gi, "");
  current = current.replace(/\\vfill\b/gi, "");
  
  // Custom spacing / horizontal fillers
  current = current.replace(/\\hfill\b/gi, " &nbsp; ");
  
  // Custom carriage returns
  current = current.replace(/\\newline\b/gi, "<br />");
  current = current.replace(/\\break\b/gi, "<br />");
  current = current.replace(/\\par\b/gi, "<br />");

  return current;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  className = "",
  block = false,
}) => {
  const renderedHTML = useMemo(() => {
    if (!text) return "";

    const cleanedText = preprocessLaTeX(text);

    if (block) {
      try {
        return katex.renderToString(cleanedText, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (e) {
        return `<code>${cleanedText}</code>`;
      }
    }

    let current = cleanedText;
    const parts: { type: "text" | "inline" | "block"; value: string }[] = [];

    // Match formulas accurately without crossing delimiters
    const combinedRegex = /(\$\$[\s\S]*?\$\$)|(\$[^\$\n]+?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g;

    let match;
    let lastIndex = 0;
    while ((match = combinedRegex.exec(current)) !== null) {
      const matchIndex = match.index;

      // Push preceding text token
      if (matchIndex > lastIndex) {
        parts.push({
          type: "text",
          value: current.substring(lastIndex, matchIndex),
        });
      }

      const matchedString = match[0];
      if (matchedString.startsWith("$$") && matchedString.endsWith("$$")) {
        parts.push({
          type: "block",
          value: matchedString.slice(2, -2).trim(),
        });
      } else if (matchedString.startsWith("$") && matchedString.endsWith("$")) {
        parts.push({
          type: "inline",
          value: matchedString.slice(1, -1).trim(),
        });
      } else if (matchedString.startsWith("\\[") && matchedString.endsWith("\\]")) {
        parts.push({
          type: "block",
          value: matchedString.slice(2, -2).trim(),
        });
      } else if (matchedString.startsWith("\\(") && matchedString.endsWith("\\)")) {
        parts.push({
          type: "inline",
          value: matchedString.slice(2, -2).trim(),
        });
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < current.length) {
      parts.push({
        type: "text",
        value: current.substring(lastIndex),
      });
    }

    if (parts.length === 0) {
      return `<span>${current.replace(/\\\\/g, "<br />").replace(/\n/g, "<br />")}</span>`;
    }

    return parts
      .map((part) => {
        if (part.type === "text") {
          return part.value.replace(/\\\\/g, "<br />").replace(/\n/g, "<br />");
        }
        try {
          return katex.renderToString(part.value, {
            displayMode: part.type === "block",
            throwOnError: false,
          });
        } catch (err) {
          return `<span class="text-red-600 font-mono">${part.value}</span>`;
        }
      })
      .join("");
  }, [text, block]);

  return (
    <span
      className={`math-rendered font-sans leading-relaxed inline ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHTML }}
    />
  );
};
