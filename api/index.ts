import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import JSZip from "jszip";
import { parseExamDeterministic } from "../src/utils/nonAiParser";

dotenv.config();

export const app = express();
const PORT = 3000;

// Increase request-body payload size for base64 file processing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const apiKey = process.env.GEMINI_API_KEY;

// Shared Gemini API Client logic safely backed
const getGeminiClient = (customKey?: string) => {
  const activeKey = customKey || apiKey;
  if (!activeKey || 
      activeKey.trim() === "" || 
      activeKey.includes("YOUR_") || 
      activeKey.includes("PLACEHOLDER") ||
      activeKey === "GEMINI_API_KEY" ||
      activeKey.length < 15) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: activeKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// ============================================================================
// CUSTOM .DOCX PARSER WITH MATHTYPE (OMML) AND SEQUENTIAL IMAGE EXTRACTION
// ============================================================================

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: (XmlNode | string)[];
}

function parseXml(xmlString: string): XmlNode[] {
  const result: XmlNode[] = [];
  const tagRegex = /<([?\/!]?[a-zA-Z0-9_:]+)([^>]*?)(\/?)>/g;
  let lastIndex = 0;
  const stack: XmlNode[] = [];
  const current: XmlNode = { name: "root", attributes: {}, children: [] };
  stack.push(current);

  let match;
  while ((match = tagRegex.exec(xmlString)) !== null) {
    const textBetween = xmlString.substring(lastIndex, match.index);
    if (textBetween) {
      if (textBetween.trim()) {
        const decodedText = textBetween
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        stack[stack.length - 1].children.push(decodedText);
      }
    }

    const tagName = match[1];
    const attrString = match[2];
    const isSelfClosing = match[3] === "/" || tagName.startsWith("?") || tagName.startsWith("!");

    if (tagName.startsWith("/")) {
      stack.pop();
      lastIndex = tagRegex.lastIndex;
    } else if (isSelfClosing) {
      if (!tagName.startsWith("?") && !tagName.startsWith("!")) {
        const attrs: Record<string, string> = {};
        const attrRegex = /([a-zA-Z0-9_:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrString)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2] || attrMatch[3] || "";
        }
        stack[stack.length - 1].children.push({
          name: tagName,
          attributes: attrs,
          children: []
        });
      }
      lastIndex = tagRegex.lastIndex;
    } else {
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9_:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        attrs[attrMatch[1]] = attrMatch[2] || attrMatch[3] || "";
      }

      const newNode: XmlNode = {
        name: tagName,
        attributes: attrs,
        children: []
      };

      stack[stack.length - 1].children.push(newNode);
      stack.push(newNode);
      lastIndex = tagRegex.lastIndex;
    }
  }
  return stack[0].children as XmlNode[];
}

function ommlToLatex(node: XmlNode): string {
  if (typeof node === "string") return node;

  const nameLower = node.name.toLowerCase();

  if (nameLower === "m:t") {
    return getMergedText(node);
  }

  if (nameLower === "m:f") {
    const numNode = findNodeByName(node, "m:num");
    const denNode = findNodeByName(node, "m:den");
    const numLatex = numNode ? processOmmlChildren(numNode) : "";
    const denLatex = denNode ? processOmmlChildren(denNode) : "";
    return `\\frac{${numLatex}}{${denLatex}}`;
  }

  if (nameLower === "m:ssup") {
    const baseNode = findNodeByName(node, "m:e");
    const supNode = findNodeByName(node, "m:sup");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    const supLatex = supNode ? processOmmlChildren(supNode) : "";
    return `${baseLatex}^{${supLatex}}`;
  }

  if (nameLower === "m:ssub") {
    const baseNode = findNodeByName(node, "m:e");
    const subNode = findNodeByName(node, "m:sub");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    const subLatex = subNode ? processOmmlChildren(subNode) : "";
    return `${baseLatex}_{${subLatex}}`;
  }

  if (nameLower === "m:ssubsup") {
    const baseNode = findNodeByName(node, "m:e");
    const subNode = findNodeByName(node, "m:sub");
    const supNode = findNodeByName(node, "m:sup");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    const subLatex = subNode ? processOmmlChildren(subNode) : "";
    const supLatex = supNode ? processOmmlChildren(supNode) : "";
    return `${baseLatex}_{${subLatex}}^{${supLatex}}`;
  }

  if (nameLower === "m:rad") {
    const baseNode = findNodeByName(node, "m:e");
    const degNode = findNodeByName(node, "m:deg");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    const degLatex = degNode ? processOmmlChildren(degNode) : "";
    if (degLatex && degLatex.trim()) {
      return `\\sqrt[${degLatex}]{${baseLatex}}`;
    }
    return `\\sqrt{${baseLatex}}`;
  }

  if (nameLower === "m:d") {
    const baseNode = findNodeByName(node, "m:e");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    const dPr = findNodeByName(node, "m:dPr");
    let openChar = "(";
    let closeChar = ")";
    if (dPr) {
      const openNode = findNodeByName(dPr, "m:begChr");
      if (openNode) openChar = openNode.attributes["m:val"] || openChar;
      const closeNode = findNodeByName(dPr, "m:endChr");
      if (closeNode) closeChar = closeNode.attributes["m:val"] || closeChar;
    }
    return `\\left${openChar}${baseLatex}\\right${closeChar}`;
  }

  if (nameLower === "m:nary") {
    const subNode = findNodeByName(node, "m:sub");
    const supNode = findNodeByName(node, "m:sup");
    const baseNode = findNodeByName(node, "m:e");
    const subLatex = subNode ? processOmmlChildren(subNode) : "";
    const supLatex = supNode ? processOmmlChildren(supNode) : "";
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";

    let op = "\\int";
    const naryPr = findNodeByName(node, "m:naryPr");
    if (naryPr) {
       const chrNode = findNodeByName(naryPr, "m:chr");
       if (chrNode) {
         const charVal = chrNode.attributes["m:val"];
         if (charVal === "∑") op = "\\sum";
         else if (charVal === "∏") op = "\\prod";
       }
    }
    return `${op}_{${subLatex}}^{${supLatex}}{${baseLatex}}`;
  }

  if (nameLower === "m:bar") {
    const baseNode = findNodeByName(node, "m:e");
    const baseLatex = baseNode ? processOmmlChildren(baseNode) : "";
    return `\\overline{${baseLatex}}`;
  }

  return processOmmlChildren(node);
}

function processOmmlChildren(node: XmlNode): string {
  let result = "";
  for (const child of node.children) {
    if (typeof child === "string") {
      result += child;
    } else {
      result += ommlToLatex(child);
    }
  }
  return result;
}

function findNodeByName(node: XmlNode, name: string): XmlNode | null {
  const target = name.toLowerCase();
  for (const child of node.children) {
    if (typeof child !== "string" && child.name.toLowerCase() === target) {
      return child;
    }
  }
  return null;
}

function getMergedText(node: XmlNode): string {
  let result = "";
  for (const child of node.children) {
    if (typeof child === "string") {
      result += child;
    } else {
      result += getMergedText(child);
    }
  }
  return result;
}

function findImageRelIds(node: XmlNode, relIds: string[] = []): string[] {
  if (typeof node === "string") return relIds;

  for (const [key, value] of Object.entries(node.attributes)) {
    if ((key === "r:embed" || key === "r:id" || key.endsWith("embed")) && value.startsWith("rId")) {
      relIds.push(value);
    }
  }

  for (const child of node.children) {
    if (typeof child !== "string") {
      findImageRelIds(child, relIds);
    }
  }
  return relIds;
}

async function parseDocxMathAndImages(fileBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const docXmlStr = await zip.file("word/document.xml")?.async("string");
  if (!docXmlStr) {
    throw new Error("Không thể định dạng hoặc giải nén tệp tin Word (.docx).");
  }

  const relsXmlStr = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const relsMap: Record<string, string> = {};
  if (relsXmlStr) {
    const relNodes = parseXml(relsXmlStr);
    const findRels = (node: XmlNode) => {
      if (node.name && node.name.toLowerCase() === "relationship") {
        const id = node.attributes["Id"];
        const target = node.attributes["Target"];
        if (id && target) {
          relsMap[id] = target;
        }
      }
      for (const child of node.children) {
        if (typeof child !== "string") {
          findRels(child);
        }
      }
    };
    relNodes.forEach(n => findRels(n));
  }

  const imagesMap: Record<string, string> = {};
  for (const [rId, targetPath] of Object.entries(relsMap)) {
    let cleanPath = targetPath;
    if (!cleanPath.startsWith("word/")) {
      cleanPath = `word/${cleanPath}`;
    }

    const imageFile = zip.file(cleanPath);
    if (imageFile) {
      const buffer = await imageFile.async("nodebuffer");
      const base64 = buffer.toString("base64");
      const ext = targetPath.split(".").pop()?.toLowerCase() || "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/png";
      imagesMap[rId] = `data:${mime};base64,${base64}`;
    }
  }

  const parsedDocs = parseXml(docXmlStr);
  let documentText = "";

  const walkDocument = (node: XmlNode) => {
    if (typeof node === "string") return;

    const nameLower = node.name.toLowerCase();

    if (nameLower === "w:p") {
      let paraText = "";

      const processParaChildren = (subNode: XmlNode) => {
        if (typeof subNode === "string") return;
        const subName = subNode.name.toLowerCase();

        if (subName === "w:t") {
          paraText += getMergedText(subNode);
        } else if (subName === "m:omath" || subName === "m:omathpara") {
          const latex = ommlToLatex(subNode);
          if (latex && latex.trim()) {
            paraText += ` $${latex.trim()}$ `;
          }
        } else if (subName === "w:drawing" || subName === "v:imagedata" || subName === "pic:pic") {
          const relIds = findImageRelIds(subNode, []);
          for (const relId of relIds) {
            if (imagesMap[relId]) {
              paraText += ` <img src="${imagesMap[relId]}" /> `;
            }
          }
        } else {
          for (const child of subNode.children) {
            if (typeof child !== "string") {
              processParaChildren(child);
            }
          }
        }
      };

      for (const child of node.children) {
        if (typeof child !== "string") {
          processParaChildren(child);
        }
      }

      if (paraText.trim()) {
        documentText += paraText + "\n";
      }
    } else {
      for (const child of node.children) {
        if (typeof child !== "string") {
          walkDocument(child);
        }
      }
    }
  };

  parsedDocs.forEach(n => walkDocument(n));
  return documentText;
}

// API Route for Parsing Exams - Runs Rule-Based Non-AI Parser exclusively
app.post("/api/parse-exam", async (req, res): Promise<any> => {
  const { fileBase64, fileType, textPlain, maxQuestions, examPreset } = req.body;
  const limit = maxQuestions ? Number(maxQuestions) : 50;

  try {
    let extractedText = "";

    if (textPlain) {
      extractedText = textPlain;
    } else if (fileBase64 && fileType) {
      const fileBuffer = Buffer.from(fileBase64, "base64");
      const ext = fileType.toLowerCase();

      if (ext === "txt" || ext === "tex") {
        extractedText = fileBuffer.toString("utf8");
      } else if (ext === "docx") {
        try {
          extractedText = await parseDocxMathAndImages(fileBuffer);
        } catch (err) {
          console.error("Custom JSZip docx parser error:", err);
          throw new Error("Không thể phân tách tệp .docx. Vui lòng đảm bảo tệp tin Word không bị mã hóa hoặc lỗi cấu trúc.");
        }
      } else if (ext === "pdf") {
        try {
          const pdfParseModule = (await import("pdf-parse")) as any;
          if (pdfParseModule && typeof pdfParseModule.PDFParse === "function") {
            const parser = new pdfParseModule.PDFParse({ data: fileBuffer });
            const result = await parser.getText();
            extractedText = result.text || "";
            await parser.destroy();
          } else {
            const pdfParseInstance = pdfParseModule.default || pdfParseModule;
            const pdfData = await pdfParseInstance(fileBuffer);
            extractedText = pdfData.text || "";
          }
        } catch (err) {
          console.error("PDF parse error:", err);
          throw new Error("Lỗi đọc file PDF: Vui lòng sử dụng tệp PDF dạng chữ hoặc bản lưu từ Word.");
        }
      } else {
        throw new Error("Định dạng file không hỗ trợ để phân tách hệ thống: " + ext);
      }
    } else {
      throw new Error("Không có dữ liệu văn bản hoặc tệp tin để tiến hành phân tách.");
    }

    console.log(`⚡ Phân tách đề thi KHÔNG DÙNG AI (${fileType || "văn bản"}). Chiều dài văn bản: ${extractedText.length} ký tự.`);
    const finalQuestions = parseExamDeterministic(extractedText, fileType || "txt", examPreset);

    return res.json({
      success: true,
      source: "non_ai_deterministic",
      questions: finalQuestions.slice(0, limit)
    });

  } catch (error: any) {
    console.error("❌ Lỗi xảy ra khi xử lý đề thi:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to process the uploaded file."
    });
  }
});

// API Route for Analyzing Student Performance and Generating AI Evaluation
app.post("/api/assess-student", async (req, res): Promise<any> => {
  const { studentName, studentEmail, history } = req.body;

  try {
    const ai = getGeminiClient();
    const historyText = (history || []).map((h: any, idx: number) => 
      `${idx + 1}. Đề thi: "${h.examTitle}" - Điểm số: ${h.score}/${h.totalPoints} - Số lần chuyển tab (Proctor): ${h.violations || 0} lần`
    ).join("\n");

    if (!ai) {
      // Fallback rule-based smart evaluation if API Key is not set
      let totalScoreRatio = 0;
      let totalViolations = 0;
      (history || []).forEach((h: any) => {
        totalScoreRatio += h.totalPoints > 0 ? (h.score / h.totalPoints) : 0;
        totalViolations += h.violations || 0;
      });
      const avgRatio = (history || []).length > 0 ? (totalScoreRatio / (history || []).length) : 0.5;
      
      let grade = "Cần cố gắng";
      let summary = "Học sinh cần dành nhiều thời gian hơn để rèn luyện phương pháp làm bài.";
      let strengths = ["Có tinh thần tự giác hoàn thành bài thi tương đối đầy đủ."];
      let weaknesses = ["Còn hổng nhiều kiến thức nền tảng trọng tâm.", "Hay bỡ ngỡ trước các dạng bài phân loại."];
      let recommendations = ["Thường xuyên xem lại phần giải thích chi tiết câu hỏi.", "Đặt mục tiêu làm các bài tập tự luyện 15 phút hàng ngày."];

      if (avgRatio >= 0.8) {
        grade = "Xuất sắc";
        summary = `Học sinh ${studentName} nắm vững toàn bộ kiến thức nâng cao, tư duy logic nhạy bén và xử lý xuất sắc các bài tập phức tạp.`;
        strengths = ["Nắm cực kỳ chắc kiến thức nền tảng.", "Tư duy giải toán nhanh, chính xác cao.", "Luôn chấp hành nghiêm túc quy chế phòng thi trực tuyến."];
        weaknesses = ["Đôi khi còn chủ quan ở một vài câu hỏi lý thuyết cơ bản ban đầu."];
        recommendations = ["Nhắm tới các đề thi thử định kỳ 90 phút cấu trúc THPT nâng cao.", "Thử sức với các chuyên đề điểm 10."];
      } else if (avgRatio >= 0.65) {
        grade = "Khá";
        summary = `Học sinh ${studentName} tiếp thu bài tốt, kỹ năng giải toán cơ bản và vận dụng trung bình rất vững vàng. Tuy nhiên cần rèn thêm độ chính xác khi rút gọn công thức.`;
        strengths = ["Hoàn thành tốt các lớp câu hỏi trắc nghiệm thông hiểu.", "Có ý thức phòng thi tốt, hạn chế tối đa vi phạm proctor."];
        weaknesses = ["Gặp khó khăn ở các câu hỏi mức độ vận dụng cao như bài toán TikZ thực tế hoặc hình học không gian."];
        recommendations = ["Tập trung giải quyết các bài tập 30 phút hàng ngày để tăng phản xạ.", "Học cách phác thảo hình học bằng sơ đồ phác họa nhanh."];
      }

      if (totalViolations > 3) {
        weaknesses.push("Còn hiện tượng xao nhãng hoặc chuyển tab trong phòng thi trực tuyến (Phát hiện bởi phần mềm giám sát).");
        recommendations.push("Cần tập trung cao độ hơn, đóng các tab không liên quan khi làm bài khảo sát.");
      }

      return res.json({
        success: true,
        source: "fallback_evaluator",
        assessment: {
          summary,
          strengths,
          weaknesses,
          recommendations,
          grade
        }
      });
    }

    const systemInstruction = `Bạn là một trợ lý AI Sư phạm cao cấp tích hợp trong hệ thống MathWonder LMS.
Nhiệm vụ của bạn là đưa ra một báo cáo phân tích, đánh giá học thuật định kỳ toàn diện, mang tính khích lệ, sâu sắc và khoa học dựa trên lịch sử thi cử của học sinh này.
Hãy trả về một định dạng JSON sạch sẽ phù hợp với cấu trúc yêu cầu. Viết toàn bộ bằng tiếng Việt lịch sự, chuẩn mực giáo dục Việt Nam.`;

    const promptText = `Hãy phân tích học thuật định kỳ cho học sinh dưới đây:
Tên học sinh: ${studentName}
Email: ${studentEmail}

Lịch sử kết quả làm bài tập và bài thi:
${historyText || "Học sinh chưa làm bài kiểm tra nào gần đây."}

Hãy phân tích kết quả, xu hướng điểm số, và hành vi proctoring (vi phạm chuyển tab) để đưa ra các nhận định chính xác:
1. summary (Tóm tắt tổng quan quá trình - 2-3 câu ngắn gọn chuyên nghiệp).
2. strengths (Danh sách các ưu điểm nổi trội về học lực, kỹ năng, tinh thần).
3. weaknesses (Danh sách các mặt hạn chế cần khắc phục).
4. recommendations (Khuyến nghị chi tiết, cụ thể hướng đi, lộ trình tiếp theo tiếp thu toán học).
5. grade (Một trong các xếp loại học thuật: "Xuất sắc", "Giỏi", "Khá", "Trung bình", "Cần cố gắng").

Nhớ phản hồi JSON sạch sẽ và định dạng đúng theo mô tả Schema.`;

    console.log(`🤖 Đang yêu cầu Gemini phân tích năng lực học tập của ${studentName}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Tóm tắt tổng quan quá trình học tập định kỳ bằng Tiếng Việt." },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Danh sách ưu điểm của học sinh này."
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Danh sách hạn chế phát hiện."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lời khuyên rèn luyện cụ thể."
            },
            grade: { type: Type.STRING, description: "Xếp loại học lực: 'Xuất sắc', 'Giỏi', 'Khá', 'Trung bình', 'Cần cố gắng'" }
          },
          required: ["summary", "strengths", "weaknesses", "recommendations", "grade"]
        }
      }
    });

    const resultText = response.text;
    if (resultText) {
      const parsedData = JSON.parse(resultText.trim());
      return res.json({
        success: true,
        source: "gemini_api",
        assessment: parsedData
      });
    } else {
      throw new Error("Không nhận được kết quả nhận xét từ Gemini.");
    }

  } catch (error: any) {
    console.error("❌ Lỗi xảy ra khi đánh giá học sinh bằng Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate AI evaluation."
    });
  }
});

// Configure Vite or Serve static assets
async function startServer() {
  if (process.env.VERCEL) {
    console.log("☁️ Vercel environment detected - bypassing Express listener and static file serving configuration.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount Vite as middleware
    console.log("🛠️ Starting Express server with Vite in DEVELOPMENT mode on port 3000...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve static files directly from dist folder
    console.log("🚀 Starting Express server in PRODUCTION mode on port 3000...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌍 Server successfully launched at http://localhost:${PORT}`);
  });
}

startServer();

export default app;
