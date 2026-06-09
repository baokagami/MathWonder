export interface Question {
  id: string;
  text: string;
  type: 'multiple_choice' | 'essay' | 'true_false' | 'short_answer' | 'drag_drop';
  options: string[];
  correctAnswer: string; // "A", "B", "C", "D" for multiple_choice, "Đúng" or "Sai" for true_false, text for short_answer and empty for essay
  points: number;
  explanation?: string;
  tikz?: string;
  image?: string; // Optional image data-url or source URL
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  classroomId: string;
  questions: Question[];
  status: 'draft' | 'active' | 'ended';
  createdDate: string;
  totalPoints: number;
  examType?: 'daily' | 'periodic' | 'custom';
  requireCamera?: boolean;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacherName: string;
  code: string;
  createdDate: string;
  students: { id: string; name: string; email: string }[];
}

export interface MonitoringLog {
  timestamp: string;
  eventType: 'tab-switch' | 'fullscreen-exit' | 'offline' | 'blur' | 'resume';
  detail: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startTime: string;
  submitTime?: string;
  status: 'ongoing' | 'submitted';
  responses: Record<string, string>; // questionId -> chosen answer (e.g. "A", "B", "D")
  monitoringLogs: MonitoringLog[];
  score?: number;
  graded: boolean;
  totalPoints: number;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  password?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  role: 'student' | 'teacher';
  phone: string;
  school: string;
  specialty?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface StudentEvaluation {
  id: string;
  studentEmail: string;
  classroomId: string;
  evaluatorType: 'ai' | 'teacher';
  evaluatorName: string;
  createdDate: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  grade: 'Xuất sắc' | 'Giỏi' | 'Khá' | 'Trung bình' | 'Cần cố gắng' | string;
}

export interface LessonAttendance {
  studentId: string;
  status: 'present' | 'absent' | 'late';
  note?: string;
}

export interface Lesson {
  id: string;
  classroomId: string;
  date: string;
  type: 'fixed' | 'extra';
  topic: string;
  attendance: LessonAttendance[];
  createdDate: string;
}



