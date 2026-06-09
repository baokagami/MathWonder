/**
 * Rule-Based (Non-AI) Parser for Vietnamese Exam Papers
 * Compatible with PDF, DOCX, LaTeX (.tex), TXT extracted text.
 * Performs deterministic regex scanning to isolate questions, options, and answer keys.
 */

interface ParsedQuestion {
  id: string;
  text: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay" | "drag_drop";
  options: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
  tikz?: string;
  image?: string;
}

/**
 * Auxiliary helper to parse True/False sequence or custom options.
 */
function parseTrueFalseAnswersString(ansStr: string): string {
  const parts = ansStr.split(",");
  if (parts.length === 4 && parts.every(p => {
    const term = p.trim().toLowerCase();
    return term === "đúng" || term === "sai";
  })) {
    return parts.map(p => p.trim() === "Đúng" ? "Đúng" : "Sai").join(",");
  }

  const answers = ["Sai", "Sai", "Sai", "Sai"];
  const subLetters = ["a", "b", "c", "d"];
  let matchesFound = 0;

  for (let i = 0; i < 4; i++) {
    const letter = subLetters[i];
    // matches "a) Đúng", "a - S", "a. Đ", etc.
    const regex = new RegExp(`\\b${letter}\\b[:\\-\\)\\s]+([ĐđSstTfF]|Đúng|Sai|True|False)`, "i");
    const m = ansStr.match(regex);
    if (m) {
      const val = m[1].toLowerCase();
      if (val.startsWith("đ") || val.startsWith("t")) {
        answers[i] = "Đúng";
      } else {
        answers[i] = "Sai";
      }
      matchesFound++;
    }
  }

  if (matchesFound >= 2) {
    return answers.join(",");
  }

  // Fallback scan: look for 4 letters separated by space or comma, e.g., "Đ S Đ Đ" or "T, F, T, T" or "Đúng Sai Đúng Đúng"
  const cleanTokens = ansStr.replace(/[\-\.\,]/g, " ").split(/\s+/).filter(Boolean);
  if (cleanTokens.length === 4) {
    const tempAnswers: string[] = [];
    let isValidSeq = true;
    for (const token of cleanTokens) {
      const lower = token.toLowerCase();
      if (lower === "đ" || lower === "đúng" || lower === "t" || lower === "true") {
        tempAnswers.push("Đúng");
      } else if (lower === "s" || lower === "sai" || lower === "f" || lower === "false") {
        tempAnswers.push("Sai");
      } else {
        isValidSeq = false;
        break;
      }
    }
    if (isValidSeq) {
      return tempAnswers.join(",");
    }
  }

  return "";
}

/**
 * Extracts individual truth value from a sub-option string.
 * Returns the cleaned option text and the extracted truth value boolean (defaults to false if undetected).
 */
function extractPlainTruthValue(text: string): { cleanedText: string, isTrue: boolean } {
  let cleaned = text.trim();
  let isTrue = false;

  // Patterns to match truth indicator at the end or inside brackets (e.g., "[Đúng]", "(Sai)", "- Đ", "✔️", etc.)
  const rxBrackets = /[\s\-\:\.\,]*[\[\(\s]*(Đúng|True|Đ|T|Sai|False|S|F)[\]\)\s]*\.?$/i;
  const rxSymbol = /[\s\-\:\.\,]*[*✔✔️]\s*$/i;

  let matchBrackets = cleaned.match(rxBrackets);
  if (matchBrackets) {
    const val = matchBrackets[1].toLowerCase();
    if (val === "đúng" || val === "true" || val === "đ" || val === "t") {
      isTrue = true;
    }
    cleaned = cleaned.replace(rxBrackets, "").trim();
  } else {
    let matchSymbol = cleaned.match(rxSymbol);
    if (matchSymbol) {
      isTrue = true;
      cleaned = cleaned.replace(rxSymbol, "").trim();
    }
  }

  // Clean trailing punctuation
  cleaned = cleaned.replace(/[\s\-\:\.\,;]+$/, "").trim();
  return { cleanedText: cleaned, isTrue };
}

/**
 * Extracts and maps standard answer keys from text (often listed at the end of Vietnamese tests).
 * E.g., "1.A", "2 - B", "Câu 3: C", "Phiếu đáp án: 1A, 2B, 3C..."
 */
function extractAnswerKeyMap(text: string): Record<number, string> {
  const answerMap: Record<number, string> = {};

  // Find where the Answer Key Section commonly starts
  const answerSectionRegexes = [
    /bảng đáp án/i,
    /đáp án/i,
    /phiếu đáp án/i,
    /hướng dẫn giải/i,
    /lời giải chi tiết/i,
    /đáp số/i,
    /key/i
  ];

  let bestSectionIndex = -1;
  for (const rx of answerSectionRegexes) {
    const match = text.match(rx);
    if (match && match.index !== undefined && match.index > bestSectionIndex) {
      bestSectionIndex = match.index;
    }
  }

  // Scan from the answer section onwards, or scan the full text if not found
  const scanContent = bestSectionIndex !== -1 ? text.substring(bestSectionIndex) : text;

  // Pattern 1: Look for "Câu 1: A", "1.A", "1-A", "1. A", "2/B"
  const pairRegex1 = /(?:Câu\s*)?\b(\d+)\s*[:.\-\/\s)]+\s*([A-D])\b/gi;
  let match;
  while ((match = pairRegex1.exec(scanContent)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase();
    if (!answerMap[qNum]) {
      answerMap[qNum] = ans;
    }
  }

  // Pattern 2: Scan lines in explicit answer section for more complex answers (True/False sequences or short answers)
  if (bestSectionIndex !== -1) {
    const lines = scanContent.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      // Pattern: "Câu 10: a) Đúng, b) Sai, c) Đúng, d) Sai" or "Câu 10. 15/4" or "Câu 10: 12"
      const matchSA = line.match(/(?:Câu\s*)?(\d+)\s*[:.\-\s]+\s*([^\r\n]+)/i);
      if (matchSA) {
        const qNum = parseInt(matchSA[1], 10);
        let ansVal = matchSA[2].trim();
        if (!answerMap[qNum]) {
          // Check if it's a True/False sequence
          const tfSeq = parseTrueFalseAnswersString(ansVal);
          if (tfSeq) {
            answerMap[qNum] = tfSeq;
          } else {
            ansVal = ansVal.replace(/[\s\.]+$/, "").trim();
            // Ignore if it matches a generic comment or other question header lines
            if (ansVal && ansVal.length < 50 && !ansVal.toLowerCase().includes("câu")) {
              answerMap[qNum] = ansVal;
            }
          }
        }
      }
    }
  }

  // Pattern 3: Fallback for grids like "1A 2B 3C 4D" or "1.A 2.B"
  if (Object.keys(answerMap).length === 0) {
    const pairRegex2 = /\b(\d+)\s*([A-D])\b/gi;
    while ((match = pairRegex2.exec(scanContent)) !== null) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].toUpperCase();
      if (!answerMap[qNum]) {
        answerMap[qNum] = ans;
      }
    }
  }

  return answerMap;
}

/**
 * Clean up markdown/LaTeX formatting and HTML tags for presentation.
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\begin\{oneparchoices\}/g, "")
    .replace(/\\end\{oneparchoices\}/g, "")
    .replace(/\\begin\{choices\}/g, "")
    .replace(/\\end\{choices\}/g, "")
    .trim();
}

/**
 * Strip outer curly braces or balanced brackets around option text
 */
function cleanLatexBraces(str: string): string {
  let cleaned = str.trim();
  while (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    let balance = 0;
    let isSingleBalanced = true;
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (cleaned[i] === "{") balance++;
      else if (cleaned[i] === "}") balance--;
      if (balance === 0 && i > 0) {
        isSingleBalanced = false;
        break;
      }
    }
    if (isSingleBalanced) {
      cleaned = cleaned.substring(1, cleaned.length - 1).trim();
    } else {
      break;
    }
  }
  return cleaned;
}

/**
 * Remove LaTeX choice/truth tags safely while preserving option contents
 */
function stripLatexMarkers(str: string): string {
  let text = str.trim();
  text = cleanLatexBraces(text);

  const tagsToStrip = ["True", "False", "CorrectChoice", "choice", "Correct", "T", "F"];
  for (const tag of tagsToStrip) {
    const rxBraced = new RegExp(`\\\\${tag}\\s*\\{([^]*?)\\}`, "gi");
    let matchFound = rxBraced.test(text);
    while (matchFound) {
      text = text.replace(rxBraced, "$1");
      matchFound = rxBraced.test(text);
    }
    
    // Strip simple un-braced markers
    const rxSlash = new RegExp(`\\\\${tag}\\b`, "gi");
    text = text.replace(rxSlash, "");
  }

  return cleanLatexBraces(text.trim());
}

/**
 * Strip LaTeX comments (lines beginning with %, or % that is not escaped as \%)
 */
function stripLaTeXComments(text: string): string {
  return text.split("\n").map(line => {
    let commentIdx = -1;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '%' && (c === 0 || line[c - 1] !== '\\')) {
        commentIdx = c;
        break;
      }
    }
    if (commentIdx !== -1) {
      return line.substring(0, commentIdx);
    }
    return line;
  }).join("\n");
}

/**
 * Robustly extracts balance braced groups { ... } in LaTeX, handling nested brackets.
 */
function extractBraceGroups(text: string, startIndex: number, count: number = 4): { groups: string[], nextIndex: number } {
  const groups: string[] = [];
  let i = startIndex;
  
  while (groups.length < count && i < text.length) {
    while (i < text.length && /\s/.test(text[i])) {
      i++;
    }
    
    if (text[i] === '{') {
      let braceCount = 1;
      let startOfGroup = i + 1;
      i++;
      
      while (i < text.length && braceCount > 0) {
        if (text[i] === '{' && text[i - 1] !== '\\') {
          braceCount++;
        } else if (text[i] === '}' && text[i - 1] !== '\\') {
          braceCount--;
        }
        i++;
      }
      
      if (braceCount === 0) {
        groups.push(text.substring(startOfGroup, i - 1));
      } else {
        groups.push(text.substring(startOfGroup));
        break;
      }
    } else {
      break;
    }
  }
  
  return { groups, nextIndex: i };
}

/**
 * Parses a single LaTeX blocks (whether bounded inside ex/cau or split by \question)
 */
function parseSingleLaTeXBlock(
  rawBlock: string, 
  qNumber: number, 
  prefix: string, 
  answerMap: Record<number, string>
): ParsedQuestion {
  const id = `${prefix}-${Date.now()}-${qNumber}-${Math.random().toString(36).substring(2, 5)}`;
  let content = rawBlock.trim();

  // 1. Extract TikZ pictures if any
  let tikz: string | undefined = undefined;
  const tikzRegex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/gi;
  const tikzMatch = content.match(tikzRegex);
  if (tikzMatch) {
    tikz = tikzMatch[0];
    content = content.replace(tikzRegex, "").trim();
  }

  // 2. Extract detailed solution
  let explanation = "Được tách tự động qua cấu trúc LaTeX.";
  const lgEnvRegex = /\\begin\{(loigiai|proof|huongdan)\}([\s\S]*?)\\end\{\1\}/gi;
  const lgEnvMatch = lgEnvRegex.exec(content);
  if (lgEnvMatch) {
    explanation = lgEnvMatch[2].trim();
    content = content.replace(lgEnvRegex, "").trim();
  } else {
    const lgMacroRegexes = [/\\loigiai\b/gi, /\\huongdan\b/gi, /\\lờigiải\b/gi];
    for (const rx of lgMacroRegexes) {
      const lgMatch = rx.exec(content);
      if (lgMatch) {
        const startIdx = lgMatch.index;
        const macroLen = lgMatch[0].length;
        const braceRes = extractBraceGroups(content, startIdx + macroLen, 1);
        if (braceRes.groups.length > 0) {
          explanation = braceRes.groups[0].trim();
          const endIdx = braceRes.nextIndex;
          content = (content.substring(0, startIdx) + content.substring(endIdx)).trim();
        }
        break;
      }
    }
  }

  // 3. Detect Question Type & Options (Multiple Choice, True/False, Short Answer)
  let type: ParsedQuestion["type"] = "multiple_choice";
  let options: string[] = [];
  let correctAnswer = "";

  // A. Check for custom multi-line choicesTF / truefalse environmental blocks first
  const choicesTFEnvRegex = /\\begin\{(choicesTF|oneparchoicesTF|truefalse)\}([\s\S]*?)\\end\{\1\}/gi;
  const choicesTFEnvMatch = choicesTFEnvRegex.exec(content);

  // B. Check for custom multiple choice list environments
  const choicesEnvRegex = /\\begin\{(choices|oneparchoices)\}([\s\S]*?)\\end\{\1\}/gi;
  const choicesEnvMatch = choicesEnvRegex.exec(content);

  const idxOfChoiceTF = content.search(/\\choiceTF\b/i);
  const idxOfChoice = content.search(/\\choice\b/i);
  const idxOfShortans = content.search(/\\shortans\b/i);

  if (choicesTFEnvMatch) {
    type = "true_false";
    const inner = choicesTFEnvMatch[2];
    content = content.replace(choicesTFEnvRegex, "").trim();
    
    // Split by \choice or \CorrectChoice
    const itemMatches = [...inner.matchAll(/\\(choice|CorrectChoice)\b([\s\S]*?)(?=\\(?:choice|CorrectChoice)\b|$)/gi)];
    const answersList: string[] = [];
    const optionLabels = ["a", "b", "c", "d"];
    
    for (let i = 0; i < 4; i++) {
      let optText = itemMatches[i] ? itemMatches[i][2].trim() : "";
      const isTrue = /\\True\b/i.test(optText) || /\\T\b/i.test(optText);
      
      if (isTrue) {
        answersList.push("Đúng");
      } else {
        answersList.push("Sai");
      }
      
      optText = stripLatexMarkers(optText);
      options.push(`${optionLabels[i]}) ${optText}`);
    }
    correctAnswer = answersList.join(",");
  } else if (choicesEnvMatch) {
    type = "multiple_choice";
    const inner = choicesEnvMatch[2];
    content = content.replace(choicesEnvRegex, "").trim();
    
    const itemMatches = [...inner.matchAll(/\\(choice|CorrectChoice)\b([\s\S]*?)(?=\\(?:choice|CorrectChoice)\b|$)/gi)];
    const rawOptions: string[] = [];
    let detectedAnswerIdx = -1;
    const optionLetters = ["A", "B", "C", "D"];
    
    for (let i = 0; i < itemMatches.length; i++) {
      const isCorrect = itemMatches[i][1].toLowerCase() === "correctchoice" || /\\True\b/i.test(itemMatches[i][2]);
      if (isCorrect) {
        detectedAnswerIdx = i;
      }
      rawOptions.push(itemMatches[i][2].trim());
    }
    
    for (let i = 0; i < 4; i++) {
      let optText = rawOptions[i] ? rawOptions[i].trim() : "";
      optText = stripLatexMarkers(optText);
      options.push(`${optionLetters[i]}. ${optText}`);
    }
    correctAnswer = detectedAnswerIdx !== -1 ? optionLetters[detectedAnswerIdx] : (answerMap[qNumber] || "A");
  } else if (idxOfChoiceTF !== -1) {
    // This is a True-False Question (\choiceTF)
    type = "true_false";
    const startIdx = idxOfChoiceTF + 9;
    const braceRes = extractBraceGroups(content, startIdx, 4);
    
    if (braceRes.groups.length > 0) {
      content = (content.substring(0, idxOfChoiceTF) + content.substring(braceRes.nextIndex)).trim();
      
      const rawOptions = braceRes.groups;
      const optionLabels = ["a", "b", "c", "d"];
      const answersList: string[] = [];
      
      for (let i = 0; i < 4; i++) {
        let optText = rawOptions[i] ? rawOptions[i].trim() : "";
        const isTrue = /\\True\b/i.test(optText) || /\\T\b/i.test(optText);
        
        if (isTrue) {
          answersList.push("Đúng");
        } else {
          answersList.push("Sai");
        }
        
        optText = stripLatexMarkers(optText);
        options.push(`${optionLabels[i]}) ${optText}`);
      }
      
      correctAnswer = answersList.join(",");
    }
  } else if (idxOfShortans !== -1) {
    // This is a Short Answer Question (\shortans)
    type = "short_answer";
    const startIdx = idxOfShortans + 9;
    const braceRes = extractBraceGroups(content, startIdx, 1);
    
    if (braceRes.groups.length > 0) {
      content = (content.substring(0, idxOfShortans) + content.substring(braceRes.nextIndex)).trim();
      correctAnswer = braceRes.groups[0].trim().replace(/[\$\\]/g, "");
    } else {
      correctAnswer = "Đáp số tự viết";
    }
    options = [];
  } else if (idxOfChoice !== -1) {
    // This is a Multiple Choice Question (\choice)
    type = "multiple_choice";
    const startIdx = idxOfChoice + 7;
    const braceRes = extractBraceGroups(content, startIdx, 4);
    
    if (braceRes.groups.length >= 2) {
      content = (content.substring(0, idxOfChoice) + content.substring(braceRes.nextIndex)).trim();
      
      const rawOptions = braceRes.groups;
      const optionLetters = ["A", "B", "C", "D"];
      let detectedAnswerIdx = -1;
      
      for (let i = 0; i < rawOptions.length; i++) {
        let optText = rawOptions[i].trim();
        const isTrue = /\\True\b/i.test(optText) || /\\CorrectChoice\b/i.test(optText);
        if (isTrue) {
          detectedAnswerIdx = i;
        }
        optText = stripLatexMarkers(optText);
        options.push(`${optionLetters[i]}. ${optText}`);
      }
      
      while (options.length < 4) {
        options.push(`${optionLetters[options.length]}. `);
      }
      
      correctAnswer = detectedAnswerIdx !== -1 ? optionLetters[detectedAnswerIdx] : (answerMap[qNumber] || "A");
    } else {
      options = ["A. ", "B. ", "C. ", "D. "];
      correctAnswer = answerMap[qNumber] || "A";
    }
  } else {
    const lowerQ = content.toLowerCase();
    if (lowerQ.includes("tự luận") || lowerQ.includes("hãy trình bày") || lowerQ.includes("chứng minh") || lowerQ.includes("hãy giải thích")) {
      type = "essay";
      correctAnswer = "";
    } else {
      type = "short_answer";
      correctAnswer = answerMap[qNumber] || "Đáp án tự điền";
    }
    options = [];
  }

  let questionText = cleanText(content);
  questionText = questionText.replace(/^\s*(?:Câu|Question)\s*\d+\s*[:.\-\[\]\)\s]*/gi, "").trim();
  explanation = explanation.replace(/^\s*(?:Lời giải|Hướng dẫn giải)\s*[:.\-\s]*/gi, "").trim();

  return {
    id,
    text: questionText,
    type,
    options,
    correctAnswer: correctAnswer || "A",
    points: type === "multiple_choice" ? 0.25 : (type === "short_answer" ? 0.5 : 1.0),
    explanation,
    ...(tikz ? { tikz } : {})
  };
}

/**
 * Robust LaTeX Parser prioritizing ex_test.sty and standard \question definitions.
 */
function parseLaTeXDeterministic(text: string, answerMap: Record<number, string>): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const cleanTextRaw = stripLaTeXComments(text);

  // Scan for environments: ex, cau, question
  const envRegex = /\\begin\{(ex|cau|question)\}((?:\[[^\]]*\])*)([\s\S]*?)\\end\{\1\}/gi;
  const matches = [...cleanTextRaw.matchAll(envRegex)];
  
  let qNumber = 1;

  if (matches.length > 0) {
    for (const match of matches) {
      const blockContent = match[3].trim();
      const parsed = parseSingleLaTeXBlock(blockContent, qNumber, "noai-tex-env", answerMap);
      if (parsed) {
        parsed.text = parsed.text.replace(/^\s*(?:\[[^\]]*\]\s*)+/g, "").trim();
        questions.push(parsed);
        qNumber++;
      }
    }
  } else {
    // Fallback: Split by \question keyword
    const blocks = cleanTextRaw.split(/\\question\b/g);
    for (let i = 1; i < blocks.length; i++) {
      const blockContent = blocks[i].trim();
      if (!blockContent) continue;
      
      const parsed = parseSingleLaTeXBlock(blockContent, qNumber, "noai-tex-q", answerMap);
      if (parsed) {
        questions.push(parsed);
        qNumber++;
      }
    }
  }

  return questions;
}

/**
 * Main parser entry point. Reads the text and returns a beautifully structured set of questions.
 */
export function parseExamDeterministic(text: string, fileType: string, examPreset?: string): ParsedQuestion[] {
  const answerMap = extractAnswerKeyMap(text);
  
  // Clean text and check if it's LaTeX formatted
  const isLaTeX = fileType.toLowerCase() === "tex" || 
                  text.includes("\\begin{ex}") || 
                  text.includes("\\begin{cau}") || 
                  text.includes("\\begin{question}") || 
                  text.includes("\\choiceTF") || 
                  text.includes("\\shortans") || 
                  (text.includes("\\question") && (text.includes("\\choice") || text.includes("\\CorrectChoice")));

  let parsedQuestions: ParsedQuestion[] = [];

  if (isLaTeX) {
    const texQuestions = parseLaTeXDeterministic(text, answerMap);
    if (texQuestions.length > 0) {
      parsedQuestions = applyPresetAlignments(texQuestions, examPreset);
    }
  }

  if (parsedQuestions.length === 0) {
    // --- STANDARD TEXT-BASED VIETNAMESE EXAM PARSER (REGEX FLOW) ---
    const questions: ParsedQuestion[] = [];
    
    // Match "Câu 1:", "Câu 1.", "Câu 1 (NB):" or "Question 1:"
    const qSplitRegex = /(?:\r?\n|^)\s*(?:Câu|Question)\s*(\d+)\s*[:.\-\[\]\)\s]/gi;
    
    // Let's split the text. If we split the text, we get pre-content, then alternate question number text and the rest
    const parts = text.split(qSplitRegex);
    
    let qIndex = 1;
    // If we have parts, parts[0] is the introduction preamble
    for (let i = 1; i < parts.length; i += 2) {
      const rawNumberHex = parts[i];
      const qContent = parts[i + 1];
      if (!qContent) continue;

      const qNumber = parseInt(rawNumberHex, 10) || qIndex;
      const id = `noai-std-${Date.now()}-${qNumber}-${Math.random().toString(36).substring(2, 5)}`;

      // Slice options A, B, C, D in this block
      const markerRegex = /(?:^|[\s\r\n])\s*([A-D])\s*[\.\)\/]/g;
      const optionMatches = [];
      let match;
      while ((match = markerRegex.exec(qContent)) !== null) {
        optionMatches.push({
          key: match[1].toUpperCase(),
          index: match.index,
          fullLength: match[0].length
        });
      }

      // Filter matches to form an actual ABCD order
      let validMatches: typeof optionMatches = [];
      let curExpected = 0;
      const order = ["A", "B", "C", "D"];
      for (const m of optionMatches) {
        if (m.key === order[curExpected]) {
          validMatches.push(m);
          curExpected++;
          if (curExpected === 4) break;
        } else if (m.key === "A") {
          // Reset sequence
          validMatches = [m];
          curExpected = 1;
        }
      }

      let questionText = "";
      const options: string[] = [];
      let detectedAnswer = "";
      const trueFalseAnswersList: string[] = [];

      if (validMatches.length >= 2) {
        // Split question text from first option
        questionText = qContent.substring(0, validMatches[0].index).trim();
        
        // Slice option texts
        for (let oIdx = 0; oIdx < validMatches.length; oIdx++) {
          const start = validMatches[oIdx].index + validMatches[oIdx].fullLength;
          const end = (oIdx + 1 < validMatches.length) ? validMatches[oIdx + 1].index : qContent.length;
          let optionText = qContent.substring(start, end).trim();

          // Remove trailing commas, dots, semicolons, and clean whitespace
          optionText = optionText.replace(/[\s,;]+$/, "").trim();

          // Check for correct answer markers (e.g., "A. *", "B. [X]", "C. ✔")
          if (optionText.includes("*") || optionText.includes("✔") || optionText.includes("✔️") || optionText.includes("Correct")) {
            detectedAnswer = validMatches[oIdx].key;
            optionText = optionText.replace(/[*✔✔️]/g, "").trim();
          }

          options.push(`${validMatches[oIdx].key}. ${optionText}`);
        }
        
        while (options.length < 4) {
          options.push(`${order[options.length]}. `);
        }
      } else {
        // Look for True/False options (a, b, c, d)
        const tfMarkerRegex = /(?:^|[\s\r\n])\s*([a-d])\s*[\.\)\/]/g;
        const tfMatches = [];
        let tfMatch;
        while ((tfMatch = tfMarkerRegex.exec(qContent)) !== null) {
          tfMatches.push({
            key: tfMatch[1].toLowerCase(),
            index: tfMatch.index,
            fullLength: tfMatch[0].length
          });
        }

        // Filter to validate order a -> b -> c -> d
        let validTf: typeof tfMatches = [];
        let tfExpected = 0;
        const tfOrder = ["a", "b", "c", "d"];
        for (const m of tfMatches) {
          if (m.key === tfOrder[tfExpected]) {
            validTf.push(m);
            tfExpected++;
            if (tfExpected === 4) break;
          } else if (m.key === "a") {
            validTf = [m];
            tfExpected = 1;
          }
        }

        if (validTf.length >= 2) {
          questionText = qContent.substring(0, validTf[0].index).trim();
          for (let oIdx = 0; oIdx < validTf.length; oIdx++) {
            const start = validTf[oIdx].index + validTf[oIdx].fullLength;
            const end = (oIdx + 1 < validTf.length) ? validTf[oIdx + 1].index : qContent.length;
            let tfText = qContent.substring(start, end).trim();
            
            // Clear trailing comma-semicolons
            tfText = tfText.replace(/[\s,;]+$/, "").trim();
            
            // Dynamically parse truth value for each sub-option
            const { cleanedText, isTrue } = extractPlainTruthValue(tfText);
            tfText = cleanedText;
            trueFalseAnswersList.push(isTrue ? "Đúng" : "Sai");
            
            options.push(`${validTf[oIdx].key}) ${tfText}`);
          }
          while (options.length < 4) {
            options.push(`${tfOrder[options.length]}) `);
            trueFalseAnswersList.push("Sai");
          }
        } else {
          // No options found.
          questionText = qContent.trim();
        }
      }

      // Determine type
      let type: ParsedQuestion["type"] = "multiple_choice";
      if (options.length === 0) {
        const lowerQ = questionText.toLowerCase();
        if (lowerQ.includes("tự luận") || lowerQ.includes("hãy trình bày") || lowerQ.includes("chứng minh") || lowerQ.includes("hãy giải thích")) {
          type = "essay";
        } else {
          type = "short_answer";
        }
      } else if (options[0].startsWith("a)")) {
        type = "true_false";
      }

      // Try parsing short-answer key from the body text
      let shortAnswerInBody = "";
      if (type === "short_answer") {
        const shortAnsMatch = questionText.match(/(?:Đáp số|Đáp án|Kết quả|Ans|Result)[:\s\-]+([^\r\n]+)/i);
        if (shortAnsMatch) {
          shortAnswerInBody = shortAnsMatch[1].trim();
          shortAnswerInBody = shortAnswerInBody.replace(/[\$\\]/g, "").replace(/[\s\.]+$/, "").trim();
          questionText = questionText.replace(/(?:Đáp số|Đáp án|Kết quả|Ans|Result)[:\s\-]+([^\r\n]+)/gi, "").trim();
        }
      }

      // Map correct answer
      let finalAnswer = "";
      if (type === "multiple_choice") {
        finalAnswer = answerMap[qNumber] || detectedAnswer || "A";
      } else if (type === "true_false") {
        const mappedAns = answerMap[qNumber];
        if (mappedAns && mappedAns.split(",").length === 4) {
          finalAnswer = mappedAns;
        } else {
          finalAnswer = trueFalseAnswersList.join(",") || "Đúng,Đúng,Đúng,Đúng";
        }
      } else if (type === "short_answer") {
        finalAnswer = answerMap[qNumber] || shortAnswerInBody || "Đáp số tự viết";
      }

      questions.push({
        id,
        text: cleanText(questionText),
        type,
        options: options,
        correctAnswer: finalAnswer,
        points: type === "multiple_choice" ? 0.25 : (type === "short_answer" ? 0.5 : 1.0),
        explanation: `Đã phân tách thành công không dùng AI từ Câu ${qNumber}.`
      });

      qIndex++;
    }

    // Fallback if no questions parsed
    if (questions.length === 0) {
      questions.push({
        id: `noai-fallback-1`,
        text: text.substring(0, 300) + (text.length > 300 ? "..." : ""),
        type: "short_answer",
        options: [],
        correctAnswer: "Đáp án",
        points: 1.0,
        explanation: "Không phát hiện ký tự Câu 1:, Câu 2... trong tài liệu. Vui lòng kiểm tra định dạng hoặc dán đề trực tiếp."
      });
    }

    parsedQuestions = applyPresetAlignments(questions, examPreset);
  }

  // Final cleanup and inline image extraction
  return parsedQuestions.map(q => {
    let qText = q.text;
    let imgStr = q.image;
    
    const imgRegex = /<img\s+[^>]*src=["'](data:[^"']+)["'][^>]*>/i;
    const imgMatch = qText.match(imgRegex);
    if (imgMatch) {
      imgStr = imgMatch[1];
      qText = qText.replace(imgRegex, "").trim();
    }
    
    return {
      ...q,
      text: qText,
      image: imgStr
    };
  });
}

/**
 * Normalizes question types and point values according to selected presets.
 */
function applyPresetAlignments(questions: ParsedQuestion[], examPreset?: string): ParsedQuestion[] {
  if (!examPreset || examPreset === "CUSTOM") return questions;

  return questions.map((q, i) => {
    let qType = q.type;
    let points = q.points;

    if (examPreset === "THPT" || examPreset === "PERIODIC_90") {
      if (i < 12) {
        qType = "multiple_choice";
        points = 0.25;
      } else if (i < 12 + 4) {
        qType = "true_false";
        points = 1.0;
      } else {
        qType = "short_answer";
        points = 0.5;
      }
    } else if (examPreset === "DAILY_15") {
      if (i < 10) {
        qType = "multiple_choice";
        points = 0.8;
      } else {
        qType = "short_answer";
        points = 1.0;
      }
    } else if (examPreset === "DAILY_30") {
      if (i < 15) {
        qType = "multiple_choice";
        points = 0.4;
      } else if (i < 15 + 2) {
        qType = "true_false";
        points = 1.0;
      } else {
        qType = "short_answer";
        points = 1.0;
      }
    } else if (examPreset === "HSA") {
      if (i < 35) {
        qType = "multiple_choice";
        points = 1.0;
      } else {
        qType = "short_answer";
        points = 1.0;
      }
    } else if (examPreset === "TSA") {
      if (i < 25) {
        qType = "multiple_choice";
        points = 1.0;
      } else if (i < 30) {
        qType = "true_false";
        points = 1.0;
      } else if (i < 35) {
        qType = "drag_drop";
        points = 1.0;
      } else {
        qType = "short_answer";
        points = 1.0;
      }
    } else if (examPreset === "QĐA") {
      if (i < 35) {
        qType = "multiple_choice";
        points = 1.0;
      } else {
        qType = "short_answer";
        points = 1.0;
      }
    } else if (examPreset === "BCA") {
      if (i < 30) {
        qType = "multiple_choice";
        points = 0.25;
      } else {
        qType = "short_answer";
        points = 0.5;
      }
    }

    // Keep dynamic options correct structure
    let options = q.options;
    if (qType === "multiple_choice" && (!options || options.length === 0 || !options[0].startsWith("A."))) {
      options = ["A. ", "B. ", "C. ", "D. "];
    } else if (qType === "true_false" && (!options || options.length === 0 || !options[0].startsWith("a)"))) {
      options = ["a) ", "b) ", "c) ", "d) "];
    } else if (qType === "short_answer" || qType === "essay") {
      options = [];
    }

    return {
      ...q,
      type: qType,
      points,
      options: options
    };
  });
}
