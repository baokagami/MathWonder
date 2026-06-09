import React, { useState } from "react";
import { Classroom, Lesson, LessonAttendance } from "../types";
import { 
  Calendar, Clock, Plus, Check, X, AlertTriangle, UserCheck, 
  BookOpen, Trash2, CalendarDays, ClipboardCheck, Info, FileSpreadsheet
} from "lucide-react";

interface AttendanceManagerProps {
  classroom: Classroom;
  lessons: Lesson[];
  onSaveLessons: (lessons: Lesson[]) => void;
}

export default function AttendanceManager({
  classroom,
  lessons,
  onSaveLessons
}: AttendanceManagerProps) {
  // Local active classroom filtered lessons
  const classroomLessons = lessons
    .filter((l) => l.classroomId === classroom.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // State management for creating a new lesson
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [newType, setNewType] = useState<'fixed' | 'extra'>('fixed');

  // Selected lesson state for recording attendance
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    classroomLessons.length > 0 ? classroomLessons[0].id : null
  );

  const selectedLesson = classroomLessons.find(l => l.id === selectedLessonId);

  // Success message after action
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Create a new lesson schedule
  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    // Check if lesson on the same day already exists
    const duplicate = classroomLessons.find(l => l.date === newDate && l.type === newType);
    if (duplicate && !window.confirm(`Đã tồn tại lịch học loại này vào ngày ${newDate}. Bạn vẫn muốn kiến tạo thêm một buổi học mới?`)) {
      return;
    }

    // Initialize attendance sheet list for all existing classroom students
    const initialAttendance: LessonAttendance[] = classroom.students.map(std => ({
      studentId: std.id,
      status: 'present', // Defaults to Present (Có mặt)
      note: ""
    }));

    const newLesson: Lesson = {
      id: `lesson-${Date.now()}`,
      classroomId: classroom.id,
      date: newDate,
      type: newType,
      topic: newTopic.trim(),
      attendance: initialAttendance,
      createdDate: new Date().toISOString()
    };

    const updatedLessons = [...lessons, newLesson];
    onSaveLessons(updatedLessons);
    setSelectedLessonId(newLesson.id);
    setNewTopic("");
    showStatus(`Đã kiến lập lịch học ngày ${newDate} loại "${newType === 'fixed' ? 'Cố định' : 'Học thêm'}" thành công!`);
  };

  // Delete a lesson session
  const handleDeleteLesson = (lessonId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const target = lessons.find(l => l.id === lessonId);
    if (!target) return;

    if (window.confirm(`Bạn có chắc chắn muốn XÓA vĩnh viễn buổi học ngày ${target.date} ("${target.topic}") cùng biểu điểm danh của ngày này?`)) {
      const updated = lessons.filter(l => l.id !== lessonId);
      onSaveLessons(updated);
      showStatus("Đã xóa vĩnh viễn buổi học thành công.");
      // Auto switch active selected lesson if we deleted the current one
      if (selectedLessonId === lessonId) {
        const remaining = updated.filter(l => l.classroomId === classroom.id);
        setSelectedLessonId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Update attendance of a student in the currently selected lesson
  const handleUpdateStudentStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    if (!selectedLessonId) return;

    const updated = lessons.map(lesson => {
      if (lesson.id === selectedLessonId) {
        // Find if student attendance already exists, otherwise add it
        const exists = lesson.attendance.some(a => a.studentId === studentId);
        let updatedAttendance = [...lesson.attendance];
        if (exists) {
          updatedAttendance = updatedAttendance.map(a => 
            a.studentId === studentId ? { ...a, status } : a
          );
        } else {
          updatedAttendance.push({ studentId, status, note: "" });
        }
        return {
          ...lesson,
          attendance: updatedAttendance
        };
      }
      return lesson;
    });

    onSaveLessons(updated);
  };

  // Update note of a student in the currently selected lesson
  const handleUpdateStudentNote = (studentId: string, note: string) => {
    if (!selectedLessonId) return;

    const updated = lessons.map(lesson => {
      if (lesson.id === selectedLessonId) {
        const updatedAttendance = lesson.attendance.map(a => 
          a.studentId === studentId ? { ...a, note } : a
        );
        return {
          ...lesson,
          attendance: updatedAttendance
        };
      }
      return lesson;
    });

    onSaveLessons(updated);
  };

  // Mark all students present for selected lesson
  const handleMarkAllPresent = () => {
    if (!selectedLessonId) return;

    const updated = lessons.map(lesson => {
      if (lesson.id === selectedLessonId) {
        const updatedAttendance = lesson.attendance.map(a => ({
          ...a,
          status: 'present' as const
        }));
        return {
          ...lesson,
          attendance: updatedAttendance
        };
      }
      return lesson;
    });

    onSaveLessons(updated);
    showStatus("Đã điểm danh CÓ MẶT cho toàn bộ học sinh!");
  };

  // Calculate stats for the selected lesson
  const getSelectedLessonStats = () => {
    if (!selectedLesson) return { presentCount: 0, absentCount: 0, lateCount: 0, total: 0, rate: 0 };
    const total = classroom.students.length;
    if (total === 0) return { presentCount: 0, absentCount: 0, lateCount: 0, total: 0, rate: 0 };

    let present = 0;
    let absent = 0;
    let late = 0;

    classroom.students.forEach(std => {
      const rec = selectedLesson.attendance.find(a => a.studentId === std.id);
      if (!rec || rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'late') late++;
    });

    const rate = Math.round(((present + late) / total) * 100);
    return {
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      total,
      rate
    };
  };

  const stats = getSelectedLessonStats();

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6" id="mw-attendance-manager">
      
      {/* Component Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
            Quản Lý Học Vụ & Giám Sát Sĩ Số
          </span>
          <h3 className="text-lg font-black text-slate-800 tracking-tight mt-1.5 flex items-center gap-2">
            <ClipboardCheck className="w-5.5 h-5.5 text-indigo-600" />
            Sổ Điểm Danh & Lập Lịch Học
          </h3>
          <p className="text-[11px] text-slate-450 mt-0.5">
            Giới thiệu lịch học cố định và lịch học thêm (bổ trợ phụ đạo) kèm quản lý trạng thái sĩ số của mỗi lớp.
          </p>
        </div>
        {statusMessage && (
          <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs font-semibold px-3.5 py-1.5 rounded-xl animate-fadeIn">
            ✓ {statusMessage}
          </div>
        )}
      </div>

      {/* Main Grid: Add Lesson Form & Lesson Schedule (left) | Attendance sheet (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Schedule Planner and list (col-span-12 xl:col-span-5) */}
        <div className="xl:col-span-5 space-y-5">
          {/* Form to Create New Lesson */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              Thiết kế Buổi học Mới
            </h4>
            
            <form onSubmit={handleCreateLesson} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Chủ đề buổi học / Chuyên đề</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Quang hình nâng cao, Khảo sát hàm số..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                    id="input-lesson-topic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Ngày học phù hợp</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                    id="input-lesson-date"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tính chất buổi học</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as 'fixed' | 'extra')}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
                    id="select-lesson-type"
                  >
                    <option value="fixed">📅 Lớp học Cố định</option>
                    <option value="extra">⚡ Lớp học Thêm / Bổ trợ</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-1.5 mt-2"
                id="btn-add-lesson"
              >
                <Plus className="w-4 h-4" /> Thêm lịch & Điểm danh lớp
              </button>
            </form>
          </div>

          {/* Scheduled Lessons List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>DANH SÁCH LỊCH HỌC ({classroomLessons.length})</span>
              <span className="text-[10px] text-slate-400 lowercase font-medium">Bấm để điểm danh</span>
            </h4>

            {classroomLessons.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-500">Chưa thiết lập bất kỳ buổi học nào</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Sử dụng biểu mẫu phía trên để lập một buổi học mới.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {classroomLessons.map((l) => {
                  const isActive = selectedLessonId === l.id;
                  
                  // Quick attendance quick overview stats
                  let present = 0;
                  l.attendance.forEach(a => {
                    if (a.status === 'present' || a.status === 'late') present++;
                  });
                  const rate = l.attendance.length > 0 ? Math.round((present / l.attendance.length) * 100) : 100;

                  return (
                    <div
                      key={l.id}
                      onClick={() => {
                        setSelectedLessonId(l.id);
                        showStatus(`Đã đổi sang hiển thị buổi học ngày ${l.date}`);
                      }}
                      className={`p-3 border rounded-2xl text-left cursor-pointer transition flex items-center justify-between gap-3 ${
                        isActive 
                          ? "bg-indigo-50 border-indigo-300 shadow-sm"
                          : "bg-white border-slate-200/85 hover:bg-slate-50/50"
                      }`}
                      id={`lesson-item-${l.id}`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase leading-none ${
                            l.type === 'fixed'
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-55 text-amber-705 border border-amber-200"
                          }`}>
                            {l.type === 'fixed' ? "Cố định" : "Học thêm"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {l.date}
                          </span>
                        </div>
                        <h5 className="text-xs font-extrabold text-slate-850 truncate">{l.topic}</h5>
                        <p className="text-[9px] text-slate-450 font-medium">
                          Tỷ lệ sĩ số: <strong className="text-indigo-650">{rate}%</strong> ({present}/{l.attendance.length} học viên)
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleDeleteLesson(l.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Xóa buổi học này"
                        id={`btn-delete-lesson-${l.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Attendance Grid (col-span-12 xl:col-span-7) */}
        <div className="xl:col-span-7 space-y-4">
          {selectedLesson ? (
            <div className="border border-slate-200 rounded-3xl p-5 space-y-5">
              
              {/* Header metrics for selected lesson */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div className="min-w-0">
                  <span className="text-[9px] font-extrabold text-indigo-600 block uppercase">Đang chọn lịch để xem</span>
                  <h4 className="text-sm font-black text-slate-805 truncate">{selectedLesson.topic}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ngày dạy học: {selectedLesson.date} • {selectedLesson.type === 'fixed' ? 'Kiểu lớp cố định' : 'Kiểu lớp bổ trợ học thêm'}</p>
                </div>

                <button
                  onClick={handleMarkAllPresent}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition flex items-center gap-1 shrink-0 self-end md:self-auto cursor-pointer"
                  id="btn-mark-all-present"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Có mặt tất cả
                </button>
              </div>

              {/* Attendance Quick Stats dashboard */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                  <span className="text-[8px] text-emerald-600 block font-bold uppercase">Có mặt</span>
                  <span className="text-base font-black text-emerald-700">{stats.presentCount}</span>
                </div>
                <div className="p-2.5 bg-amber-50/40 border border-amber-100 rounded-xl">
                  <span className="text-[8px] text-amber-600 block font-bold uppercase">Đi muộn</span>
                  <span className="text-base font-black text-amber-700">{stats.lateCount}</span>
                </div>
                <div className="p-2.5 bg-rose-50/40 border border-rose-100 rounded-xl">
                  <span className="text-[8px] text-rose-500 block font-bold uppercase">Vắng mặt</span>
                  <span className="text-base font-black text-rose-600">{stats.absentCount}</span>
                </div>
                <div className="p-2.5 bg-indigo-50/45 border border-indigo-100 rounded-xl">
                  <span className="text-[8px] text-indigo-600 block font-bold uppercase">Tỷ lệ</span>
                  <span className="text-base font-black text-indigo-750">{stats.rate}%</span>
                </div>
              </div>

              {/* Student status listing */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">BẢNG KÊ DANH SÁCH LỚP ({classroom.students.length})</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-indigo-500" />
                    Bấm nút màu tương ứng trạng thái
                  </span>
                </div>

                {classroom.students.length === 0 ? (
                  <div className="p-8 border border-dashed rounded-2xl text-center text-slate-405">
                    <X className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    Không tìm thấy học sinh nào trong lớp để điểm danh!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white max-h-[350px] overflow-y-auto">
                    {classroom.students.map((student) => {
                      const record = selectedLesson.attendance.find(a => a.studentId === student.id);
                      const currentStatus = record ? record.status : 'present';
                      const currentNote = record && record.note ? record.note : "";

                      return (
                        <div 
                          key={student.id} 
                          className="p-3 hover:bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                          id={`student-attendance-row-${student.id}`}
                        >
                          {/* Student Details */}
                          <div className="min-w-0 space-y-0.5 flex-1">
                            <span className="text-xs font-extrabold text-slate-800 block truncate">{student.name}</span>
                            <span className="text-[9px] text-slate-400 block font-mono truncate">{student.email}</span>
                          </div>

                          {/* Quick Edit Status and Notes Input */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Short note input */}
                            <input
                              type="text"
                              value={currentNote}
                              placeholder="Ghi chú (phép, muộn...)"
                              onChange={(e) => handleUpdateStudentNote(student.id, e.target.value)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-505 max-w-[140px] md:max-w-xs font-semibold outline-none"
                              id={`input-note-std-${student.id}`}
                            />

                            {/* Tri-state buttons (Có mặt, Đi muộn, Vắng mặt) */}
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateStudentStatus(student.id, 'present')}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition flex items-center gap-0.5 cursor-pointer ${
                                  currentStatus === 'present'
                                    ? "bg-emerald-500 text-white font-black shadow-xs"
                                    : "text-slate-500 hover:bg-slate-200"
                                }`}
                                title="Có mặt"
                              >
                                <Check className="w-3 h-3" />
                                <span className="hidden md:inline">Có mặt</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleUpdateStudentStatus(student.id, 'late')}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition flex items-center gap-0.5 cursor-pointer ${
                                  currentStatus === 'late'
                                    ? "bg-amber-450   text-white font-black shadow-xs"
                                    : "text-slate-500 hover:bg-slate-200"
                                }`}
                                title="Đi muộn"
                              >
                                <Clock className="w-3 h-3" />
                                <span className="hidden md:inline">Đi muộn</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateStudentStatus(student.id, 'absent')}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition flex items-center gap-0.5 cursor-pointer ${
                                  currentStatus === 'absent'
                                    ? "bg-rose-500 text-white font-black shadow-xs"
                                    : "text-slate-500 hover:bg-slate-200"
                                }`}
                                title="Vắng mặt"
                              >
                                <X className="w-3 h-3" />
                                <span className="hidden md:inline">Vắng</span>
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 space-y-2 h-full flex flex-col justify-center items-center">
              <ClipboardCheck className="w-12 h-12 text-slate-320 block" />
              <h5 className="text-xs font-black text-slate-705">Thông tin Điểm danh lớp học</h5>
              <p className="text-[10.5px] text-slate-450 max-w-xs leading-normal">
                Vui lòng lập ít nhất một Lịch học bằng mô đun bên trái hoặc bấm vào một lịch đã có sẵn để mở biểu điểm danh học sinh chi tiết.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
