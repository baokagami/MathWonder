import { useState } from "react";
import { Exam, ExamSession, Question } from "../types";
import { LineChart, BarChart, Trophy, AlertTriangle, CheckCircle, XCircle, Search, ClipboardList, TrendingUp, AlertOctagon, User, BookOpen, Clock, Mail } from "lucide-react";
import { TikzRenderer } from "./TikzRenderer";
import { MathRenderer } from "./MathRenderer";

interface ExamReportProps {
  exam: Exam;
  sessions: ExamSession[];
  onBack: () => void;
}

export default function ExamReport({ exam, sessions, onBack }: ExamReportProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);

  const totalPossiblePoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  const totalSubmissions = sessions.length;
  
  // Calculate analytics
  const scores = sessions.map(s => s.score || 0);
  const averageScore = scores.length > 0 
    ? Number((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1)) 
    : 0;

  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // Proctoring Violations count tracker
  const totalViolations = sessions.reduce((sum, s) => {
    const violationLogs = s.monitoringLogs.filter(l => l.eventType !== 'resume');
    return sum + violationLogs.length;
  }, 0);

  // Filter students
  const filteredSessions = sessions.filter(session => 
    session.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6" id="exam-report-view">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-indigo-650 hover:text-indigo-800 font-semibold mb-2 flex items-center gap-1 bg-white hover:bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200 shadow-sm transition"
          >
            ← Trở lại danh sách đề thi
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Báo Cáo Chi Tiết Bài Thi: <span className="text-indigo-600">{exam.title}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tổng kết phổ điểm, lịch sử chấm thi tự động và nhật ký giám thị chống gian lận Shub Classroom.
          </p>
        </div>
      </div>

      {/* Classroom Statistics Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Điểm Trung Bình</span>
            <div className="text-2xl font-bold text-slate-850">{averageScore} / {totalPossiblePoints}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Dựa trên {totalSubmissions} lượt làm bài</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-650 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Điểm Cao Nhất</span>
            <div className="text-2xl font-bold text-emerald-600">{highestScore} / {totalPossiblePoints}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Học viên đạt kết quả tốt nhất</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Bài Đã Nộp</span>
            <div className="text-2xl font-bold text-slate-800">{totalSubmissions} bài</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Tỷ lệ hoàn thành: 100%</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cảnh Cáo Khóa Tab</span>
            <div className="text-2xl font-bold text-red-650">{totalViolations} lần</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Hệ thống giám sát Azota tự ghi</p>
          </div>
        </div>
      </div>

      {/* Main Board splitting */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 cols: Student list scoreboard */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-800 text-sm">Danh sách bảng điểm & giám sát</h3>
              
              {/* Search filter */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full sm:w-60 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="p-12 text-center" id="empty-submissions">
                <p className="text-sm text-slate-500 font-medium">Chưa có kết quả học viên tương thích.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-slate-700 text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="py-3 px-4 text-left font-bold text-[10px]">Học Viên</th>
                      <th className="py-3 px-4 text-center font-bold text-[10px]">Điểm Số</th>
                      <th className="py-3 px-4 text-center font-bold text-[10px]">Thời Gian Làm</th>
                      <th className="py-3 px-4 text-center font-bold text-[10px]">Vi Phạm Giám Sát</th>
                      <th className="py-3 px-4 text-center font-bold text-[10px]">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredSessions.map((session) => {
                      const violationCount = session.monitoringLogs.filter(l => l.eventType !== 'resume').length;
                      const hasHighViolations = violationCount >= 3;
                      
                      const timeTaken = session.submitTime 
                        ? Math.max(1, Math.round((new Date(session.submitTime).getTime() - new Date(session.startTime).getTime()) / 60000))
                        : 0;

                      return (
                        <tr key={session.id} className="hover:bg-indigo-50/15 transition">
                          <td className="py-3.5 px-4 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                              {session.studentName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{session.studentName}</div>
                              <div className="text-[10px] text-slate-400">{session.studentEmail}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 py-1 px-2.5 rounded-lg">
                              {session.score} / {totalPossiblePoints}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500">
                            {timeTaken} phút
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                              violationCount === 0 
                                ? "bg-emerald-50 text-emerald-600" 
                                : hasHighViolations 
                                  ? "bg-red-50 text-red-650 border border-red-200" 
                                  : "bg-amber-50 text-amber-600"
                            }`}>
                              ● {violationCount} lỗi thoát tab
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedSession(session)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-705 text-white font-semibold text-[11px] rounded-lg transition shadow-sm"
                            >
                              Xem Chi Tiết Bài Chấm
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 col: Student Exam Drilldown (Chi tiết chấm bài & Azota cheat audit) */}
        <div className="space-y-4">
          {selectedSession ? (
            <div className="bg-white rounded-2xl border border-indigo-200/80 p-5 shadow-md relative space-y-5 animate-slideUp" id="student-drilldown-widget">
              <button
                onClick={() => setSelectedSession(null)}
                className="absolute top-4 right-4 text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Đóng ×
              </button>
              
              {/* Profile Card */}
              <div>
                <span className="text-[9px] tracking-wider uppercase font-extrabold bg-indigo-50 border border-indigo-250 text-indigo-600 py-0.5 px-2 rounded-md">
                  Chi tiết chấm điểm tự động
                </span>
                <h3 className="font-bold text-slate-800 text-base mt-1.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  {selectedSession.studentName}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedSession.studentEmail}</p>
              </div>

              {/* Quick Results Box */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                <div className="text-center py-1">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Kết quả chấm</div>
                  <div className="text-xl font-bold text-indigo-600">{selectedSession.score} điểm</div>
                </div>
                <div className="text-center py-1 border-l border-slate-205">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Đánh giá</div>
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    {(selectedSession.score || 0) >= (totalPossiblePoints / 2) ? "✅ ĐẠT YÊU CẦU" : "❌ CHƯA ĐẠT"}
                  </div>
                </div>
              </div>

              {/* Proctoring log audit timeline */}
              <div className="space-y-3.5">
                <h4 className="font-bold text-xs text-slate-650 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                  Nhật ký giám giám phòng thi (SHUB Log)
                </h4>
                
                {selectedSession.monitoringLogs.length === 0 ? (
                  <p className="text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Học viên thực thi bài cực kì trung thực, không rời tab.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {selectedSession.monitoringLogs.map((log, lIdx) => (
                      <div key={lIdx} className="p-2 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700 flex items-start gap-1.5">
                        <XCircle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
                        <div>
                          <p className="font-semibold">{log.detail}</p>
                          <span className="text-[9px] text-red-550 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Correct answers detailed list audit */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-650 flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                  Chi tiết đáp án & so sánh key
                </h4>
                
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {exam.questions.map((q, idx) => {
                    const studentAnswer = selectedSession.responses[q.id] || "Không trả lời";
                    let isCorrect = studentAnswer === q.correctAnswer;
                    let tfMatchLabel = "";
                    if (q.type === 'short_answer') {
                      isCorrect = studentAnswer.trim().toLowerCase() === (q.correctAnswer || "").trim().toLowerCase();
                    } else if (q.type === 'true_false') {
                      const stdParts = (studentAnswer || "").split(",");
                      const corParts = (q.correctAnswer || "").split(",");
                      let matches = 0;
                      for (let i = 0; i < 4; i++) {
                        if (stdParts[i] && corParts[i] && stdParts[i].toLowerCase().trim() === corParts[i].toLowerCase().trim()) {
                          matches++;
                        }
                      }
                      isCorrect = matches === 4;
                      let partialPoints = 0;
                      if (matches === 1) partialPoints = Number((q.points * 0.1).toFixed(2));
                      else if (matches === 2) partialPoints = Number((q.points * 0.25).toFixed(2));
                      else if (matches === 3) partialPoints = Number((q.points * 0.5).toFixed(2));
                      else if (matches === 4) partialPoints = q.points;

                      tfMatchLabel = ` (Đúng ${matches}/4 ý • +${partialPoints}đ)`;
                    }
                    
                    return (
                      <div key={q.id} className={`p-3 rounded-lg border text-xs space-y-2 ${
                        isCorrect ? "bg-emerald-50/50 border-emerald-150" : "bg-red-50/20 border-red-150"
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700">Câu {idx + 1}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}>
                            {isCorrect ? "Đúng hoàn toàn" : "Chưa đạt tối đa"}{tfMatchLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-650 font-medium leading-relaxed">
                          <MathRenderer text={q.text} />
                        </div>
                        
                        {q.tikz && (
                          <div className="my-2 max-w-[280px] bg-white rounded-lg p-1 border border-slate-100 text-slate-850 scale-[0.9] origin-top-left">
                            <TikzRenderer code={q.tikz} readOnly={true} />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono pt-1">
                          <div>Đã trả lời: <strong className="text-slate-850">{studentAnswer}</strong></div>
                          <div>Đáp án đúng: <strong className="text-emerald-750">{q.correctAnswer}</strong></div>
                        </div>

                        {/* Pedagogical Solution & TikZ Explorer */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100/60 space-y-2">
                          {q.explanation && (
                            <div className="p-2 bg-indigo-50/40 rounded-lg border border-indigo-100/50">
                              <span className="text-[9px] font-extrabold text-indigo-600 block mb-1 uppercase tracking-wider font-sans">💡 Lời giải chi tiết:</span>
                              <div className="text-[11.5px] text-slate-700 leading-relaxed font-normal">
                                <MathRenderer text={q.explanation} />
                              </div>
                            </div>
                          )}


                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback Comment zone */}
              <div className="space-y-2 bg-indigo-50/20 p-2.5 rounded-xl border border-indigo-100">
                <label className="block text-[11px] font-bold text-indigo-600">ĐÁNH GIÁ CỦA GIÁO VIÊN</label>
                <textarea
                  placeholder="Nhập lời phê, ví dụ: Em làm bài khá tốt tuy nhiên còn một vài lỗi thoát tab cần chú ý ở lần thi tuần sau."
                  rows={2}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center" id="quick-tip-card">
              <ClipboardList className="w-10 h-10 text-indigo-300 mx-auto mb-2.5" />
              <h4 className="text-xs font-bold text-slate-600">Chẩn đoán học tập thông minh</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                Bấm nút "Xem Chi Tiết Bài Chấm" bên cạnh danh sách học sinh để mở bảng so chiếu đáp án, kiểm toán lịch sử chống dối trá thi cử và đưa ra lời phê cụ thể.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
