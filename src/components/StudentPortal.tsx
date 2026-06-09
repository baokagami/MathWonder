import React, { useState } from "react";
import { Classroom, Exam, ExamSession, StudentEvaluation } from "../types";
import { 
  GraduationCap, BookOpen, Clock, Activity, FileText, ChevronRight, 
  PlusCircle, CheckCircle2, AlertTriangle, KeyRound, ExternalLink, Award, Sparkles, Brain, CheckSquare, ListTodo,
  Camera, CameraOff
} from "lucide-react";

interface StudentPortalProps {
  classrooms: Classroom[];
  exams: Exam[];
  sessions: ExamSession[];
  evaluations: StudentEvaluation[];
  studentEmail: string;
  studentName: string;
  onJoinClassroom: (code: string) => boolean;
  onTakeExam: (exam: Exam, student: { id: string; name: string; email: string }) => void;
  onLogout: () => void;
}

export default function StudentPortal({
  classrooms,
  exams,
  sessions,
  evaluations,
  studentEmail,
  studentName,
  onJoinClassroom,
  onTakeExam,
  onLogout
}: StudentPortalProps) {
  const [classCode, setClassCode] = useState("");
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinSuccess(null);
    setJoinError(null);

    if (!classCode.trim()) return;

    const joined = onJoinClassroom(classCode.trim().toUpperCase());
    if (joined) {
      setJoinSuccess(`Chúc mừng! Bạn đã tham gia thành công vào lớp học bằng mã code.`);
      setClassCode("");
      setTimeout(() => setJoinSuccess(null), 4000);
    } else {
      setJoinError("Mã lớp học không tồn tại hoặc bạn đã ở trong lớp học này.");
    }
  };

  // Filter classrooms the student is enrolled in
  const studentMyClassrooms = classrooms.filter(c => 
    c.students.some(s => s.email.toLowerCase() === studentEmail.toLowerCase())
  );

  const classroomIds = studentMyClassrooms.map(c => c.id);

  // Filter exams that are active in classrooms the student is in
  const activeExams = exams.filter(e => 
    classroomIds.includes(e.classroomId) && e.status === 'active'
  );

  // Filter simulated demo exams
  const demoExams = exams.filter(e => e.classroomId === "demo" && e.status === 'active');

  // Filter historical mock/completed exams for this student
  const studentSessions = sessions.filter(s => 
    s.studentEmail.toLowerCase() === studentEmail.toLowerCase()
  );

  // Calculate if student has any classrooms that haven't had a periodic exam inside the last 30-45 days
  const myClassroomAlerts: string[] = [];
  studentMyClassrooms.forEach(classroom => {
    const classExams = exams.filter(e => e.classroomId === classroom.id && e.examType === 'periodic');
    const lastClassExam = classExams.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())[0];
    if (lastClassExam) {
      const daysSince = Math.round((Date.now() - new Date(lastClassExam.createdDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 30) {
        myClassroomAlerts.push(`⚠️ Nhắc nhở định kỳ lớp "${classroom.name}": Đã ${daysSince} ngày từ bài trắc nghiệm định kỳ gần nhất. Vui lòng hoàn thành mọi bài tập được giao để rèn luyện kỹ năng!`);
      }
    } else {
      myClassroomAlerts.push(`🔔 Nhắc nhở lộ trình lớp "${classroom.name}": Sắp tới có bài tập khảo sát định kỳ 90 phút (bám sát cấu trúc tốt nghiệp THPT). Hãy chủ động ôn tập!`);
    }
  });

  return (
    <div className="bg-slate-50 min-h-screen p-6 font-sans" id="student-portal-wrapper">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Floating Periodic Exam Notifications Alert */}
        {myClassroomAlerts.length > 0 && (
          <div className="space-y-2">
            {myClassroomAlerts.map((alertMsg, idx) => (
              <div key={idx} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-bold animate-pulse shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{alertMsg}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-emerald-700/50">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                <GraduationCap className="w-4 h-4 text-emerald-300 animate-bounce" />
                CỔNG THI HỌC SINH • HOẠT ĐỘNG KHÁM PHÁ
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-3">Chào, {studentName}!</h1>
              <p className="text-slate-200 text-xs mt-1">
                Kiểm tra an toàn trực tuyến, tự động nộp bài và đồng bộ điểm kiểm định hệ thống MathWonder.
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-xs text-slate-300 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-white/5 truncate max-w-xs block font-mono">
                {studentEmail}
              </span>
              <button 
                onClick={onLogout}
                className="text-[10px] text-red-300 hover:text-red-200 font-bold underline mt-2"
              >
                Đăng xuất tài khoản Google
              </button>
            </div>
          </div>
          
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <GraduationCap className="w-64 h-64" />
          </div>
        </div>

        {/* Message Alert Panel */}
        {joinSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold">{joinSuccess}</span>
          </div>
        )}
        {joinError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="font-bold">{joinError}</span>
          </div>
        )}

        {/* Grid Area - Class JOIN and Active Exams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Join Class and My Classrooms */}
          <div className="space-y-6">
            
            {/* Join Class Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <KeyRound className="w-4.5 h-4.5 text-blue-600" />
                Tham gia lớp học mới
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Nhập mã lớp học (Class Code) do giáo viên MathWonder cung cấp để ghi nhận ghi danh vào danh sách lớp.
              </p>
              
              <form onSubmit={handleJoinClassSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ví dụ: MATH11B3"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  className="grow font-mono font-bold uppercase tracking-wider text-center text-slate-800 border border-slate-200 rounded-lg p-2 bg-slate-50 text-xs outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4.5 h-4.5" /> Gửi
                </button>
              </form>
            </div>

            {/* Enrolled Classrooms */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
                Lớp học đã tham gia ({studentMyClassrooms.length})
              </h3>
              
              {studentMyClassrooms.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  Chưa tham gia lớp học nào. Hãy sử dụng form trên để ghi danh lớp.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {studentMyClassrooms.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-xs sm:text-sm">{c.name}</div>
                        <div className="text-[10px] text-slate-400 hidden sm:block">{c.subject}</div>
                        <div className="text-[9px] text-indigo-600 font-bold mt-1">Giảng viên: {c.teacherName}</div>
                      </div>
                      <span className="font-mono text-[9px] bg-slate-200 text-slate-600 font-black px-2 py-0.5 rounded border border-slate-300/40">{c.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Area - Active Exams & History */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Demo Exams list */}
            {demoExams.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl border border-indigo-500/20 text-white space-y-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5 relative z-10">
                  <h3 className="font-extrabold text-[13px] md:text-sm flex items-center gap-2 text-indigo-200">
                    <Sparkles className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
                    Bài kiểm tra làm thử (Dành cho Học sinh mới đăng ký)
                  </h3>
                  <span className="text-[9px] bg-indigo-950 text-indigo-400 font-extrabold px-2.5 py-0.5 rounded border border-indigo-500/30 uppercase tracking-widest">
                    Demo Practice
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-350 max-w-2xl leading-relaxed relative z-10">
                  Các đề thi mẫu bám sát đề án khảo sát đánh giá tư duy Bách Khoa (TSA 40 câu), khối Bộ Công An (BCA 35 câu), và khối Quân Đội (QĐA 50 câu). Hãy làm thử để xem cách hệ thống chấm điểm và giám sát tab thông minh.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
                  {demoExams.map((exam) => {
                    const alreadyTaken = studentSessions.some(s => s.examId === exam.id);
                    let iconTag = "🎒 THI THỬ";
                    if (exam.title.includes("TSA")) iconTag = "⚡ TSA 40 CÂU";
                    else if (exam.title.includes("BCA")) iconTag = "🛡️ BCA 35 CÂU";
                    else if (exam.title.includes("QĐA")) iconTag = "🎯 QĐA 50 CÂU";

                    return (
                      <div key={exam.id} className="p-4 bg-slate-950/40 border border-slate-800/80 hover:border-indigo-500/30 rounded-2xl flex flex-col justify-between gap-3 transition-all hover:scale-[1.01]">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span className="font-black text-indigo-405 uppercase tracking-wider text-[9px]">{iconTag}</span>
                            <span className="bg-indigo-950 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-800/30 font-mono text-[9px]">
                              {exam.questions.length} câu - {exam.totalPoints}đ
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-200 text-xs md:text-sm line-clamp-1">{exam.title}</h4>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{exam.description}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-900 pt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono"><Clock className="w-3.5 h-3.5" /> {exam.duration} phút</span>
                          <span className="flex items-center gap-1 font-mono text-slate-400">
                            {exam.requireCamera !== false ? (
                              <span className="text-[9px] text-indigo-400 font-bold bg-indigo-950 px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5 border border-indigo-900/40">
                                <Camera className="w-2.5 h-2.5" /> Camera
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5 border border-slate-850">
                                <CameraOff className="w-2.5 h-2.5" /> Không Camera
                              </span>
                            )}
                          </span>
                          
                          {alreadyTaken ? (
                            <span className="text-[10px] bg-indigo-950/60 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-950 font-bold">
                              Đã hoàn thành ✓
                            </span>
                          ) : (
                            <button
                              onClick={() => onTakeExam(exam, { id: `std-${Date.now()}`, name: studentName, email: studentEmail })}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black shadow-md transition flex items-center gap-0.5 shrink-0 cursor-pointer text-center"
                            >
                              Làm bài thử <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Exams list */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                Đề thi trực tuyến đang phát ({activeExams.length})
              </h3>
              
              {activeExams.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  Hiện tại không có đề thi nào đang hoạt động trong các lớp bạn tham gia.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeExams.map((exam) => {
                    const alreadyTaken = studentSessions.some(s => s.examId === exam.id);
                    const classroom = classrooms.find(c => c.id === exam.classroomId);

                    return (
                      <div key={exam.id} className="p-4 border border-blue-100 bg-blue-50/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                            {classroom?.name || "Lớp học"}
                          </span>
                          <h4 className="font-bold text-slate-850 text-sm">{exam.title}</h4>
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {exam.duration} phút</span>
                            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {exam.questions.length} câu hỏi</span>
                            {exam.requireCamera !== false ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                <Camera className="w-2.5 h-2.5" /> Giám sát Camera
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                                <CameraOff className="w-2.5 h-2.5" /> Không yêu cầu Camera
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {alreadyTaken ? (
                            <span className="text-[10px] bg-slate-100 text-slate-450 px-3 py-1.5 rounded-xl border border-slate-200 font-bold block text-center">
                              Đã hoàn thành ✓
                            </span>
                          ) : (
                            <button
                              onClick={() => onTakeExam(exam, { id: `std-${Date.now()}`, name: studentName, email: studentEmail })}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              Làm bài thi <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exam Attempt / Grade History */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-amber-500" />
                Lịch sử & Kết quả thi tập trung ({studentSessions.length})
              </h3>

              {studentSessions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  Bạn chưa có lịch sử thực hiện bài thi nào. Điểm thi sẽ cập nhật ngay khi bạn nộp bài.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2">Đề thi</th>
                        <th className="px-4 py-2">Thời điểm nộp</th>
                        <th className="px-4 py-2 text-center">Lỗi Proctor (Vi phạm)</th>
                        <th className="px-4 py-2 text-right">Điểm hệ số 10</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentSessions.map((session) => {
                        const exam = exams.find(e => e.id === session.examId);
                        const tabSwitches = session.monitoringLogs.filter(l => l.eventType !== 'resume').length;

                        return (
                          <tr key={session.id} className="hover:bg-slate-55/35">
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {exam?.title || "Đề thi MathWonder"}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">
                              {session.submitTime ? new Date(session.submitTime).toLocaleString('vi-VN') : "Đang làm..."}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {tabSwitches > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-204 text-amber-800 font-bold px-2 py-0.5 rounded-lg">
                                  <AlertTriangle className="w-3 h-3 text-amber-500" /> {tabSwitches} lần
                                </span>
                              ) : (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-lg">An toàn ✓</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-blue-600 text-sm">
                              {session.score} / {session.totalPoints}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Student Evaluations Display Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-600 animate-pulse" />
                    Phiếu Nhận Xét & Đánh Giá Năng Lực Định Kỳ từ Giáo Viên ({evaluations.filter(ev => ev.studentEmail.toLowerCase() === studentEmail.toLowerCase()).length})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Báo cáo đánh giá ưu nhược điểm học lực, phương pháp tư duy và hướng dẫn nâng cao điểm thi.</p>
                </div>
              </div>

              {evaluations.filter(ev => ev.studentEmail.toLowerCase() === studentEmail.toLowerCase()).length === 0 ? (
                <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  Chưa có phiếu đánh giá định kỳ nào từ Giáo viên. Phiếu đánh giá sẽ xuất hiện khi nhà trường kết thúc kỳ khảo sát.
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluations
                    .filter(ev => ev.studentEmail.toLowerCase() === studentEmail.toLowerCase())
                    .map((ev) => {
                      const classroom = classrooms.find(c => c.id === ev.classroomId);
                      return (
                        <div key={ev.id} className="p-5 bg-slate-50 border border-slate-150 rounded-2xl space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/50 pb-2.5">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                                Lớp: {classroom?.name || "Lớp học Toán học"}
                              </span>
                              <h4 className="font-extrabold text-xs sm:text-sm text-slate-850 mt-1">Đánh giá năng lực bởi {ev.evaluatorName}</h4>
                              <p className="text-[10px] text-slate-405">Ngày đánh giá: {new Date(ev.createdDate).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-black uppercase rounded-lg border border-emerald-150 shadow-xs flex items-center gap-1.5 self-start sm:self-auto">
                              Xếp loại lực học: {ev.grade}
                            </span>
                          </div>

                          <div className="space-y-3 text-xs leading-relaxed">
                            <div>
                              <p className="font-black text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">Nhận xét tổng quát:</p>
                              <p className="text-slate-650 bg-white p-3 rounded-lg border border-slate-200/60 font-medium">{ev.summary}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 bg-white rounded-lg border border-slate-105">
                                <p className="font-black text-emerald-750 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Ưu điểm nổi bật:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] font-medium pl-1">
                                  {ev.strengths.map((str, sIdx) => (
                                    <li key={sIdx}>{str}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-3 bg-white rounded-lg border border-slate-105">
                                <p className="font-black text-amber-700 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Hạn chế cần khắc phục:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] font-medium pl-1">
                                  {ev.weaknesses.map((weak, wIdx) => (
                                    <li key={wIdx}>{weak}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="p-3.5 bg-indigo-50/50 border border-indigo-150/50 rounded-lg">
                              <p className="font-black text-indigo-900 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                Khuyến nghị lộ trình học tập tối ưu:
                              </p>
                              <ul className="list-decimal list-inside space-y-1 text-indigo-950 text-[11px] font-semibold pl-1">
                                {ev.recommendations.map((rec, rIdx) => (
                                  <li key={rIdx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
