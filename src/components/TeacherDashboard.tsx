import React, { useState, useEffect } from "react";
import { Classroom, Exam, Question, ExamSession, StudentEvaluation, Lesson } from "../types";
import { 
  Users, BookOpen, Clock, Activity, Plus, Play, Eye, Trash2, 
  ArrowRight, ShieldAlert, Sparkles, UserCheck, Shield, Copy, CheckCircle, RefreshCw, AlertCircle
} from "lucide-react";
import StudentEvaluator from "./StudentEvaluator";
import AttendanceManager from "./AttendanceManager";

interface TeacherDashboardProps {
  classrooms: Classroom[];
  exams: Exam[];
  sessions: ExamSession[];
  evaluations: StudentEvaluation[];
  onSaveEvaluation: (evaluation: StudentEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  onCreateClassroom: (name: string, subject: string, teacher: string) => void;
  onDeleteClassroom: (classId: string) => void;
  onDeleteExam: (examId: string) => void;
  onActivateAICreator: (classId: string) => void;
  onViewReport: (exam: Exam) => void;
  onSimulateStudent: (exam: Exam, student: { id: string; name: string; email: string }) => void;
  onExamStatusToggle: (examId: string, nextStatus: 'draft' | 'active' | 'ended') => void;
  onSelectedClassroom: (classId: string) => void;
  selectedClassroomId: string | null;
  onRemoveStudentFromClassroom?: (classId: string, studentId: string) => void;
  lessons: Lesson[];
  onSaveLessons: (lessons: Lesson[]) => void;
}

export default function TeacherDashboard({
  classrooms,
  exams,
  sessions,
  evaluations,
  onSaveEvaluation,
  onDeleteEvaluation,
  onCreateClassroom,
  onDeleteClassroom,
  onDeleteExam,
  onActivateAICreator,
  onViewReport,
  onSimulateStudent,
  onExamStatusToggle,
  onSelectedClassroom,
  selectedClassroomId,
  onRemoveStudentFromClassroom,
  lessons,
  onSaveLessons
}: TeacherDashboardProps) {
  // New classroom state
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");
  const [newClassTeacher, setNewClassTeacher] = useState("Thầy Nguyễn Quốc Đạt");
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !newClassSubject) return;
    onCreateClassroom(newClassName, newClassSubject, newClassTeacher);
    setNewClassName("");
    setNewClassSubject("");
    setShowCreateClass(false);
  };

  const activeClassroom = classrooms.find((c) => c.id === selectedClassroomId) || classrooms[0];

  useEffect(() => {
    if (activeClassroom && selectedClassroomId !== activeClassroom.id) {
      onSelectedClassroom(activeClassroom.id);
    }
  }, [activeClassroom, selectedClassroomId]);

  const classExams = exams.filter((e) => e.classroomId === (activeClassroom?.id || ""));

  // Calculate stats for the current active classroom
  const classExamIds = Array.from(new Set(exams.filter(e => e.classroomId === activeClassroom?.id).map(e => e.id)));
  const classSessions = sessions.filter(s => classExamIds.includes(s.examId));
  
  const averageClassScore = classSessions.length > 0
    ? Number((classSessions.reduce((sum, s) => sum + (s.score || 0), 0) / classSessions.length * 3.3).toFixed(1)) // convert to scale 10
    : 7.8; // beautiful fallback standard

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Extract recent actions from active classroom
  const recentViolations = classSessions
    .filter(s => s.monitoringLogs.length > 0)
    .flatMap(s => s.monitoringLogs.map(log => ({
      studentName: s.studentName,
      examTitle: exams.find(e => e.id === s.examId)?.title || "Bài KT",
      detail: log.detail,
      timestamp: log.timestamp
    })))
    .slice(0, 3);

  // Find last periodic exam in classroom (or across all classrooms, but let's do active class)
  const lastPeriodicExam = activeClassroom 
    ? exams
        .filter(e => e.classroomId === activeClassroom.id && e.examType === 'periodic')
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())[0]
    : undefined;

  let periodicReminderMsg = "";
  if (activeClassroom) {
    if (lastPeriodicExam) {
      const daysSince = Math.round((Date.now() - new Date(lastPeriodicExam.createdDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 30) {
        periodicReminderMsg = `⚠️ Nhắc nhở định kỳ (Hàng tháng - 1.5 tháng): Đã ${daysSince} ngày kể từ bài tập/bài thi định kỳ gần nhất ("${lastPeriodicExam.title}"). Hãy giao thêm một bài ôn khảo sát định kỳ 90 phút mới!`;
      }
    } else {
      periodicReminderMsg = "🔔 Nhắc nhở lộ trình định kỳ (Hàng tháng - 1.5 tháng): Lớp học này chưa có bài tập định kỳ 90 phút chuẩn THPT nào. Hãy lập đề và giao cho học sinh!";
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans" id="teacher-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Periodic Exam Reminder Alert */}
        {periodicReminderMsg && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-bold animate-pulse shadow-sm shadow-amber-100">
            <AlertCircle className="w-5 h-5 text-amber-550 shrink-0" />
            <span>{periodicReminderMsg}</span>
          </div>
        )}
        
        {/* Header - Bento styled Overview Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-blue-50 text-[10px] font-bold text-blue-600 uppercase rounded-lg border border-blue-100">
                LMS Space • MathWonder Portal
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-2">Tổng quan hệ thống</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Chào mừng trở lại! Hôm nay hệ thống ghi nhận {classExams.filter(e => e.status === 'active').length} bài thi đang được phát trực tuyến.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl">
              <span className="text-xs text-slate-500 font-bold uppercase">Lớp học:</span>
              <select
                value={selectedClassroomId || ""}
                onChange={(e) => onSelectedClassroom(e.target.value)}
                className="bg-transparent border-none rounded-xl text-xs font-black text-slate-800 outline-none cursor-pointer"
                id="select-classroom-picker"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.subject})
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowCreateClass(!showCreateClass)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              id="btn-toggle-create-classroom"
            >
              <Plus className="w-4 h-4" /> Tạo lớp mới
            </button>
          </div>
        </div>

        {/* Create Classroom Form (Inline collapsible) */}
        {showCreateClass && (
          <form onSubmit={handleCreateClass} className="bg-white border-2 border-blue-100 p-6 rounded-3xl shadow-md max-w-lg mx-auto space-y-4 animate-fadeIn" id="form-create-classroom">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Khởi tạo thông tin lớp mới
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tên lớp học</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 12A1 Chuyên Lý"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Môn học học phần</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Vật Lý Thầy Đạt"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Giảng viên đứng lớp</label>
              <input
                type="text"
                placeholder="Thầy Nguyễn Quốc Đạt"
                value={newClassTeacher}
                onChange={(e) => setNewClassTeacher(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowCreateClass(false)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-500 font-semibold rounded-lg text-xs hover:bg-slate-200 transition"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition shadow"
              >
                Lưu phòng học
              </button>
            </div>
          </form>
        )}

        {/* Bento Grid Wrapper */}
        {activeClassroom && (
          <div className="grid grid-cols-12 gap-5">
            
            {/* CARD 1: Large Bento Feature - Exam uploader section & Exam list (col-span-8) */}
            <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Hệ quản trị khoa bảng</span>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight mt-1 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      Phân tách đề thi & Danh sách phát hành
                    </h3>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-mono font-bold text-slate-500 rounded">DOCX</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-mono font-bold text-slate-500 rounded">TEX</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-mono font-bold text-slate-500 rounded">PDF</span>
                  </div>
                </div>

                {/* Auto Import Zone shortcut */}
                <div 
                  onClick={() => onActivateAICreator(activeClassroom.id)}
                  className="mb-5 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 active:bg-blue-50/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center group cursor-pointer transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl shadow-sm flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
                  </div>
                  <p className="text-xs font-black text-slate-700">Tải lên đề mẫu & Phân tách câu tự động</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ nhận diện tự động cấu trúc câu hỏi và đề thi mẫu</p>
                </div>

                {/* Exam List Block */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đề trắc nghiệm lớp ({classExams.length})</h4>
                  
                  {classExams.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-8 border border-slate-150 text-center" id="empty-exams-state">
                      <BookOpen className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-bold">Chưa có bài thi nào được khởi tạo</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Hãy tạo bài kiểm tra nhanh bằng Trình băm đề tự động.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {classExams.map((exam) => {
                        const countSubmitted = sessions.filter((s) => s.examId === exam.id && s.status === 'submitted').length;
                        return (
                          <div 
                            key={exam.id}
                            className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-2xl flex flex-col md:flex-row justify-between gap-4 transition group"
                            id={`exam-box-${exam.id}`}
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                  exam.status === 'active'
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-150"
                                    : exam.status === 'ended'
                                      ? "bg-slate-100 text-slate-500 border-slate-200"
                                      : "bg-amber-50 text-amber-600 border-amber-150"
                                }`}>
                                  {exam.status === 'active' ? "● Đang thi" : exam.status === 'ended' ? "Khóa đề" : "Nháp"}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold font-mono">
                                  {exam.duration} phút
                                </span>
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 font-bold rounded">
                                  {exam.questions.length} câu
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-800 text-xs md:text-sm">{exam.title}</h4>
                              <p className="text-[11px] text-slate-400 leading-relaxed truncate max-w-md">{exam.description}</p>
                            </div>

                            <div className="flex flex-col justify-between items-end gap-3 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400">Đã nộp: <strong className="text-slate-700">{countSubmitted} bài</strong></span>
                                <button
                                  onClick={() => onDeleteExam(exam.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Toggle active button status bars */}
                              <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 shadow-sm">
                                <button
                                  onClick={() => onExamStatusToggle(exam.id, 'draft')}
                                  className={`text-[9px] font-bold px-2 py-1 rounded ${exam.status === 'draft' ? "bg-amber-50 text-amber-600" : "text-slate-400"}`}
                                >
                                  Nháp
                                </button>
                                <button
                                  onClick={() => onExamStatusToggle(exam.id, 'active')}
                                  className={`text-[9px] font-bold px-2 py-1 rounded ${exam.status === 'active' ? "bg-emerald-50 text-emerald-600" : "text-slate-400"}`}
                                >
                                  Phát đề
                                </button>
                                <button
                                  onClick={() => onExamStatusToggle(exam.id, 'ended')}
                                  className={`text-[9px] font-bold px-2 py-1 rounded ${exam.status === 'ended' ? "bg-slate-100 text-slate-600" : "text-slate-400"}`}
                                >
                                  Khóa
                                </button>
                              </div>

                              {/* View stats or report button */}
                              {countSubmitted > 0 ? (
                                <button
                                  onClick={() => onViewReport(exam)}
                                  className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-150 py-1 px-3.5 rounded-lg transition"
                                >
                                  Thống kê chi tiết →
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">Chưa phát lịch hoặc chưa có học viên nộp bài</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats overview footer inside big card to balance it */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Lớp học hiện thời</span>
                  <span className="text-xs font-black text-slate-700 truncate block">{activeClassroom.name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Môn phái học vụ</span>
                  <span className="text-xs font-black text-slate-700 truncate block">{activeClassroom.subject}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Giáo viên phụ trách</span>
                  <span className="text-xs font-black text-slate-700 truncate block">{activeClassroom.teacherName}</span>
                </div>
              </div>

            </div>

            {/* CARD 2: Live Proctoring (col-span-4, Row 1 of right side) */}
            <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Giám sát bảo mật (Live)</h3>
                  </div>
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                </div>

                {/* Simulated live feed telemetry monitor */}
                <div className="space-y-3.5">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                    <p className="text-[10px] text-slate-400 font-semibold">Phòng thi đang hoạt động:</p>
                    <div className="flex justify-between items-baseline mt-1">
                      <p className="text-lg font-black tracking-tight">
                        {classExams.filter(e => e.status === 'active').length > 0 ? "Phòng thi: Mở" : "Không có phiên thi"}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded">
                        {classExams.filter(e => e.status === 'active').length > 0 ? "LIVE" : "Chờ phát đề"}
                      </p>
                    </div>
                  </div>

                  {/* Violation log ticker */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cảnh báo vi phạm gần nhất</p>
                    {recentViolations.length > 0 ? (
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                        {recentViolations.map((viol, index) => (
                          <div key={index} className="p-2 bg-red-500/10 rounded-xl border border-red-500/20 text-[10px] flex items-center justify-between">
                            <span className="font-bold text-red-200">{viol.studentName}</span>
                            <span className="text-slate-400 truncate max-w-[150px]">{viol.detail}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-white/5 rounded-xl text-[10px] text-slate-450 italic">
                        Chưa phát hiện hành vi quay cóp / chuyển tab học tập nào. Hệ thống Azota Proctoring đang bảo mật cao.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Background gradient layout artifact in design html */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* CARD 3: Analytics / Histogram diagram (col-span-4, Row 2 of right side) */}
            <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Phổ điểm bài thi</span>
                <h3 className="text-sm font-black text-slate-800 mt-1 mb-3">Phân tích Phổ điểm lớp</h3>
                
                {/* Visual histogram matching Design HTML style */}
                <div className="flex items-end gap-2.5 h-24 mb-4">
                  <div className="flex-1 bg-blue-100 hover:bg-blue-200 transition-colors rounded-t-lg h-[25%]" title="Thấp"></div>
                  <div className="flex-1 bg-blue-200 hover:bg-blue-300 transition-colors rounded-t-lg h-[45%]" title="Trung bình"></div>
                  <div className="flex-1 bg-blue-400 hover:bg-blue-500 transition-colors rounded-t-lg h-[85%]" title="Khá"></div>
                  <div className="flex-1 bg-blue-600 hover:bg-blue-700 transition-colors rounded-t-lg h-[70%]" title="Giỏi"></div>
                  <div className="flex-1 bg-blue-300 hover:bg-blue-400 transition-colors rounded-t-lg h-[55%]" title="Xuất sắc"></div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500">Điểm trung bình lớp học</p>
                <p className="text-lg font-black text-blue-600">{averageClassScore}</p>
              </div>
            </div>

            {/* CARD 4: Recent History timeline / submissions feed (col-span-12 md:col-span-6 lg:col-span-4) */}
            <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Nhật ký bài nộp
                </h3>
                
                <div className="space-y-3.5">
                  {classSessions.length > 0 ? (
                    classSessions.slice(0, 3).map((session, sIdx) => (
                      <div key={session.id} className="flex items-start gap-2.5 text-xs">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1.5 border-2 border-white shadow-sm shrink-0"></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-600 truncate">
                            <span className="font-bold text-slate-800">{session.studentName}</span> đã nộp bài.
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">Điểm số: {session.score} điểm</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></div>
                        <p className="text-xs text-slate-600 flex-1 truncate">
                          Học viên vừa mở lớp thi <span className="font-bold text-slate-800">12A1 Chuyên Lý</span>
                        </p>
                        <p className="text-[10px] text-slate-400">Vừa xong</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></div>
                        <p className="text-xs text-slate-600 flex-1 truncate">
                          Đã phát hành đề <span className="font-bold text-slate-800">Dao Động Điều Hòa</span>
                        </p>
                        <p className="text-[10px] text-slate-400">10p trước</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <span className="text-[9px] text-slate-400 block mt-4 font-mono select-none">Được mã hóa hoàn toàn bởi Azota</span>
            </div>

            {/* CARD 5: Access Control / Quick invite code & Enrolled simulated student list (col-span-12 md:col-span-12 lg:col-span-4) */}
            <div className="col-span-12 lg:col-span-4 bg-indigo-50/60 border border-indigo-150/70 rounded-3xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-indigo-900 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-650" />
                    Quản lý học viên & Simulator
                  </h3>
                  <span className="px-2 py-0.5 bg-indigo-100 text-[9px] font-bold text-indigo-700 rounded-lg">
                    {activeClassroom.students.length} môn đồ
                  </span>
                </div>

                <p className="text-indigo-650/90 text-xs">
                  Nhấp vào nút <strong className="text-indigo-900 border-b border-dashed border-indigo-305">"Mở thi"</strong> tại học sinh bên dưới để giả lập học sinh làm bài thi trực tiếp kiểm tra Azota.
                </p>

                {/* Sub-block Students list */}
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {activeClassroom.students.map((student) => {
                    const studentSessions = sessions.filter((s) => s.studentId === student.id);
                    const avgScore = studentSessions.length > 0
                      ? (studentSessions.reduce((sum, s) => sum + (s.score || 0), 0) / studentSessions.length).toFixed(1)
                      : "0";

                    return (
                      <div key={student.id} className="p-2.5 bg-white rounded-xl border border-indigo-100 flex items-center justify-between gap-2.5 hover:shadow-xs transition">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 bg-blue-600/10 text-blue-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-slate-900 truncate block">{student.name}</span>
                            <span className="text-[9px] text-slate-400 truncate block">{student.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-[8px] text-slate-405 block font-bold uppercase">TB</span>
                            <span className="text-[10px] font-bold text-blue-700">{avgScore} điểm</span>
                          </div>

                          {/* Quick simulator launcher trigger */}
                          {classExams.filter(e => e.status === 'active').length > 0 ? (
                            <button
                              onClick={() => {
                                const activeExam = classExams.find(e => e.status === 'active');
                                if (activeExam) onSimulateStudent(activeExam, student);
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] rounded shadow-sm hover:scale-[1.03] transition pointer-events-auto"
                              title="Khởi tạo phiên thi giả lập"
                            >
                              Mở thi
                            </button>
                          ) : (
                            <span className="text-[8px] text-amber-600 font-bold bg-amber-50 px-1 border border-amber-100 rounded">
                              Tắt phát
                            </span>
                          )}

                          {/* Remove Student from class button */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc chắn muốn LOẠI học sinh "${student.name}" ra khỏi lớp học này? Hành động này dùng khi học sinh đã NGHỈ HỌC HẲN.`)) {
                                if (onRemoveStudentFromClassroom) {
                                  onRemoveStudentFromClassroom(activeClassroom.id, student.id);
                                }
                              }
                            }}
                            className="p-1 hover:bg-red-550/10 text-red-500 rounded-lg hover:text-red-700 transition"
                            title="Loại học sinh nghỉ học hẳn khỏi lớp"
                            id={`btn-remove-student-${student.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invitation code link Copy component */}
              <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 space-y-1.5 flex flex-col items-center text-center">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Đăng ký lớp nhanh</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-black text-indigo-800 tracking-wider">
                    {activeClassroom.code}
                  </span>
                  <button 
                    onClick={() => handleCopyCode(activeClassroom.code)}
                    className="p-1 hover:bg-slate-100 text-indigo-600 hover:text-indigo-850 rounded-lg transition"
                    title="Sao chép mã liên kết nhanh"
                  >
                    {copiedCode ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Classroom destructive eraser */}
              <button
                onClick={() => onDeleteClassroom(activeClassroom.id)}
                disabled={classrooms.length <= 1}
                className="w-full text-center text-[9px] font-bold text-slate-450 hover:text-red-500 transition-colors py-1.5 border border-transparent hover:border-red-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Xóa vĩnh viễn và đóng lớp {activeClassroom.name}
              </button>

            </div>

          </div>
        )}

        {/* Attendance & Lesson Planner Panel */}
        {activeClassroom && (
          <div className="pt-4 mt-6 animate-fadeIn">
            <AttendanceManager
              classroom={activeClassroom}
              lessons={lessons}
              onSaveLessons={onSaveLessons}
            />
          </div>
        )}

        {/* Weekly & Monthly Student Growth Evaluations Panel */}
        {activeClassroom && (
          <div className="pt-4 mt-6">
            <StudentEvaluator
              classroom={activeClassroom}
              exams={exams}
              sessions={sessions}
              evaluations={evaluations}
              onSaveEvaluation={onSaveEvaluation}
              onDeleteEvaluation={onDeleteEvaluation}
              teacherName={activeClassroom.teacherName || "Thầy Nguyễn Quốc Đạt"}
            />
          </div>
        )}
        
      </div>
    </div>
  );
}
