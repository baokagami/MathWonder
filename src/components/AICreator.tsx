import React, { useState } from "react";
import { Question } from "../types";
import { FileUp, Sparkles, BookOpen, AlertCircle, Plus, Trash2, CheckCircle2, RefreshCw, Image, FileImage, Clipboard, Camera, CameraOff } from "lucide-react";
import { TikzRenderer } from "./TikzRenderer";
import { MathRenderer } from "./MathRenderer";
import { parseExamDeterministic } from "../utils/nonAiParser";

interface AICreatorProps {
  classroomId: string;
  onExamCreated: (
    title: string,
    description: string,
    duration: number,
    questions: Question[],
    examType?: 'daily' | 'periodic' | 'custom',
    requireCamera?: boolean
  ) => void;
  onCancel: () => void;
}

export default function AICreator({ classroomId, onExamCreated, onCancel }: AICreatorProps) {
  const [title, setTitle] = useState("Đề kiểm tra định kỳ học phần");
  const [description, setDescription] = useState("Bài kiểm tra được tạo tự động và giám sát trực tuyến.");
  const [duration, setDuration] = useState(45);
  const [requireCamera, setRequireCamera] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");
  const [rawText, setRawText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isApiKeyError, setIsApiKeyError] = useState(false);
  const [examPreset, setExamPreset] = useState<"DAILY_15" | "DAILY_30" | "PERIODIC_90" | "THPT" | "HSA" | "TSA" | "HSCA" | "QĐA" | "BCA" | "CUSTOM">("CUSTOM");
  const [examType, setExamType] = useState<'daily' | 'periodic' | 'custom'>('custom');
  const [maxQuestions, setMaxQuestions] = useState(50);
  const [noAI, setNoAI] = useState(true);
  const [customApiKey, setCustomApiKey] = useState(() => {
    try {
      return localStorage.getItem("mw_custom_gemini_api_key") || "";
    } catch {
      return "";
    }
  });

  const handleCustomApiKeyChange = (val: string) => {
    setCustomApiKey(val);
    try {
      localStorage.setItem("mw_custom_gemini_api_key", val.trim());
    } catch (e) {
      console.error(e);
    }
  };

  const handlePresetChange = (preset: "DAILY_15" | "DAILY_30" | "PERIODIC_90" | "THPT" | "HSA" | "TSA" | "HSCA" | "QĐA" | "BCA" | "CUSTOM") => {
    setExamPreset(preset);
    if (preset === "DAILY_15") {
      setExamType("daily");
      setMaxQuestions(12); // 10 MCQ + 2 Short
      setTitle("Bài tập hàng ngày - 15 phút (10 Trắc nghiệm - 2 Trả lời ngắn)");
      setDescription("Bài tập toán học rèn luyện tốc độ phản xạ 15 phút hàng ngày.");
      setDuration(15);
    } else if (preset === "DAILY_30") {
      setExamType("daily");
      setMaxQuestions(19); // 15 MCQ + 2 TF + 2 Short
      setTitle("Bài tập hàng ngày - 30 phút (15 Trắc nghiệm - 2 Đúng/Sai - 2 Trả lời ngắn)");
      setDescription("Bài ôn luyện hàng ngày 30 phút rèn tư duy chuyên sâu hơn.");
      setDuration(30);
    } else if (preset === "PERIODIC_90") {
      setExamType("periodic");
      setMaxQuestions(22); // THPT style
      setTitle("Bài tập định kỳ - 90 phút (Đề khảo sát chuẩn cấu trúc THPT Quốc gia)");
      setDescription("Bài thi định kỳ phân loại năng lực toán học thời lượng 90 phút.");
      setDuration(90);
    } else if (preset === "THPT") {
      setExamType("periodic");
      setMaxQuestions(22);
      setTitle("Đề thi tốt nghiệp THPT Quốc gia (Mẫu 22 Câu) - Chuẩn cấu trúc");
      setDuration(50);
    } else if (preset === "HSA") {
      setExamType("custom");
      setMaxQuestions(50);
      setTitle("Đề thi Đánh giá năng lực Hà Nội (HSA) - Chuẩn cấu trúc");
      setDuration(60);
    } else if (preset === "TSA") {
      setExamType("custom");
      setMaxQuestions(40);
      setTitle("Đề thi Đánh giá tư duy Bách Khoa TSA (40 câu - 40 Điểm)");
      setDescription("Đề thi bao gồm 25 câu trắc nghiệm (1.0đ/câu), 5 câu mệnh đề đúng/sai (1.0đ/câu), 5 câu hỏi kéo thả (1.0đ/câu) và 5 câu điền đáp án ngắn vào chỗ trống (1.0đ/câu).");
      setDuration(150);
    } else if (preset === "HSCA") {
      setExamType("custom");
      setMaxQuestions(35);
      setTitle("Đề thi thử Đánh giá năng lực TP.HCM (HSCA) - Chuẩn cấu trúc");
      setDuration(45);
    } else if (preset === "QĐA") {
      setExamType("custom");
      setMaxQuestions(50);
      setTitle("Đề thi Đánh giá năng lực Quân Đội QĐA (50 câu - 50 Điểm)");
      setDescription("Đề thi bao gồm 35 câu trắc nghiệm (1.0đ/câu) và 15 câu hỏi điền đáp án tự luận/ngắn (1.0đ/câu).");
      setDuration(120);
    } else if (preset === "BCA") {
      setExamType("custom");
      setMaxQuestions(35);
      setTitle("Đề thi Đánh giá năng lực Bộ Công An BCA (35 câu - 30 Trắc nghiệm, 5 Ngắn)");
      setDescription("Đề thi bao gồm 30 câu trắc nghiệm (0.25đ/câu) và 5 câu trả lời ngắn (0.5đ/câu). Tổng điểm quy chuẩn là 10.0 điểm.");
      setDuration(90);
    } else {
      setExamType("custom");
    }
  };

  // Handler for parsing documents via Gemini API / Fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParsingStatus("Đang đọc tệp tin...");
    setErrorMsg("");

    try {
      const allowedExtensions = ["pdf", "docx", "tex", "txt"];
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        throw new Error("Hệ thống chỉ hỗ trợ định dạng .pdf, .docx, .tex, hoặc .txt");
      }

      setParsingStatus(`Đang chuyển mã hóa file ${file.name}...`);
      
      // Let's read text file directly, or read file as Base64 for file parsing
      const reader = new FileReader();
      
      if (fileExt === "txt" || fileExt === "tex") {
        reader.onload = async (event) => {
          const text = event.target?.result as string;
          setRawText(text);
          await triggerParseAPI(null, fileExt, text, file.name);
        };
        reader.readAsText(file);
      } else {
        // PDF or Word binary files
        reader.onload = async (event) => {
          const base64String = (event.target?.result as string).split(",")[1];
          await triggerParseAPI(base64String, fileExt, null, file.name);
        };
        reader.readAsDataURL(file);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể tải lên hoặc chuyển hóa tệp.");
      setIsParsing(false);
    }
  };

  const triggerParseAPI = async (base64: string | null, type: string, text: string | null, name: string) => {
    setParsingStatus("⚡ Đang trích xuất cấu trúc và phân tách câu hỏi tức thì...");
    setIsApiKeyError(false);
    setErrorMsg("");
    setIsParsing(true);
    
    // Check if we can parse completely client-side in noAI mode
    if (noAI && (text || rawText)) {
      try {
        console.log("⚡ Executing 100% Client-Side deterministic parse in the browser!");
        const finalText = text || rawText;
        const questionsList = parseExamDeterministic(finalText, type, examPreset);
        setQuestions(questionsList.slice(0, maxQuestions ? Number(maxQuestions) : 50));
        setParsingStatus("⚡ Thành công! Đã tách toàn bộ đề thi bằng Trình quét Học thuật trực tiếp (Client-Side).");
        setTimeout(() => setIsParsing(false), 800);
        return;
      } catch (clientErr: any) {
        console.error("Client side parse error:", clientErr);
        // continue to use fetch as backup
      }
    }

    try {
      const res = await fetch("/api/parse-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          fileType: type,
          textPlain: text,
          originalFileName: name,
          maxQuestions: maxQuestions,
          examPreset: examPreset,
          noAI: noAI,
          customApiKey: customApiKey || undefined
        })
      });

      // Special check for Vercel/Static 404 or backend unavailable
      if (res.status === 404 || !res.ok) {
        const textToUse = text || rawText;
        if (textToUse) {
          console.warn("⚠️ Detect 404/static server error. Deploying 100% Client-Side deterministic parse fallback");
          const fallbackQuestions = parseExamDeterministic(textToUse, type, examPreset);
          setQuestions(fallbackQuestions.slice(0, maxQuestions ? Number(maxQuestions) : 50));
          setParsingStatus("⚠️ Chạy Offline (Vercel): Đã tự động đổi sang Trình tách đề Client-Side thành công!");
          setTimeout(() => setIsParsing(false), 1200);
          return;
        }
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        // If they pasted text or we have plain text, fall back even if json parsing fails
        const textToUse = text || rawText;
        if (textToUse) {
          console.warn("⚠️ Server response invalid. Deploying 100% Client-Side parse fallback");
          const fallbackQuestions = parseExamDeterministic(textToUse, type, examPreset);
          setQuestions(fallbackQuestions.slice(0, maxQuestions ? Number(maxQuestions) : 50));
          setParsingStatus("⚠️ Chạy Offline (Vercel): Đã dùng Trình tách đề Client-Side!");
          setTimeout(() => setIsParsing(false), 1000);
          return;
        }
        throw new Error("Không thể giải mã dữ liệu phản hồi từ máy chủ.");
      }

      if (!res.ok) {
        if (data && data.isApiKeyError) {
          setIsApiKeyError(true);
        }
        throw new Error(data?.error || "Lỗi phản hồi từ máy chủ phân tách đề.");
      }

      if (data.success && data.questions) {
        setQuestions(data.questions);
        setParsingStatus("✨ Thành công! Đã tách toàn bộ đề thi.");
        setTimeout(() => setIsParsing(false), 800);
      } else {
        if (data && data.isApiKeyError) {
          setIsApiKeyError(true);
        }
        throw new Error(data?.error || "Không thấy kết quả câu hỏi trả về từ hệ thống băm đề.");
      }
    } catch (err: any) {
      console.error(err);
      
      // Attempt local fallback before displaying error
      const textToUse = text || rawText;
      if (textToUse) {
        try {
          const fallbackQuestions = parseExamDeterministic(textToUse, type, examPreset);
          setQuestions(fallbackQuestions.slice(0, maxQuestions ? Number(maxQuestions) : 50));
          setParsingStatus("⚠️ Chạy Offline (Vercel): Đã dùng Trình tách đề Client-Side!");
          setTimeout(() => setIsParsing(false), 1000);
          return;
        } catch (_) {}
      }

      let formatHelp = "Máy chủ bận hoặc gặp sự cố phân tách đề.";
      if (type === "pdf" || type === "docx") {
        formatHelp = "Máy chủ backend không phản hồi (đặc trưng khi chạy trên Vercel/Static hosting). Đừng lo lắng! Hãy chuyển sang chế độ 'TỐC ĐỘ CAO', copy toàn bộ chữ của đề thi và DÁN TRỰC TIẾP vào bảng dán đề thủ công bên dưới để tự động tách đề 100% bằng Trình tách đề Client-Side!";
      } else {
        formatHelp = err.message || "Máy chủ bận hoặc gặp sự cố phân tách đề. Vui lòng dán đề văn bản bên dưới.";
      }
      
      setErrorMsg(formatHelp);
      setIsParsing(false);
    }
  };

  const handleManualParse = async () => {
    if (!rawText.trim()) {
      setErrorMsg("Vui lòng dán đề thi dạng văn bản hoặc mã nguồn LaTeX để tách.");
      return;
    }
    setIsParsing(true);
    await triggerParseAPI(null, "txt", rawText, "manual-paste.txt");
  };

  // UI actions on generated question set
  const updateQuestionText = (index: number, value: string) => {
    const updated = [...questions];
    updated[index].text = value;
    setQuestions(updated);
  };

  const updateOptionText = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const setCorrectAnswer = (qIndex: number, key: string) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = key;
    setQuestions(updated);
  };

  const setQuestionPoints = (qIndex: number, pts: number) => {
    const updated = [...questions];
    updated[qIndex].points = pts;
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addNewQuestion = () => {
    const newQ: Question = {
      id: `manual-q-${Date.now()}`,
      text: "Câu hỏi mới tự tạo",
      type: "multiple_choice",
      options: ["A. Phương án một", "B. Phương án hai", "C. Phương án ba", "D. Phương án bốn"],
      correctAnswer: "A",
      points: 0.25,
      explanation: "Nhập giải thích chi tiết cho đáp án tại đây."
    };
    setQuestions([...questions, newQ]);
  };

  const handleSaveExam = () => {
    if (questions.length === 0) {
      setErrorMsg("Đề thi chưa có câu hỏi nào. Hãy tải lên tệp đề hoặc tự viết câu hỏi.");
      return;
    }
    onExamCreated(title, description, duration, questions, examType, requireCamera);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm max-w-5xl mx-auto" id="ai-creator-container">
      {/* Head */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            Trình Tạo Đề Thi Tách Câu Tự Động (Azota Portal)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tải lên tài liệu (.docx, .pdf, .tex) và hệ thống của chúng tôi sẽ tự động chia tách câu hỏi cùng đáp án gợi ý.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-slate-400 hover:text-slate-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
          id="btn-cancel-ai-creator"
        >
          Hủy bỏ
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & Doc Upload */}
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Thông tin chung đề thi
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">CẤU TRÚC / KHUNG ĐỀ THI CHUẨN</label>
              <select
                value={examPreset}
                onChange={(e) => handlePresetChange(e.target.value as any)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                id="select-exam-preset"
              >
                <option value="CUSTOM font-bold">Phòng thi Tự do (Custom)</option>
                <option value="DAILY_15">📝 Bài tập hàng ngày - 15 Phút (10 Trắc nghiệm, 2 Ngắn)</option>
                <option value="DAILY_30">📝 Bài tập hàng ngày - 30 Phút (15 Trắc nghiệm, 2 Đúng/Sai, 2 Ngắn)</option>
                <option value="PERIODIC_90">🏫 Bài thi định kỳ - 90 Phút • Cấu trúc chuẩn THPT</option>
                <option value="THPT">Đề mẫu tốt nghiệp THPT (22 câu) • Chuẩn 2025</option>
                <option value="HSA">ĐGNL Hà Nội HSA (50 câu) • Chuẩn ĐHQG</option>
                <option value="TSA">TSA ĐG Tư duy Bách Khoa - 40 Câu (25 Trắc nghiệm, 5 Đúng/Sai, 5 Kéo thả, 5 Điền đáp án)</option>
                <option value="HSCA">Năng lực HSCA (ĐGNL Hồ Chí Minh) • Max 35 câu</option>
                <option value="QĐA">QĐA ĐGNL Quân Đội - 50 Câu (35 Trắc nghiệm, 15 Điền đáp án)</option>
                <option value="BCA">BCA ĐGNL Bộ Công An - 35 Câu (30 Trắc nghiệm, 5 Ngắn)</option>
              </select>
            </div>

            {examPreset === "CUSTOM" && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">SỐ CÂU TỐI ĐA ĐỀ XUẤT</label>
                <input
                  type="number"
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(Math.max(1, Math.min(100, Number(e.target.value))))}
                  min={1}
                  max={100}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-max-questions"
                />
              </div>
            )}

            {examPreset !== "CUSTOM" && (
              <div className="p-2.5 bg-indigo-50/85 text-indigo-900 rounded-lg text-[10px] space-y-1.5 border border-indigo-150">
                <span className="font-bold block uppercase tracking-wide">Quy cách định dạng: {examPreset}</span>
                {examPreset === "DAILY_15" && (
                  <div className="space-y-1 text-slate-705">
                    <p>• Thời gian làm bài: <strong className="text-indigo-950">15 phút</strong> (Bài tập hàng ngày)</p>
                    <p>• <strong className="text-indigo-950">10 câu trắc nghiệm</strong>: 0.8đ / câu (8.0đ)</p>
                    <p>• <strong className="text-indigo-950">2 câu trả lời ngắn</strong>: 1.0đ / câu (2.0đ)</p>
                    <p className="font-bold text-emerald-700">➔ Thang điểm chuẩn hóa: 10.0 điểm</p>
                  </div>
                )}
                {examPreset === "DAILY_30" && (
                  <div className="space-y-1 text-slate-705">
                    <p>• Thời gian làm bài: <strong className="text-indigo-950">30 phút</strong> (Bài tập hàng ngày)</p>
                    <p>• <strong className="text-indigo-950">15 câu trắc nghiệm</strong>: 0.4đ / câu (6.0đ)</p>
                    <p>• <strong className="text-indigo-950">2 câu Đúng / Sai (4 nhận định)</strong>: 1.0đ / câu (2.0đ)</p>
                    <p>• <strong className="text-indigo-950">2 câu trả lời ngắn</strong>: 1.0đ / câu (2.0đ)</p>
                    <p className="font-bold text-emerald-700">➔ Thang điểm chuẩn hóa: 10.0 điểm</p>
                  </div>
                )}
                {examPreset === "PERIODIC_90" && (
                  <div className="space-y-1 text-slate-705">
                    <p>• Thời gian làm bài: <strong className="text-indigo-950">90 phút</strong> (Thi định kỳ chuẩn THPT)</p>
                    <p>• <strong className="text-indigo-950">12 câu trắc nghiệm</strong>: 0.25đ / câu (3.0đ)</p>
                    <p>• <strong className="text-indigo-950">4 câu Đúng/Sai</strong>: 1.0đ / câu (4.0đ)</p>
                    <p>• <strong className="text-indigo-950">6 câu trả lời ngắn</strong>: 0.5đ / câu (3.0đ)</p>
                    <p className="font-bold text-emerald-700">➔ Thang điểm chuẩn hóa: 10.0 điểm</p>
                  </div>
                )}
                {examPreset === "THPT" && (
                  <div className="space-y-1 text-slate-700">
                    <p>• Tổng số: <strong className="text-indigo-900">22 câu hỏi</strong></p>
                    <p>• <strong className="text-indigo-900">12 câu trắc nghiệm</strong>: 0.25đ / câu (3.0đ)</p>
                    <p>• <strong className="text-indigo-900">4 câu Đúng / Sai (4 ý)</strong>: Đúng 1 ý: 0.1đ • 2 ý: 0.25đ • 3 ý: 0.5đ • 4 ý: 1.0đ (4.0đ)</p>
                    <p>• <strong className="text-indigo-900">6 câu trả lời ngắn</strong>: 0.5đ / câu (3.0đ)</p>
                    <p className="font-semibold text-indigo-750">→ Tổng cộng đề thi: đúng 10.0 điểm</p>
                  </div>
                )}
                {examPreset === "HSA" && (
                  <div className="space-y-1 text-slate-700">
                    <p>• Tổng số: <strong className="text-indigo-900">50 câu hỏi</strong></p>
                    <p>• <strong className="text-indigo-900">35 câu trắc nghiệm</strong>: 1.0đ / câu (35.0đ)</p>
                    <p>• <strong className="text-indigo-900">15 câu điền đáp án ngắn</strong>: 1.0đ / câu (15.0đ)</p>
                    <p className="font-semibold text-indigo-750">→ Tổng cộng đề thi: đúng 50.0 điểm</p>
                  </div>
                )}
                {examPreset === "TSA" && (
                  <div className="space-y-1 text-slate-700">
                    <p>• Tổng số: <strong className="text-indigo-900 font-extrabold">40 câu hỏi</strong></p>
                    <p>• <strong className="text-indigo-900">25 câu trắc nghiệm</strong>: 1.0đ / câu (25.0đ)</p>
                    <p>• <strong className="text-indigo-900">5 câu mệnh đề đúng/sai (2-4 ý)</strong>: 1.0đ / câu (5.0đ)</p>
                    <p>• <strong className="text-indigo-900">5 câu hỏi kéo thả</strong>: 1.0đ / câu (5.0đ)</p>
                    <p>• <strong className="text-indigo-900">5 câu trả lời điền đáp án</strong>: 1.0đ / câu (5.0đ)</p>
                    <p className="font-semibold text-indigo-750">→ Tổng cộng đề thi: đúng 40.0 điểm</p>
                  </div>
                )}
                {examPreset === "QĐA" && (
                  <div className="space-y-1 text-slate-700">
                    <p>• Tổng số: <strong className="text-indigo-900 font-extrabold">50 câu hỏi</strong></p>
                    <p>• <strong className="text-indigo-900">35 câu trắc nghiệm</strong>: 1.0đ / câu (35.0đ)</p>
                    <p>• <strong className="text-indigo-900">15 câu điền đáp án ngắn</strong>: 1.0đ / câu (15.0đ)</p>
                    <p className="font-semibold text-indigo-750">→ Tổng cộng đề thi: đúng 50.0 điểm</p>
                  </div>
                )}
                {examPreset === "BCA" && (
                  <div className="space-y-1 text-slate-700">
                    <p>• Tổng số: <strong className="text-indigo-900 font-extrabold">35 câu hỏi</strong></p>
                    <p>• <strong className="text-indigo-900">30 câu trắc nghiệm</strong>: 0.25đ / câu (7.5đ)</p>
                    <p>• <strong className="text-indigo-900">5 câu trả lời ngắn</strong>: 0.5đ / câu (2.5đ)</p>
                    <p className="font-semibold text-teal-800 font-bold">→ Tổng cộng đề thi: đúng 10.0 điểm</p>
                  </div>
                )}
                {examPreset !== "THPT" && examPreset !== "HSA" && examPreset !== "TSA" && examPreset !== "QĐA" && examPreset !== "BCA" && (
                  <p>Cấu hình tối đa cho phép: <strong className="font-black text-indigo-900">{maxQuestions} câu hỏi</strong>.</p>
                )}
                <p className="text-[9px] text-indigo-600 border-t border-indigo-100/50 pt-1">Đề đề xuất sẽ được tự động phân rã & áp đặt thang số điểm trực tiếp.</p>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">TÊN ĐỀ KIỂM TRA</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                id="input-exam-title"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">MÔ TẢ NGẮN</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="input-exam-description"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">THỜI GIAN LÀM BÀI (PHÚT)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="input-exam-duration"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GIÁM SÁT HÌNH ẢNH (CAMERA)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setRequireCamera(true)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    requireCamera
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                  id="btn-camera-required"
                >
                  <Camera className="w-4 h-4 text-indigo-500" />
                  Yêu cầu Camera
                </button>
                <button
                  type="button"
                  onClick={() => setRequireCamera(false)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    !requireCamera
                      ? "bg-slate-100 border-slate-300 text-slate-700 font-bold"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                  id="btn-camera-not-required"
                >
                  <CameraOff className="w-4 h-4 text-slate-400" />
                  Không cần Camera
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {requireCamera 
                  ? "Học sinh bắt buộc phải cấp quyền camera để ghi hình trực tiếp khi làm bài."
                  : "Không yêu cầu camera. Học sinh có thể làm bài trên mọi thiết bị mà không cần ghi hình."
                }
              </p>
            </div>
          </div>

          {/* Doc Upload Zone */}
          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 transition bg-indigo-50/10 p-5 rounded-2xl text-center space-y-3 relative group">
            <input
              type="file"
              accept=".pdf,.docx,.tex,.txt"
              onChange={handleFileUpload}
              disabled={isParsing}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              id="file-exam-upload"
            />
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100 group-hover:scale-105 transition duration-200">
              <FileUp className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Tải lên tệp đề thi (.docx, .pdf, .tex)</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">Dung lượng tối đa: 15MB</p>
            </div>
            <div className="text-[10px] text-slate-400 bg-white border border-slate-100 py-1 px-2.5 rounded-lg inline-block font-bold">
              ⚡ Hệ thống phân tách cấu trúc đề thi tự động (.docx hỗ trợ công thức & hình vẽ)
            </div>
          </div>

          {/* Fallback Paste Box */}
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center justify-between">
              <span>Nhập văn bản thủ công (LaTeX/Text)</span>
              <span className="text-[10px] text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">Khuyên dùng</span>
            </h3>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="VD: Câu 1. Ai là người đầu tiên đặt chân lên Mặt Trăng?&#10;A. Neil Armstrong&#10;B. Yuri Gagarin&#10;C. Buzz Aldrin&#10;D. Michael Collins&#10;Chìa khóa: A"
              rows={5}
              className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              id="textarea-raw-content"
            />
            <button
              onClick={handleManualParse}
              disabled={isParsing || !rawText.trim()}
              className="w-full py-2.5 bg-slate-850 hover:bg-slate-850/90 text-white font-bold text-xs rounded-xl transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
              id="btn-parse-text"
            >
              <FileUp className="w-3.5 h-3.5" />
              Bắt đầu phân tách đề thi tự động
            </button>
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              
              {isApiKeyError && (
                <div className="bg-white/80 p-3 rounded-lg border border-red-200/50 space-y-2 text-[11px] text-slate-700">
                  <p className="font-bold text-slate-800">💡 Giải pháp khắc phục nhanh:</p>
                  <p>Vui lòng chuyển sang dán đề thủ công bằng văn bản hoặc LaTeX ở ô bên dưới để trích xuất đề thi trực tiếp offline.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Split Inspect & Bubble Sheet Config */}
        <div className="lg:col-span-2 space-y-6">
          {isParsing ? (
            <div className="h-96 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 p-8 text-center animate-pulse" id="parsing-loader">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-base font-medium text-slate-700 animate-bounce">{parsingStatus}</p>
              <p className="text-xs text-slate-400 mt-2 max-w-sm">
                Chúng tôi đang trích xuất văn bản từ tài liệu, gửi phân tích cấu trúc toán luận lý học và lập bảng đáp án trắc nghiệm azota tối ưu.
              </p>
            </div>
          ) : questions.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-150 p-8 text-center" id="empty-state-parsing">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-700">Trình xem đề và bảng đáp án Azota</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                Tài liệu tải lên sẽ xuất hiện tại đây dưới dạng các câu hỏi rời rạc. Mỗi câu có thể tùy chỉnh phương án đúng nhanh bằng 1 click.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.length > maxQuestions && (
                <div className="p-3.5 bg-amber-50 text-amber-800 border-2 border-amber-200 rounded-2xl text-xs font-bold leading-relaxed animate-fadeIn">
                  ⚠️ Cảnh báo cấu trúc {examPreset}: Số lượng câu hỏi hiện tại ({questions.length} câu) vượt quá mức giới hạn chuẩn của kỳ thi ({maxQuestions} câu). Hãy cân nhắc xóa bớt {questions.length - maxQuestions} câu nhiễu để đề đạt tiêu chuẩn quy định!
                </div>
              )}

              {/* Question list controls */}
              <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-800 font-medium">
                  💡 Đã tách thành công <span className="font-bold text-sm text-indigo-650">{questions.length}</span> câu hỏi. Bạn có thể thay đổi loại câu hỏi để có bảng câu hỏi (HSA/TSA/HSCA/QĐA) ưng ý nhất.
                </div>
                <button
                  onClick={addNewQuestion}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                  id="btn-add-question-manually"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
                </button>
              </div>

              {/* Loop parsed questions */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {questions.map((q, qIdx) => (
                  <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl relative hover:border-slate-350 transition shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                      <span className="text-xs bg-slate-150 text-slate-700 font-bold px-2.5 py-1 rounded-lg">
                        Câu {qIdx + 1}
                      </span>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Inline Type Switcher */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400 font-bold">Loại câu:</span>
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const updated = [...questions];
                              const nextType = e.target.value as any;
                              updated[qIdx].type = nextType;
                              if (nextType === 'true_false') {
                                updated[qIdx].options = ['Đúng', 'Sai'];
                                updated[qIdx].correctAnswer = 'Đúng';
                                updated[qIdx].points = 1.0;
                              } else if (nextType === 'multiple_choice') {
                                updated[qIdx].options = ['A. Phương án một', 'B. Phương án hai', 'C. Phương án ba', 'D. Phương án bốn'];
                                updated[qIdx].correctAnswer = 'A';
                                updated[qIdx].points = 0.25;
                              } else if (nextType === 'short_answer') {
                                updated[qIdx].options = [];
                                updated[qIdx].correctAnswer = '';
                                updated[qIdx].points = 0.5;
                              } else if (nextType === 'drag_drop') {
                                updated[qIdx].options = ['Khái niệm 1 [Kéo]', 'Định nghĩa 1 [Thả]', 'Khái niệm 2 [Kéo]', 'Định nghĩa 2 [Thả]'];
                                updated[qIdx].correctAnswer = '1-1, 2-2';
                                updated[qIdx].points = 1.0;
                              } else {
                                updated[qIdx].options = [];
                                updated[qIdx].correctAnswer = '';
                                updated[qIdx].points = 1.0;
                              }
                              setQuestions(updated);
                            }}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="multiple_choice">Trắc nghiệm</option>
                            <option value="true_false">Đúng / Sai</option>
                            <option value="short_answer">Trả lời ngắn</option>
                            <option value="drag_drop">Kéo thả ghép nối (TSA)</option>
                            <option value="essay">Tự luận</option>
                          </select>
                        </div>

                        {/* Point Editor */}
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400 font-bold">Điểm:</span>
                          <input
                            type="number"
                            value={q.points}
                            onChange={(e) => setQuestionPoints(qIdx, Number(e.target.value))}
                            step={0.5}
                            min={0}
                            className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center font-bold text-slate-700"
                          />
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => deleteQuestion(qIdx)}
                          className="text-slate-400 hover:text-red-500 py-1 px-1.5 rounded hover:bg-red-50 transition"
                          title="Xóa câu hỏi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question text input edit */}
                    <div className="space-y-1">
                      <textarea
                        value={q.text}
                        onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                        rows={2}
                        className="w-full text-sm font-medium text-slate-800 bg-slate-50 hover:bg-white border hover:border-slate-300 focus:border-indigo-500 border-transparent rounded-lg p-2 resize-none"
                      />
                      {/* Live Math Preview of the Question Text */}
                      <div className="text-xs bg-slate-50/50 text-slate-600 p-2.5 rounded-lg border border-slate-150 mt-1 flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block">Xem trước đề bài & công thức Toán:</span>
                        <div className="text-xs text-slate-800 font-medium">
                          <MathRenderer text={q.text || "(Trống)"} />
                        </div>
                      </div>
                    </div>

                    {/* File Attachment & Clipboard Paste Area for Snapped Question Image */}
                    <div className="p-3 bg-indigo-50/20 border border-indigo-100 rounded-xl space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Image className="w-3.5 h-3.5 text-indigo-600" />
                          Ảnh minh họa đề / cắt hình từ PDF (Tùy chọn):
                        </span>
                        {q.image && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...questions];
                              updated[qIdx].image = undefined;
                              setQuestions(updated);
                            }}
                            className="text-[10px] text-red-500 font-extrabold hover:underline"
                          >
                            Xóa ảnh minh họa
                          </button>
                        )}
                      </div>

                      {q.image ? (
                        <div className="relative group max-w-xs border border-slate-200 rounded-lg overflow-hidden bg-white p-1 shadow-2xs">
                          <img src={q.image} alt="Cắt hình ảnh" className="max-h-36 mx-auto object-contain" />
                          <div className="absolute inset-0 bg-slate-900/10 hover:bg-slate-900/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="bg-white/95 text-slate-800 text-[9px] px-2 py-1 rounded shadow-sm font-bold">Chụp đè / Tải file khác bên dưới</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-medium italic">Chưa chọn ảnh minh họa (Thích hợp cho đồ thị hàm số, hình học không gian, vv.)</div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer shadow-3xs transition">
                          <FileImage className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Tải tệp ảnh</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  const updated = [...questions];
                                  updated[qIdx].image = evt.target?.result as string;
                                  setQuestions(updated);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        <div
                          onPaste={(e) => {
                            const items = e.clipboardData.items;
                            for (let i = 0; i < items.length; i++) {
                              if (items[i].type.indexOf("image") !== -1) {
                                const blob = items[i].getAsFile();
                                if (blob) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    const updated = [...questions];
                                    updated[qIdx].image = evt.target?.result as string;
                                    setQuestions(updated);
                                  };
                                  reader.readAsDataURL(blob);
                                }
                              }
                            }
                          }}
                          tabIndex={0}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-700 border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-bold cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="Hãy click vào ô này rồi nhấn Ctrl+V để dán hình ảnh từ Clipboard"
                        >
                          <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                          <span>Bấm ở đây & dán Ctrl+V ảnh đã chụp cắt (PDF)</span>
                        </div>
                      </div>
                    </div>

                    {/* Options (Only if multiple_choice) */}
                    {q.type === "multiple_choice" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {q.options.map((opt, oIdx) => {
                          const optionPrefix = ["A", "B", "C", "D"][oIdx];
                          return (
                            <div key={oIdx} className="flex items-start gap-2 bg-slate-50/30 p-1.5 rounded-lg border border-slate-100">
                              {/* Option label click acts as selecting CorrectAnswer */}
                              <button
                                onClick={() => setCorrectAnswer(qIdx, optionPrefix)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border mt-0.5 ${
                                  q.correctAnswer === optionPrefix
                                    ? "bg-red-500 border-red-500 text-white"
                                    : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                                }`}
                                title="Click để chọn đây là đáp án đúng"
                              >
                                {optionPrefix}
                              </button>
                              <div className="flex-grow space-y-1">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                                  className="w-full text-xs font-semibold bg-white border border-slate-200 rounded px-2 py-1 text-slate-800"
                                />
                                <div className="text-[10px] text-slate-500 pl-1">
                                  <span className="text-[9px] text-slate-450 uppercase font-bold mr-1">Xem trước:</span>
                                  <MathRenderer text={opt} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Đúng / Sai (Only if true_false) */}
                    {q.type === "true_false" && (() => {
                      const curOptions = q.options && q.options.length >= 4
                        ? q.options
                        : [
                            "a) Mệnh đề nhận định liên can thứ nhất",
                            "b) Mệnh đề nhận định liên can thứ hai",
                            "c) Mệnh đề nhận định liên can thứ ba",
                            "d) Mệnh đề nhận định liên can thứ tư"
                          ];
                      const curAnswers = (q.correctAnswer || "Đúng,Đúng,Đúng,Đúng").split(",");
                      
                      return (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-3">
                          <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                            Cấu hình đáp án Đúng / Sai cho 4 Mệnh đề chi tiết (a, b, c, d):
                          </span>
                          <div className="space-y-2.5">
                            {Array.from({ length: 4 }).map((_, oIdx) => {
                              const statementVal = curOptions[oIdx] || "";
                              const ansVal = curAnswers[oIdx] || "Đúng";
                              
                              return (
                                <div key={oIdx} className="space-y-1 p-2 bg-white rounded-lg border border-slate-200 shadow-3xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-black text-slate-400 shrink-0 capitalize">Mệnh đề {["a", "b", "c", "d"][oIdx]}:</span>
                                    <input
                                      type="text"
                                      value={statementVal}
                                      onChange={(e) => {
                                        const updatedOpts = [...curOptions];
                                        updatedOpts[oIdx] = e.target.value;
                                        
                                        const updatedQ = [...questions];
                                        updatedQ[qIdx].options = updatedOpts;
                                        setQuestions(updatedQ);
                                      }}
                                      placeholder={`Nhận định dạng ${["a", "b", "c", "d"][oIdx]}...`}
                                      className="w-full text-xs font-medium bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-500 outline-none pb-0.5 px-0.5 text-slate-800"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 pt-1 font-mono">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide flex-grow">ĐÁP ÁN ĐÚNG:</span>
                                    {["Đúng", "Sai"].map((choice) => {
                                      const isSelected = ansVal === choice;
                                      return (
                                        <button
                                          key={choice}
                                          type="button"
                                          onClick={() => {
                                            const updatedAns = [...curAnswers];
                                            updatedAns[oIdx] = choice;
                                            
                                            const updatedQ = [...questions];
                                            updatedQ[qIdx].correctAnswer = updatedAns.join(",");
                                            setQuestions(updatedQ);
                                          }}
                                          className={`px-3 py-1 text-[10px] font-black rounded border transition-all ${
                                            isSelected
                                              ? choice === "Đúng"
                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-3xs"
                                                : "bg-red-650 border-red-650 text-white shadow-3xs"
                                              : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-150"
                                          }`}
                                        >
                                          {choice}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Trả lời ngắn (Only if short_answer) */}
                    {q.type === "short_answer" && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Từ khóa đáp án đúng (Học sinh nhập trùng khớp):</span>
                        <input
                          type="text"
                          value={q.correctAnswer}
                          onChange={(e) => setCorrectAnswer(qIdx, e.target.value)}
                          placeholder="VD: x = 12, T = 2 hoặc đáp án bằng chữ..."
                          className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg p-2"
                        />
                      </div>
                    )}

                    {/* Kéo thả ghép nối (Only if drag_drop) */}
                    {q.type === "drag_drop" && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-3">
                        <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                          Cấu hình Khái niệm & Định nghĩa ghép cặp để Kéo - Thả:
                        </span>
                        <div className="space-y-2">
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-450 w-24 shrink-0">
                                {oIdx % 2 === 0 ? `Khái niệm ${Math.floor(oIdx/2) + 1} [Kéo]` : `Định nghĩa ${Math.floor(oIdx/2) + 1} [Thả]`}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                                className="flex-grow text-xs font-semibold bg-white border border-slate-200 rounded px-2 py-1 text-slate-800"
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cặp ghép nối đúng chuẩn (đáp án):</label>
                          <input
                            type="text"
                            value={q.correctAnswer}
                            onChange={(e) => setCorrectAnswer(qIdx, e.target.value)}
                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1"
                            placeholder="Ví dụ: 1-1, 2-2 hoặc đáp án ghép nối..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Tự luận (Only if essay) */}
                    {q.type === "essay" && (
                      <div className="p-3 bg-indigo-50/50 border border-dashed border-indigo-150 rounded-xl text-xs text-indigo-805">
                        📝 Câu hỏi dạng tự luận tự do. Học sinh tiến hành làm bài thi và điền đoạn văn bản đáp án hoặc đính kèm ảnh chụp bản nháp viết tay tại Azota.
                      </div>
                    )}

                    {/* Explanation */}
                    <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-150 mt-1 space-y-1.5">
                      <span className="font-semibold text-slate-500 block">Lời giải chi tiết:</span>
                      <input
                        type="text"
                        value={q.explanation || ""}
                        onChange={(e) => {
                          const updated = [...questions];
                          updated[qIdx].explanation = e.target.value;
                          setQuestions(updated);
                        }}
                        placeholder="Hãy bổ sung lý do / lời giải chi tiết cho đáp án..."
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 font-medium focus:ring-1 focus:ring-indigo-550"
                      />
                      {q.explanation && (
                        <div className="pt-1 px-1.5 pb-1 ml-0.5 border-l-2 border-indigo-400 bg-white/50 text-[11px] text-slate-650 leading-normal">
                          <span className="text-[9px] text-indigo-500 font-extrabold uppercase tracking-wide block mb-0.5">XEM TRƯỚC TOÁN HỌC (LIVE PREVIEW LATEX):</span>
                          <MathRenderer text={q.explanation} />
                        </div>
                      )}
                    </div>

                    {/* Visual TikZ graph illustration if present or requested */}
                    <div className="mt-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Hình minh họa chuyên dụng (Mã vẽ TikZ):</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...questions];
                            if (q.tikz) {
                              updated[qIdx].tikz = undefined;
                            } else {
                              updated[qIdx].tikz = "\\begin{tikzpicture}\n  \\draw[->] (-2,0) -- (2,0) node[right] {$x$};\n  \\draw[->] (0,-2) -- (0,2) node[above] {$y$};\n  \\draw[thick, blue] (-1.5,-1) -- (1.5,1);\n  \\node[below left] at (0,0) {$O$};\n\\end{tikzpicture}";
                            }
                            setQuestions(updated);
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-all"
                        >
                          {q.tikz ? "✕ Gỡ bỏ hình vẽ" : "＋ Thêm hình vẽ bằng TikZ"}
                        </button>
                      </div>

                      {q.tikz !== undefined && (
                        <div className="space-y-2 mt-1">
                          <TikzRenderer
                            code={q.tikz}
                            readOnly={false}
                            onCodeChange={(newCode) => {
                              const updated = [...questions];
                              updated[qIdx].tikz = newCode;
                              setQuestions(updated);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Bottom */}
              <div className="bg-slate-100 p-4 rounded-xl flex items-center justify-between border border-slate-200">
                <div className="text-sm text-slate-600">
                  Tổng điểm đề kiểm tra: <span className="font-bold text-slate-800">{questions.reduce((sum, q) => sum + (q.points || 0), 0)} điểm</span>
                </div>
                <button
                  onClick={handleSaveExam}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl inline-flex items-center gap-2 shadow-md transition"
                  id="btn-complete-ai-exam"
                >
                  <CheckCircle2 className="w-4 h-4" /> Hoàn tất lưu đề kiểm tra
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
