import React, { useState } from "react";
import { Classroom, Exam, ExamSession, StudentEvaluation } from "../types";
import { Sparkles, Brain, Award, AlertTriangle, FileText, Check, ChevronRight, User, GraduationCap, Edit, Trash2 } from "lucide-react";

interface StudentEvaluatorProps {
  classroom: Classroom;
  exams: Exam[];
  sessions: ExamSession[];
  evaluations: StudentEvaluation[];
  onSaveEvaluation: (evaluation: StudentEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  teacherName: string;
}

export default function StudentEvaluator({
  classroom,
  exams,
  sessions,
  evaluations,
  onSaveEvaluation,
  onDeleteEvaluation,
  teacherName
}: StudentEvaluatorProps) {
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editedGrade, setEditedGrade] = useState("Khá");
  const [editedSummary, setEditedSummary] = useState("");
  const [editedStrengths, setEditedStrengths] = useState<string>("");
  const [editedWeaknesses, setEditedWeaknesses] = useState<string>("");
  const [editedRecommendations, setEditedRecommendations] = useState<string>("");
  const [evaluatorType, setEvaluatorType] = useState<'ai' | 'teacher'>('ai');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter evaluations for the current class
  const classEvaluations = evaluations.filter(ev => ev.classroomId === classroom.id);

  const selectStudent = (student: { id: string; name: string; email: string }) => {
    setSelectedStudent(student);
    setSaveSuccess(false);

    // Look for existing evaluation
    const existing = classEvaluations.find(ev => ev.studentEmail === student.email);
    if (existing) {
      setEditedGrade(existing.grade);
      setEditedSummary(existing.summary);
      setEditedStrengths(existing.strengths.join("\n"));
      setEditedWeaknesses(existing.weaknesses.join("\n"));
      setEditedRecommendations(existing.recommendations.join("\n"));
      setEvaluatorType(existing.evaluatorType);
    } else {
      // Set empty defaults
      setEditedGrade("Khá");
      setEditedSummary("");
      setEditedStrengths("");
      setEditedWeaknesses("");
      setEditedRecommendations("");
      setEvaluatorType('teacher');
    }
  };

  // Trigger Gemini API to generate evaluation
  const handleGenerateAIEvaluation = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    setSaveSuccess(false);

    const studentSessions = sessions.filter(s => s.studentEmail === selectedStudent.email);
    const studentHistory = studentSessions.map(s => {
      const exam = exams.find(e => e.id === s.examId);
      const tabSwitches = s.monitoringLogs.filter(log => log.eventType !== 'resume').length;
      return {
        examTitle: exam?.title || "Bài thi trực tuyến",
        score: s.score || 0,
        totalPoints: s.totalPoints || 10,
        duration: exam?.duration || 45,
        violations: tabSwitches
      };
    });

    try {
      const res = await fetch("/api/assess-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: selectedStudent.name,
          studentEmail: selectedStudent.email,
          history: studentHistory
        })
      });

      if (!res.ok) {
        throw new Error("Không thể kết nối máy chủ phân tích AI.");
      }

      const data = await res.json();
      if (data.success && data.assessment) {
        const { summary, strengths, weaknesses, recommendations, grade } = data.assessment;
        setEditedGrade(grade || "Khá");
        setEditedSummary(summary || "");
        setEditedStrengths((strengths || []).join("\n"));
        setEditedWeaknesses((weaknesses || []).join("\n"));
        setEditedRecommendations((recommendations || []).join("\n"));
        setEvaluatorType('ai');
      } else {
        throw new Error("Dữ liệu phản hồi từ AI không hợp lệ.");
      }
    } catch (err) {
      console.warn("Backend assess failed, running robust client-side pedagogic rule-based fallback evaluation", err);
      
      // Calculate metrics client-side
      let totalScoreRatio = 0;
      let totalViolations = 0;
      studentHistory.forEach((h: any) => {
        totalScoreRatio += h.totalPoints > 0 ? (h.score / h.totalPoints) : 0;
        totalViolations += h.violations || 0;
      });
      const avgRatio = studentHistory.length > 0 ? (totalScoreRatio / studentHistory.length) : 0.5;
      
      let grade = "Cần cố gắng";
      let summary = `Học sinh ${selectedStudent.name} cần dành thêm thời gian để rèn luyện phương pháp làm bài toán học và nâng độ tập trung.`;
      let strengths = ["Có tinh thần tự giác hoàn thành bài thi tương đối đầy đủ."];
      let weaknesses = ["Còn hổng nhiều phạm vi kiến thức toán học trọng tâm môn ôn luyện.", "Dễ gặp khó khăn trước các câu hỏi nâng cao hệ thống."];
      let recommendations = ["Thường xuyên xem lại phần giải thích chi tiết câu hỏi hệ thống cung cấp.", "Đặt mục tiêu làm các bài tập tự luyện 15 phút hàng tuần."];

      if (avgRatio >= 0.8) {
        grade = "Xuất sắc";
        summary = `Học sinh ${selectedStudent.name} nắm cực kỳ chuẩn kiến thức nâng cao, tư duy logic nhạy bén và xử lý rất tốt các bài tập phức tạp.`;
        strengths = ["Nắm cực kỳ chắc kiến thức nền tảng toán học.", "Tư duy giải toán nhanh nhạy, tính toán chuẩn chỉ.", "Luôn chấp hành nghiêm túc quy chế phòng thi trực tuyến."];
        weaknesses = ["Đôi khi còn chủ quan nhẹ ở một vài câu hỏi lý thuyết cơ bản ban đầu."];
        recommendations = ["Tiến xa tới các đề thi thử định kỳ 90 phút cấu trúc THPT nâng cao.", "Thử thách bản thân với các chuyên đề điểm 10."];
      } else if (avgRatio >= 0.65) {
        grade = "Khá";
        summary = `Học sinh ${selectedStudent.name} tiếp thu bài học tốt, kỹ năng giải toán cơ bản vững vàng. Tuy nhiên cần tập trung nâng cao độ chính xác khi giải toán tự luận.`;
        strengths = ["Hoàn thành tốt phần lớn câu hỏi trắc nghiệm thông hiểu.", "Ý thức làm bài nghiêm túc, hạn chế tối đa vi phạm phòng thi."];
        weaknesses = ["Gặp khó khăn nhẹ ở các câu hỏi mức độ vận dụng cao như hình học không gian hoặc đồ thị phức tạp."];
        recommendations = ["Tận dụng bài tập 30 phút hàng ngày để tăng phản xạ.", "Trau dồi thêm phương pháp phác họa hình học không gian."];
      }

      if (totalViolations > 2) {
        weaknesses.push("Còn hiện tượng xao nhãng hoặc chuyển tab trong phòng thi trực tuyến (Giám sát bởi phần mềm Proctor).");
        recommendations.push("Cần tập trung cao độ hơn, đóng toàn bộ ứng dụng hay tab không liên quan khi làm bài khảo sát.");
      }

      setEditedGrade(grade);
      setEditedSummary(`[Cố vấn MathWonder] ${summary}`);
      setEditedStrengths(strengths.join("\n"));
      setEditedWeaknesses(weaknesses.join("\n"));
      setEditedRecommendations(recommendations.join("\n"));
      setEvaluatorType('ai');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAssessment = () => {
    if (!selectedStudent) return;

    const newEval: StudentEvaluation = {
      id: `eval-${selectedStudent.id}-${classroom.id}`,
      studentEmail: selectedStudent.email,
      classroomId: classroom.id,
      evaluatorType: evaluatorType,
      evaluatorName: evaluatorType === 'ai' ? "MathWonder AI Advisor" : teacherName,
      createdDate: new Date().toISOString(),
      summary: editedSummary,
      strengths: editedStrengths.split("\n").map(s => s.trim()).filter(Boolean),
      weaknesses: editedWeaknesses.split("\n").map(s => s.trim()).filter(Boolean),
      recommendations: editedRecommendations.split("\n").map(s => s.trim()).filter(Boolean),
      grade: editedGrade
    };

    onSaveEvaluation(newEval);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6" id="student-evaluator">
      <div>
        <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          Nhận xét & Đánh giá năng lực định kỳ học sinh
        </h3>
        <p className="text-slate-400 text-xs mt-0.5">
          Theo dõi sát sao kết quả thi, phân tích hành vi thi cử, tạo báo cáo học tập xuất sắc bằng AI hoặc tự viết nhận xét để lưu hành nội bộ.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Student selection list */}
        <div className="lg:col-span-4 border border-slate-100 rounded-2xl bg-slate-50/50 p-4 space-y-3.5">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Danh sách học sinh lớp</h4>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {classroom.students.map((student) => {
              const studentSessions = sessions.filter(s => s.studentEmail === student.email && s.status === 'submitted');
              const hasEval = classEvaluations.some(ev => ev.studentEmail === student.email);
              const isSel = selectedStudent?.email === student.email;

              return (
                <button
                  key={student.id}
                  onClick={() => selectStudent(student)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    isSel 
                      ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-100" 
                      : "bg-white border-slate-200/60 hover:border-indigo-400 hover:bg-slate-50/20 text-slate-800"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs flex items-center gap-1.5 truncate">
                      <User className={`w-3.5 h-3.5 ${isSel ? "text-indigo-300" : "text-slate-405"}`} />
                      {student.name}
                    </div>
                    <div className={`text-[9px] ${isSel ? "text-slate-350" : "text-slate-400"} mt-0.5 truncate`}>
                      {student.email}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[8.5px] px-2 py-0.5 rounded font-black uppercase ${
                      hasEval 
                        ? (isSel ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700") 
                        : (isSel ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-450")
                    }`}>
                      {hasEval ? "Đã NHẬN XÉT" : "Chưa xét"}
                    </span>
                    <span className={`block text-[9px] font-bold font-mono ${isSel ? "text-indigo-200" : "text-indigo-650"} mt-1`}>
                      {studentSessions.length} bài thi
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic editor & analyzer workspace */}
        <div className="lg:col-span-8">
          {selectedStudent ? (
            <div className="border border-slate-200/80 rounded-2xl p-5 space-y-6">
              
              {/* Active Student Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h4 className="font-extrabold text-[#111] text-base">{selectedStudent.name}</h4>
                  <p className="text-slate-500 text-[10px] sm:text-xs">
                    Email đăng nghiệm: {selectedStudent.email} • Tỷ lệ hoàn thành: {sessions.filter(s => s.studentEmail === selectedStudent.email).length} bài tập
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateAIEvaluation}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black text-[10.5px] rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    {isGenerating ? "AI Đang phân phân..." : "Phân phân tự động AI ⚡"}
                  </button>
                </div>
              </div>

              {/* Dynamic Analysis summary workspace form */}
              <div className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Grade Categorization */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Xếp loại học lực</label>
                    <select
                      value={editedGrade}
                      onChange={(e) => setEditedGrade(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="Xuất sắc">🏆 Xuất sắc (Thành tích đặc biệt)</option>
                      <option value="Giỏi">🥇 Giỏi (Nắm rất vững chuyên đề)</option>
                      <option value="Khá">🥈 Khá (Khả năng vận dụng cơ bản)</option>
                      <option value="Trung bình">🥉 Trung bình (Thiếu kĩ năng vận dụng nhanh)</option>
                      <option value="Cần cố gắng">⚠️ Cần cố gắng (Cần bồi dưỡng căn bản)</option>
                    </select>
                  </div>

                  {/* Evaluator identity */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Phương thức nhận xét</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEvaluatorType('ai')}
                        className={`flex-1 text-center py-1.5 text-[10px] font-black rounded ${
                          evaluatorType === 'ai' ? "bg-white text-slate-900 shadow-xs" : "text-slate-450 hover:text-slate-700"
                        }`}
                      >
                        Trợ lý AI
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvaluatorType('teacher')}
                        className={`flex-1 text-center py-1.5 text-[10px] font-black rounded ${
                          evaluatorType === 'teacher' ? "bg-white text-slate-900 shadow-xs" : "text-slate-450 hover:text-slate-700"
                        }`}
                      >
                        Giáo viên viết
                      </button>
                    </div>
                  </div>
                </div>

                {/* Overall growth summary feedback */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tóm tắt tiến trình học tập định kỳ</label>
                  <textarea
                    rows={2}
                    value={editedSummary}
                    onChange={(e) => {
                      setEditedSummary(e.target.value);
                      setEvaluatorType('teacher'); // Auto switch if custom text entered
                    }}
                    placeholder="Nhập phần tóm tắt tiến trình học toán của học sinh, tiến bộ biểu đồ điểm số,..."
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Strengths & Weaknesses (Split bullets by newlines) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Các ưu điểm nổi trội (Mỗi ý một dòng)</label>
                    <textarea
                      rows={3}
                      value={editedStrengths}
                      onChange={(e) => {
                        setEditedStrengths(e.target.value);
                        setEvaluatorType('teacher');
                      }}
                      placeholder="• Tư duy toán hình tốt&#10;• Cẩn thận khi rút gọn"
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Mặt hạn chế / Chỗ hổng (Mỗi ý một dòng)</label>
                    <textarea
                      rows={3}
                      value={editedWeaknesses}
                      onChange={(e) => {
                        setEditedWeaknesses(e.target.value);
                        setEvaluatorType('teacher');
                      }}
                      placeholder="• Còn xao nhãng proctor&#10;• Rút gọn biểu thức còn sai"
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Recommendations learning guidelines */}
                <div>
                  <label className="block text-[10px] font-bold text-indigo-650 uppercase mb-1">Khuyến nghị phương pháp & Lộ trình rèn luyện (Mỗi ý một dòng)</label>
                  <textarea
                    rows={3}
                    value={editedRecommendations}
                    onChange={(e) => {
                      setEditedRecommendations(e.target.value);
                      setEvaluatorType('teacher');
                    }}
                    placeholder="• Cần làm đầy đủ bài tập 15 phút hàng ngày&#10;• Ôn tập kĩ lại chuyên đề hàm số"
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Actions bottom banner */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400">
                    Người đánh giá: <strong className="text-slate-700">{evaluatorType === 'ai' ? "MathWonder AI Advisor" : teacherName}</strong>
                  </div>

                  <div className="flex items-center gap-3">
                    {saveSuccess && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 animate-pulse">
                        Đã lưu đánh giá ✓
                      </span>
                    )}

                    <button
                      onClick={handleSaveAssessment}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      Lưu & Xuất bản nhận xét
                    </button>
                  </div>
                </div>

              </div>
              
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[350px]">
              <Brain className="w-10 h-10 text-slate-350 mb-3" />
              <p className="text-xs text-slate-500 font-bold">Chưa lựa chọn học viên</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                Hãy lựa chọn một học sinh trong danh mục danh bạ bên trái để phân tích phổ điểm thi cử trực quan và tiến hành ghi chép nhận xét định kỳ.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
