import { useState, useEffect, useRef } from "react";
import { Exam, MonitoringLog } from "../types";
import { Camera, CameraOff, AlertTriangle, ShieldCheck, CheckSquare, Clock, ArrowRight, UserCheck, Shield, Presentation, List, ChevronLeft, ChevronRight } from "lucide-react";
import { TikzRenderer } from "./TikzRenderer";
import { MathRenderer } from "./MathRenderer";

interface StudentAssessmentProps {
  exam: Exam;
  studentName: string;
  studentEmail: string;
  studentId: string;
  onSubmitExam: (responses: Record<string, string>, logs: MonitoringLog[], score: number) => void;
  onExit: () => void;
}

export default function StudentAssessment({ exam, studentName, studentEmail, studentId, onSubmitExam, onExit }: StudentAssessmentProps) {
  const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<MonitoringLog[]>([]);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraActive, setCameraActive] = useState(exam.requireCamera !== false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!presentationMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling if user is navigating questions
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        // Only trigger if focus is not inside text input/textarea
        if (["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName || ""))) return;
        
        e.preventDefault();
        if (e.key === "ArrowLeft") {
          setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "ArrowRight") {
          setCurrentSlideIndex((prev) => Math.min(exam.questions.length - 1, prev + 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presentationMode, exam.questions.length]);

  // Sound effects or logs
  const logEvent = (eventType: 'tab-switch' | 'fullscreen-exit' | 'blur' | 'resume', detail: string) => {
    const newLog: MonitoringLog = {
      timestamp: new Date().toISOString(),
      eventType,
      detail
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Proctoring Event Listeners
  useEffect(() => {
    // 1. Visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logEvent('tab-switch', "Thoát tab bài thi hoặc mở phần mềm khác");
        setWarningMsg("🚨 CẢNH BÁO: Bạn vừa chuyển sang một tab khác! Hệ thống giám sát đã tự động ghi chú lại hoạt động này và báo cáo trực tiếp cho giáo viên.");
      }
    };

    // 2. Window Blur (losing focus)
    const handleBlur = () => {
      logEvent('blur', "Rời tiêu điểm màn hình thi");
      setWarningMsg("🚨 CẢNH BÁO: Bạn đã nhấp chuột ra ngoài cửa sổ thi hoặc dùng phím Alt + Tab! Vui lòng không thực hiện hành vi gian lận.");
    };

    // 3. Fullscreen check
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        logEvent('fullscreen-exit', "Thoát chế độ Toàn Màn Hình");
        setWarningMsg("🚨 CẢNH BÁO GIÁM SÁT: Bạn đã thoát chế độ Toàn Màn Hình. Vui lòng bấm nút 'Vào chế độ Toàn Màn Hình' bên dưới để khóa màn hình làm bài nghiêm túc.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const enterFullscreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          setWarningMsg(null);
          logEvent('resume', "Kích hoạt lại bài thi nghiêm túc");
        })
        .catch((err) => {
          console.error("Không thể kích hoạt Fullscreen", err);
        });
    }
  };

  const handleSelectAnswer = (qId: string, optionLetter: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: optionLetter
    }));
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const calculateScore = () => {
    let totalScore = 0;
    exam.questions.forEach((q) => {
      const studentAns = answers[q.id];
      if (!studentAns) return;

      if (!q.type || q.type === 'multiple_choice') {
        if (studentAns === q.correctAnswer) {
          totalScore += q.points;
        }
      } else if (q.type === 'true_false') {
        // match sub-statements: standard Vietnam Graduation Exam format (a,b,c,d)
        const studentParts = studentAns.split(",");
        const correctParts = (q.correctAnswer || "Đúng,Đúng,Đúng,Đúng").split(",");
        let matchCount = 0;
        for (let i = 0; i < 4; i++) {
          if (studentParts[i] && correctParts[i] && studentParts[i].trim().toLowerCase() === correctParts[i].trim().toLowerCase()) {
            matchCount++;
          }
        }
        let ratio = 0;
        if (matchCount === 1) ratio = 0.1;
        else if (matchCount === 2) ratio = 0.25;
        else if (matchCount === 3) ratio = 0.5;
        else if (matchCount === 4) ratio = 1.0;
        totalScore += q.points * ratio;
      } else if (q.type === 'short_answer') {
        // match trimmed string case-insensitively
        const cleanStudentAns = studentAns.trim().toLowerCase();
        const cleanCorrectAns = (q.correctAnswer || "").trim().toLowerCase();
        if (cleanStudentAns === cleanCorrectAns && cleanCorrectAns !== "") {
          totalScore += q.points;
        }
      } else if (q.type === 'drag_drop') {
        // match matching string ignoring spacing
        const cleanStudentAns = studentAns.trim().toLowerCase().replace(/\s+/g, '');
        const cleanCorrectAns = (q.correctAnswer || "").trim().toLowerCase().replace(/\s+/g, '');
        if (cleanStudentAns === cleanCorrectAns && cleanCorrectAns !== "") {
          totalScore += q.points;
        }
      }
    });
    return Number(totalScore.toFixed(2));
  };

  const handleAutoSubmit = () => {
    const finalScore = calculateScore();
    onSubmitExam(answers, logs, finalScore);
  };

  const executeManualSubmit = () => {
    const finalScore = calculateScore();
    onSubmitExam(answers, logs, finalScore);
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 font-sans relative" ref={containerRef} id="proctored-exam-canvas">
      {/* Proctoring Banner Indicator */}
      <div className="max-w-7xl mx-auto mb-4 flex items-center justify-between bg-indigo-950 border border-indigo-500/30 p-3 rounded-xl">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <div className="text-xs md:text-sm font-medium">
            Phòng Thi Giám Sát Bởi <span className="text-emerald-450 font-semibold">EduGrade Auto-Proctoring</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="hidden sm:inline bg-indigo-900 border border-indigo-500/20 text-indigo-300 py-1 px-2.5 rounded-lg">
            Học viên: <strong className="text-slate-200">{studentName}</strong> ({studentEmail})
          </span>
          {exam.requireCamera !== false ? (
            <button
              onClick={() => setCameraActive(!cameraActive)}
              className={`py-1 px-3.5 rounded-lg flex items-center gap-1.5 transition ${
                cameraActive ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Mô phỏng Camera AI: {cameraActive ? "BẬT" : "TẮT"}</span>
            </button>
          ) : (
            <span className="py-1 px-3.5 bg-slate-800 text-slate-400 rounded-lg flex items-center gap-1.5 border border-slate-700">
              <CameraOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Không yêu cầu ghi hình Camera</span>
            </span>
          )}
        </div>
      </div>

      {warningMsg && (
        <div className="max-w-7xl mx-auto mb-4 bg-red-950 border-2 border-red-500/50 p-4 rounded-xl flex items-start gap-3 text-red-100 animate-bounce" id="proctoring-alert-banner">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs md:text-sm">
            <p className="font-bold">{warningMsg}</p>
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="mt-2.5 px-4 py-1.5 bg-red-650 hover:bg-red-700 rounded-lg text-white font-bold text-xs"
              >
                Vào lại chế độ Toàn Màn Hình Khóa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Layout grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left 3 cols: Questions Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-850 border border-slate-750 p-5 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-755 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-wider uppercase font-extrabold bg-indigo-900/40 text-indigo-400 py-0.5 px-2 rounded-md border border-indigo-500/20">
                    Đang làm bài
                  </span>
                  
                  {/* Presentation Mode Toggle Button */}
                  <button
                    onClick={() => {
                      setPresentationMode(!presentationMode);
                      setCurrentSlideIndex(0);
                    }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                      presentationMode 
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-sm shadow-indigo-950 animate-pulse"
                        : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                    }`}
                    title="Bật/Tắt chế độ trình chiếu từng câu toán học khổ lớn"
                  >
                    <Presentation className="w-3 h-3 text-indigo-405" />
                    <span>{presentationMode ? "Xem bản Dạng Cuộn" : "Trình chiếu Toán Học 🖥️"}</span>
                  </button>
                </div>
                <h1 className="text-lg md:text-xl font-bold text-white mt-11">{exam.title}</h1>
                <p className="text-xs text-slate-400 mt-0.5">{exam.description || "Hãy chọn các đáp án chính xác bên dưới"}</p>
              </div>
              
              <div className="flex items-center gap-4 bg-slate-900 border border-slate-750 px-4 py-2 rounded-xl shrink-0 self-start md:self-center">
                <Clock className="w-4 h-4 text-amber-500" />
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Thời gian còn lại</div>
                  <div className={`text-xl font-mono font-bold ${timeLeft < 180 ? "text-red-400 animate-pulse" : "text-amber-500"}`}>
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>
            </div>

            {/* Questions area - Conditional slider vs normal vertical list */}
            {presentationMode ? (
              /* Presentation Slider View */
              (() => {
                const q = exam.questions[currentSlideIndex];
                if (!q) return <div className="text-center p-8 text-slate-400">Không tìm thấy câu hỏi</div>;
                const idx = currentSlideIndex;

                return (
                  <div className="space-y-6 animate-fadeIn py-2" id={`q-slide-${q.id}`}>
                    {/* Slide Information & Quick Selector Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-750 p-3 rounded-2xl shadow-inner">
                      <div className="text-xs text-indigo-300 font-bold flex items-center gap-2">
                        <span className="bg-indigo-900 text-white font-extrabold text-[9px] px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
                          Trình chiếu slide
                        </span>
                        <span>Câu hỏi {idx + 1} trên tổng số {exam.questions.length}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={currentSlideIndex}
                          onChange={(e) => setCurrentSlideIndex(Number(e.target.value))}
                          className="bg-slate-850 border border-slate-700 text-xs text-slate-200 py-1 px-2.5 rounded-lg font-semibold tracking-wide focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {exam.questions.map((_, sIdx) => (
                            <option key={sIdx} value={sIdx}>
                              Câu {sIdx + 1} {answers[_.id] ? "✓" : "―"}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs bg-indigo-950 text-indigo-300 font-mono font-bold px-2 py-1 rounded-md border border-indigo-500/10">
                          Thang điểm: {q.points}đ
                        </span>
                      </div>
                    </div>

                    {/* Bold immersive slide question card */}
                    <div className="p-6 md:p-8 bg-slate-900/90 border border-indigo-550/20 rounded-2xl space-y-6 shadow-xl relative min-h-[320px] flex flex-col justify-between">
                      <div className="space-y-5">
                        {/* Oversized text with MathRenderer */}
                        <div className="text-lg md:text-xl font-medium leading-relaxed text-slate-100 pb-2">
                          <span className="text-indigo-455 font-black mr-2 text-xl">[Câu {idx + 1}]</span>
                          <MathRenderer text={q.text} />
                        </div>

                        {/* Media Asset Panels: Snagged Image or Tikz drawing side-by-side / centered */}
                        {(q.image || q.tikz) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 p-4 bg-slate-950/20 rounded-xl border border-slate-800">
                            {q.image && (
                              <div className="space-y-1 bg-white hover:bg-slate-50 transition-colors p-2 rounded-xl flex flex-col items-center justify-center">
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">Ảnh chụp / Hình vẽ minh họa từ đề</span>
                                <img src={q.image} alt="Minh họa" className="max-h-56 object-contain rounded-lg shadow-sm" />
                              </div>
                            )}
                            {q.tikz && (
                              <div className="space-y-1 bg-white p-2 rounded-xl flex flex-col items-center justify-center text-slate-900 scale-[0.85] origin-center">
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1">Đồ thị vector tự sinh (TikZ)</span>
                                <TikzRenderer code={q.tikz} readOnly={true} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Display options / input handlers dynamically */}
                        <div className="pt-2">
                          {q.type === 'multiple_choice' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {q.options.map((opt, oIdx) => {
                                const optionLetter = ["A", "B", "C", "D"][oIdx];
                                const isSelected = answers[q.id] === optionLetter;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => handleSelectAnswer(q.id, optionLetter)}
                                    className={`p-4 text-left rounded-2xl text-xs md:text-sm border transition-all flex items-start gap-3.5 cursor-pointer hover:-translate-y-0.5 ${
                                      isSelected
                                        ? "bg-indigo-650 border-indigo-500 text-white shadow-lg shadow-indigo-950"
                                        : "bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-650"
                                    }`}
                                  >
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                                      isSelected ? "bg-white text-indigo-700 border-white" : "bg-slate-900 text-slate-450 border-slate-700"
                                    }`}>
                                      {optionLetter}
                                    </span>
                                    <div className="pt-1.5 font-medium leading-relaxed flex-grow">
                                      <MathRenderer text={opt} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {q.type === 'true_false' && (
                            <div className="space-y-3.5 bg-slate-950/30 p-4 rounded-xl border border-slate-800">
                              <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider pb-1 border-b border-slate-800/50 mb-2">
                                Chọn Đúng / Sai cho từng mệnh đề nhận định bên dưới:
                              </div>
                              <div className="space-y-2.5">
                                {Array.from({ length: 4 }).map((_, oIdx) => {
                                  const statementText = q.options[oIdx] || `Phát biểu ${["a", "b", "c", "d"][oIdx]}`;
                                  const currentAnswers = (answers[q.id] || ",,,").split(",");
                                  const selectedVal = currentAnswers[oIdx] || "";

                                  return (
                                    <div key={oIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                                      <span className="text-xs md:text-sm text-slate-200 font-medium">
                                        <MathRenderer text={statementText} />
                                      </span>
                                      <div className="flex gap-2 shrink-0 justify-end">
                                        {["Đúng", "Sai"].map((val) => {
                                          const isSelected = selectedVal === val;
                                          return (
                                            <button
                                              key={val}
                                              type="button"
                                              onClick={() => {
                                                const nextAns = [...currentAnswers];
                                                nextAns[oIdx] = val;
                                                handleSelectAnswer(q.id, nextAns.join(","));
                                              }}
                                              className={`px-4.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                                                isSelected
                                                  ? val === "Đúng"
                                                    ? "bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-950"
                                                    : "bg-red-650 border-red-550 text-white shadow shadow-red-950"
                                                  : "bg-slate-850 border-slate-750 text-slate-400 hover:bg-slate-750 hover:text-white"
                                              }`}
                                            >
                                              {val}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {q.type === 'drag_drop' && (() => {
                            const leftItems = (q.options || []).filter((_, idx) => idx % 2 === 0);
                            const rightItems = (q.options || []).filter((_, idx) => idx % 2 === 1);
                            const letters = ["A", "B", "C", "D", "E", "F"];
                            
                            const pairingMap: Record<number, string> = {};
                            (answers[q.id] || "").split(",").forEach(item => {
                              const [leftPart, letterPart] = item.trim().split("-");
                              if (leftPart && letterPart) {
                                const leftIdx = parseInt(leftPart, 10) - 1;
                                pairingMap[leftIdx] = letterPart.trim().toUpperCase();
                              }
                            });

                            const handlePairChoiceSelect = (leftIdx: number, letterChoice: string) => {
                              const pairs = (answers[q.id] || "").split(",")
                                .map(p => p.trim())
                                .filter(p => p !== "");
                              
                              const targetPrefix = `${leftIdx + 1}-`;
                              const pairIndex = pairs.findIndex(p => p.startsWith(targetPrefix));
                              const newPair = `${leftIdx + 1}-${letterChoice}`;
                              
                              if (pairIndex !== -1) {
                                if (letterChoice === "") {
                                  pairs.splice(pairIndex, 1);
                                } else {
                                  pairs[pairIndex] = newPair;
                                }
                              } else if (letterChoice !== "") {
                                pairs.push(newPair);
                              }
                              
                              pairs.sort();
                              handleSelectAnswer(q.id, pairs.join(", "));
                            };

                            return (
                              <div className="space-y-4 bg-slate-950/30 p-4 rounded-xl border border-slate-800">
                                <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider pb-1 border-b border-slate-800/50">
                                  Kéo thả Ghép Đôi: Chọn phương án ghép nối chuẩn cho từng khái niệm:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <span className="text-[10px] uppercase font-black tracking-wide text-slate-400 block">Danh sách Khái niệm</span>
                                    {leftItems.map((leftVal, leftIdx) => {
                                      const currentMatchedLetter = pairingMap[leftIdx] || "";
                                      return (
                                        <div key={leftIdx} className="p-3 bg-slate-900 border border-slate-750 rounded-xl space-y-2">
                                          <div className="text-xs text-slate-200 font-semibold">
                                            <span className="font-extrabold text-indigo-400 mr-1.5">{leftIdx + 1}.</span>
                                            <MathRenderer text={leftVal} />
                                          </div>
                                          <div>
                                            <select
                                              value={currentMatchedLetter}
                                              onChange={(e) => handlePairChoiceSelect(leftIdx, e.target.value)}
                                              className="w-full text-xs font-bold bg-slate-950 border border-slate-700 text-slate-200 py-1.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-ellipsis overflow-hidden"
                                            >
                                              <option value="">-- Click chọn định nghĩa phù hợp --</option>
                                              {rightItems.map((_, rIdx) => (
                                                <option key={rIdx} value={letters[rIdx]}>
                                                  Ghép với định nghĩa {letters[rIdx]}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="space-y-3">
                                    <span className="text-[10px] uppercase font-black tracking-wide text-slate-400 block">Danh sách Định nghĩa tương ứng</span>
                                    {rightItems.map((rightVal, rIdx) => (
                                      <div key={rIdx} className="p-2.5 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl flex items-start gap-2.5">
                                        <span className="w-5 h-5 rounded bg-indigo-900 text-white font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-500/10 mt-0.5">
                                          {letters[rIdx]}
                                        </span>
                                        <div className="text-xs text-slate-350">
                                          <MathRenderer text={rightVal} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {answers[q.id] && (
                                  <div className="text-[11px] font-bold text-slate-400 font-mono tracking-wide p-2 bg-slate-900/40 rounded-lg flex items-center gap-1.5 border border-slate-800">
                                    <span>Đáp án đã ghép:</span>
                                    <span className="text-emerald-450 bg-slate-950 px-2 py-0.5 rounded border border-slate-750">{answers[q.id]}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {q.type === 'short_answer' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-450 uppercase pl-1 block">Đáp án của bạn:</label>
                              <input
                                type="text"
                                value={answers[q.id] || ""}
                                onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                                placeholder="Gõ câu trả lời ngắn hoặc số tính toán..."
                                className="w-full text-base bg-slate-950/70 border border-slate-700 text-slate-150 focus:outline-none focus:ring-1 focus:ring-indigo-550 rounded-xl p-3.5 font-mono font-medium"
                              />
                            </div>
                          )}

                          {(!q.type || q.type === 'essay') && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-450 uppercase pl-1 block">Lời giải tự luận:</label>
                              <textarea
                                rows={4}
                                value={answers[q.id] || ""}
                                onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                                placeholder="Hãy viết câu trả lời tự luận chi tiết của bạn..."
                                className="w-full text-xs sm:text-sm bg-slate-950/70 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-550 rounded-xl p-4.5 resize-none font-sans"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Navigation buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
                        <span className="text-[10px] text-slate-500 font-medium">
                          💡 Bàn phím: Nhấn phím <strong className="text-indigo-400 font-black">Mũi tên Trái / Phải</strong> để chuyển slide nhanh!
                        </span>

                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => setCurrentSlideIndex(idx - 1)}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                              idx === 0
                                ? "bg-slate-800/10 border-slate-800 text-slate-600 cursor-not-allowed"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 cursor-pointer"
                            }`}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Câu trước</span>
                          </button>

                          <button
                            type="button"
                            disabled={idx === exam.questions.length - 1}
                            onClick={() => setCurrentSlideIndex(idx + 1)}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                              idx === exam.questions.length - 1
                                ? "bg-slate-800/10 border-slate-800 text-slate-600 cursor-not-allowed"
                                : "bg-indigo-600 border-indigo-550 text-white hover:bg-indigo-700 cursor-pointer"
                            }`}
                          >
                            <span>Bài tiếp</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Original vertical questions list (Upgraded) */
              <div className="space-y-6">
                {exam.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-900/60 border border-slate-780 rounded-xl space-y-3" id={`q-con-${q.id}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded">
                        CÂU HỎI {idx + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium font-mono">({q.points} điểm)</span>
                    </div>
                    
                    {/* LaTeX compile Question Text */}
                    <div className="text-sm md:text-base font-semibold text-slate-100 leading-relaxed">
                      <MathRenderer text={q.text} />
                    </div>

                    {/* Snapshot attached crop image */}
                    {q.image && (
                      <div className="my-3 max-w-full sm:max-w-md bg-white p-2 rounded-xl border border-slate-700 shadow-md">
                        <img src={q.image} alt={`Hình câu ${idx + 1}`} className="max-h-56 object-contain mx-auto" />
                      </div>
                    )}

                    {/* Tikz Diagram Rendering if available */}
                    {q.tikz && (
                      <div className="my-4 max-w-[340px] text-slate-805 bg-white p-2 border border-slate-200 rounded-xl">
                        <TikzRenderer code={q.tikz} readOnly={true} />
                      </div>
                    )}

                    {/* Render options / inputs */}
                    {q.type === 'multiple_choice' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {q.options.map((opt, oIdx) => {
                          const optionLetter = ["A", "B", "C", "D"][oIdx];
                          const isSelected = answers[q.id] === optionLetter;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleSelectAnswer(q.id, optionLetter)}
                              className={`p-3 text-left rounded-xl text-xs md:text-sm border transition flex items-start gap-3 ${
                                isSelected
                                  ? "bg-indigo-650 border-indigo-505 text-white shadow-md shadow-indigo-950"
                                  : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border mt-0.5 ${
                                isSelected ? "bg-white text-indigo-700 border-white" : "bg-slate-900 text-slate-450 border-slate-650"
                              }`}>
                                {optionLetter}
                              </span>
                              <div className="pt-0.5">
                                <MathRenderer text={opt} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'true_false' && (
                      <div className="space-y-3 mt-3 bg-slate-850/50 p-4 rounded-xl border border-slate-700/50">
                        <div className="text-xs text-indigo-405 font-bold uppercase tracking-wider mb-2 pb-1 border-b border-slate-800">
                          Chọn Đúng hoặc Sai cho mỗi phát biểu dưới đây:
                        </div>
                        <div className="space-y-2.5">
                          {Array.from({ length: 4 }).map((_, oIdx) => {
                            const statementText = q.options[oIdx] || `Nhận định ${["a", "b", "c", "d"][oIdx]}`;
                            const currentAnswers = (answers[q.id] || ",,,").split(",");
                            const selectedVal = currentAnswers[oIdx] || "";

                            return (
                              <div key={oIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                                <span className="text-xs md:text-sm text-slate-200 font-medium">
                                  <MathRenderer text={statementText} />
                                </span>
                                <div className="flex gap-2 shrink-0 justify-end">
                                  {["Đúng", "Sai"].map((val) => {
                                    const isSelected = selectedVal === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                          const nextAns = [...currentAnswers];
                                          nextAns[oIdx] = val;
                                          handleSelectAnswer(q.id, nextAns.join(","));
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                          isSelected
                                            ? val === "Đúng"
                                              ? "bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-950"
                                              : "bg-red-650 border-red-550 text-white shadow shadow-red-950"
                                            : "bg-slate-800 border-slate-700 text-slate-350 hover:bg-slate-750 hover:text-white"
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.type === 'drag_drop' && (() => {
                      const leftItems = (q.options || []).filter((_, idx) => idx % 2 === 0);
                      const rightItems = (q.options || []).filter((_, idx) => idx % 2 === 1);
                      const letters = ["A", "B", "C", "D", "E", "F"];
                      
                      const pairingMap: Record<number, string> = {};
                      (answers[q.id] || "").split(",").forEach(item => {
                        const [leftPart, letterPart] = item.trim().split("-");
                        if (leftPart && letterPart) {
                          const leftIdx = parseInt(leftPart, 10) - 1;
                          pairingMap[leftIdx] = letterPart.trim().toUpperCase();
                        }
                      });

                      const handlePairChoiceSelect = (leftIdx: number, letterChoice: string) => {
                        const pairs = (answers[q.id] || "").split(",")
                          .map(p => p.trim())
                          .filter(p => p !== "");
                        
                        const targetPrefix = `${leftIdx + 1}-`;
                        const pairIndex = pairs.findIndex(p => p.startsWith(targetPrefix));
                        const newPair = `${leftIdx + 1}-${letterChoice}`;
                        
                        if (pairIndex !== -1) {
                          if (letterChoice === "") {
                            pairs.splice(pairIndex, 1);
                          } else {
                            pairs[pairIndex] = newPair;
                          }
                        } else if (letterChoice !== "") {
                          pairs.push(newPair);
                        }
                        
                        pairs.sort();
                        handleSelectAnswer(q.id, pairs.join(", "));
                      };

                      return (
                        <div className="mt-3 space-y-4 bg-slate-900 p-4 rounded-xl border border-slate-705">
                          <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider pb-1 border-b border-slate-800/50">
                            Kéo thả Ghép Đôi: Chọn phương án ghép nối chuẩn cho từng khái niệm:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <span className="text-[10px] uppercase font-black tracking-wide text-slate-400 block">Danh sách Khái niệm</span>
                              {leftItems.map((leftVal, leftIdx) => {
                                const currentMatchedLetter = pairingMap[leftIdx] || "";
                                return (
                                  <div key={leftIdx} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                                    <div className="text-xs text-slate-200 font-semibold">
                                      <span className="font-extrabold text-indigo-400 mr-1.5">{leftIdx + 1}.</span>
                                      <MathRenderer text={leftVal} />
                                    </div>
                                    <div>
                                      <select
                                        value={currentMatchedLetter}
                                        onChange={(e) => handlePairChoiceSelect(leftIdx, e.target.value)}
                                        className="w-full text-xs font-bold bg-slate-900 border border-slate-700 text-slate-200 py-1.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-ellipsis overflow-hidden"
                                      >
                                        <option value="">-- Click chọn định nghĩa phù hợp --</option>
                                        {rightItems.map((_, rIdx) => (
                                          <option key={rIdx} value={letters[rIdx]}>
                                            Ghép với định nghĩa {letters[rIdx]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="space-y-3">
                              <span className="text-[10px] uppercase font-black tracking-wide text-slate-400 block">Danh sách Định nghĩa tương ứng</span>
                              {rightItems.map((rightVal, rIdx) => (
                                <div key={rIdx} className="p-2.5 bg-slate-950 border border-dashed border-slate-800 rounded-xl flex items-start gap-2.5">
                                  <span className="w-5 h-5 rounded bg-indigo-900 border border-indigo-500/10 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {letters[rIdx]}
                                  </span>
                                  <div className="text-xs text-slate-350">
                                    <MathRenderer text={rightVal} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {answers[q.id] && (
                            <div className="text-[11px] font-bold text-slate-400 font-mono tracking-wide p-2 bg-slate-950/40 rounded-lg flex items-center gap-1.5 border border-slate-750">
                              <span>Đáp án đã ghép:</span>
                              <span className="text-emerald-450 bg-slate-950 px-2 py-0.5 rounded border border-slate-750">{answers[q.id]}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {q.type === 'short_answer' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={answers[q.id] || ""}
                          onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                          placeholder="Hãy gõ đáp án ngắn hoặc con số tính toán của bạn vào đây..."
                          className="w-full text-sm bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 font-mono font-medium"
                        />
                      </div>
                    )}

                    {(!q.type || q.type === 'essay') && (
                      <div className="mt-3">
                        <textarea
                          rows={3}
                          value={answers[q.id] || ""}
                          onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                          placeholder="Hãy viết câu trả lời tự luận chi tiết của bạn vào đây..."
                          className="w-full text-sm bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 resize-none font-sans"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 col: Proctor Status & Response Sheet */}
        <div className="space-y-4">
          {/* Simulated Proctoring Active Camera feed */}
          {cameraActive ? (
            <div className="bg-slate-850 border border-slate-750 rounded-2xl overflow-hidden shadow-lg p-3 text-center space-y-2 relative" id="camera-simulation-widget">
              <div className="bg-slate-900 aspect-video rounded-xl relative flex items-center justify-center border border-slate-750">
                {/* Simulated scan lines */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent pointer-events-none animate-pulse" />
                <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  LIVE
                </div>
                
                {/* AI tracking indicator */}
                <UserCheck className="w-10 h-10 text-emerald-500/80 shrink-0" />
                
                <div className="absolute bottom-2 inset-x-2 bg-slate-950/80 py-1 px-1.5 rounded-md text-[10px] text-slate-300 pointer-events-none">
                  AI: Phát hiện 01 khuôn mặt định dạng
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Nhân dạng: <strong className="text-indigo-400">{studentName}</strong> (Bảo mật SSL)
              </div>
            </div>
          ) : (
            <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl text-center space-y-2" id="camera-disabled-info-widget">
              <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <CameraOff className="w-4.5 h-4.5 text-slate-400" />
              </div>
              <h5 className="text-xs font-bold text-slate-350">Giám sát Camera đã tắt</h5>
              <p className="text-[10px] text-slate-500 leading-normal">
                Bài kiểm tra này thiết lập không yêu cầu ghi khuôn mặt của học sinh định kỳ. Hãy tự giác trung thực làm bài thi.
              </p>
            </div>
          )}

          {/* Active Proctoring Details counter */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" />
              Sổ tay giám sát trực tuyến
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs py-1 border-b border-slate-750/50">
                <span className="text-slate-450">Tình trạng kết nối</span>
                <span className="text-emerald-400 font-bold">Trực tuyến (Live)</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-slate-750/50">
                <span className="text-slate-450">Tổng số cảnh cáo</span>
                <span className={`font-bold ${logs.filter(l => l.eventType !== 'resume').length > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {logs.filter(l => l.eventType !== 'resume').length} lần
                </span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-slate-450">Toàn màn hình</span>
                <span className={isFullscreen ? "text-emerald-400" : "text-amber-400"}>
                  {isFullscreen ? "Đã khóa" : "Chưa khóa"}
                </span>
              </div>
            </div>
          </div>

          {/* Azota style Response Sheet (Bảng đáp án) */}
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                Phiếu Trả Lời Trắc Nghiệm
              </h3>
              <p className="text-xs text-slate-450 mt-1">Đã hoàn thành {answeredCount}/{totalQuestions} câu</p>
            </div>

            {/* Grid checklist bubbles */}
            <div className="grid grid-cols-5 gap-2 max-h-[180px] overflow-y-auto pr-1">
              {exam.questions.map((q, idx) => {
                const isDone = !!answers[q.id];
                return (
                  <a
                    key={q.id}
                    href={`#q-con-${q.id}`}
                    className={`h-10 rounded-lg flex flex-col items-center justify-center text-xs font-mono font-bold border transition ${
                      isDone
                        ? "bg-indigo-600/35 border-indigo-500 text-indigo-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <span>{idx + 1}</span>
                    <span className="text-[9px] text-white">
                      {answers[q.id] || "?"}
                    </span>
                  </a>
                );
              })}
            </div>

            {/* Submission button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="w-full py-3 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2"
              id="btn-trigger-exam-submit"
            >
              Nộp Bài Thi
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Submit Confirmation Modal Overlay */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="submit-confirm-overlay">
          <div className="bg-slate-850 border border-slate-750 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white">Chắc chắn muốn nộp bài?</h3>
              <p className="text-xs text-slate-400 mt-2">
                Học viên đã trả lời <strong className="text-indigo-400">{answeredCount}/{totalQuestions}</strong> câu hỏi của đề thi. Bạn không thể quay lại sửa đổi đáp án sau khi đã nộp.
              </p>
            </div>

            {totalQuestions - answeredCount > 0 && (
              <div className="p-3 bg-red-950/40 text-red-300 text-xs border border-red-500/20 rounded-xl">
                Bạn còn <strong className="underline">{totalQuestions - answeredCount} câu</strong> chưa điền ý kiến đáp án!
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Tiếp tục làm bài
              </button>
              <button
                onClick={executeManualSubmit}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition shadow-md"
                id="btn-confirm-final-submit"
              >
                Đồng ý Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
