import { useState, useEffect } from "react";
import { Classroom, Exam, Question, ExamSession, Registration, StudentEvaluation, Lesson } from "./types";
import TeacherDashboard from "./components/TeacherDashboard";
import AICreator from "./components/AICreator";
import StudentAssessment from "./components/StudentAssessment";
import ExamReport from "./components/ExamReport";
import AisAuthGate from "./components/AisAuthGate";
import AdminRegistrationManager from "./components/AdminRegistrationManager";
import StudentPortal from "./components/StudentPortal";
import { initAuth, db, cleanUndefined } from "./utils/firebaseAuth";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { ALL_DEMO_EXAMS } from "./utils/demoExams";
import { MathRenderer } from "./components/MathRenderer";
import { TikzRenderer } from "./components/TikzRenderer";
import { 
  Users, GraduationCap, ShieldAlert, BookOpen, Clock, Activity, Settings, 
  UserCheck, Sparkles, LogOut, CheckCircle2, ChevronRight, AlertTriangle, ShieldCheck
} from "lucide-react";


// Initial Demo/Seed Data to make the application immediately useful and visual on first load
const INITIAL_CLASSROOMS: Classroom[] = [
  {
    id: "class-1",
    name: "12A1 Chuyên Lý",
    subject: "Luyện thi THPT Quốc Gia môn Vật Lý",
    teacherName: "Thầy Nguyễn Quốc Đạt",
    code: "PHYL12A1",
    createdDate: new Date().toISOString(),
    students: [
      { id: "std-1", name: "Nguyễn Thế Anh", email: "theanh.phy@gmail.com" },
      { id: "std-2", name: "Trần Khánh Vy", email: "khanhvy.school@gmail.com" },
      { id: "std-3", name: "Vũ Gia Bảo", email: "giabao.vnu@gmail.com" }
    ]
  },
  {
    id: "class-2",
    name: "11B3 Toán Giải Tích",
    subject: "Học phần Tích Phân & Giới Hạn nâng cao",
    teacherName: "Cô Trần Phương Linh",
    code: "MATH11B3",
    createdDate: new Date().toISOString(),
    students: [
      { id: "std-4", name: "Lê Minh Thư", email: "minhthu.le@gmail.com" },
      { id: "std-5", name: "Phạm Hoàng Nam", email: "namhoang.pham@gmail.com" }
    ]
  }
];

const INITIAL_EXAMS: Exam[] = [
  {
    id: "exam-1",
    title: "Khảo sát chất lượng: Dao Động Điều Hòa Cơ Học",
    description: "Đề thi phân môn Cơ học Vật Lý 12. Giám sát an toàn chống quay cóp trực tuyến.",
    duration: 15,
    classroomId: "class-1",
    status: "active",
    createdDate: new Date().toISOString(),
    totalPoints: 3,
    questions: [
      {
        id: "q-1",
        text: "Một vật dao động điều hòa theo phương trình x = A cos(wt + phi). Đại lượng phi là gì trong cơ hệ thế năng?",
        type: "multiple_choice",
        options: ["A. Biên độ dao động", "B. Tần số góc dao động", "C. Pha ban đầu của dao động", "D. Chu kỳ của dao động"],
        correctAnswer: "C",
        points: 1,
        explanation: "Phi là pha ban đầu xác định tọa độ tại thời điểm t = 0."
      },
      {
        id: "q-2",
        text: "Tại vị trí cân bằng của con lắc lò xo treo thẳng đứng, lực đàn hồi của lò xo có trạng thái như thế nào?",
        type: "multiple_choice",
        options: [
          "A. Bằng không",
          "B. Cân bằng với trọng lực tác dụng lên con lắc",
          "C. Có giá trị cực đại lớn nhất",
          "D. Bằng động năng cực đại"
        ],
        correctAnswer: "B",
        points: 1,
        explanation: "Tại vị trí cân bằng, lò xo giãn một đoạn dL sao cho k*dL = m*g, cân bằng hoàn toàn với trọng lực."
      },
      {
        id: "q-3",
        text: "Một con lắc đơn có chiều dài l dao động tại nơi có gia tốc trọng trường g. Chu kỳ dao động nhỏ của con lắc được tính bằng công thức nào?",
        type: "multiple_choice",
        options: [
          "A. T = 2pi * can(g/l)",
          "B. T = 2pi * can(l/g)",
          "C. T = 1/(2pi) * can(g/l)",
          "D. T = can(l/g)"
        ],
        correctAnswer: "B",
        points: 1,
        explanation: "Chu kỳ con lắc đơn phụ thuộc chiều dài l và trọng lực g theo công thức T = 2pi * can(l/g)."
      }
    ]
  },
  ...ALL_DEMO_EXAMS
];

const INITIAL_SESSIONS: ExamSession[] = [
  {
    id: "session-1",
    examId: "exam-1",
    studentId: "std-1",
    studentName: "Nguyễn Thế Anh",
    studentEmail: "theanh.phy@gmail.com",
    startTime: new Date(Date.now() - 30 * 60000).toISOString(),
    submitTime: new Date(Date.now() - 20 * 60500).toISOString(),
    status: "submitted",
    responses: { "q-1": "C", "q-2": "B", "q-3": "A" },
    monitoringLogs: [],
    score: 2,
    graded: true,
    totalPoints: 3
  },
  {
    id: "session-2",
    examId: "exam-1",
    studentId: "std-2",
    studentName: "Trần Khánh Vy",
    studentEmail: "khanhvy.school@gmail.com",
    startTime: new Date(Date.now() - 25 * 60000).toISOString(),
    submitTime: new Date(Date.now() - 14 * 60000).toISOString(),
    status: "submitted",
    responses: { "q-1": "C", "q-2": "B", "q-3": "B" },
    monitoringLogs: [
      { timestamp: new Date(Date.now() - 20 * 60000).toISOString(), eventType: 'tab-switch', detail: "Rời khỏi tab thi để mở ứng dụng Chat" }
    ],
    score: 3,
    graded: true,
    totalPoints: 3
  },
  {
    id: "session-3",
    examId: "exam-1",
    studentId: "std-3",
    studentName: "Vũ Gia Bảo",
    studentEmail: "giabao.vnu@gmail.com",
    startTime: new Date(Date.now() - 22 * 60000).toISOString(),
    submitTime: new Date(Date.now() - 8 * 60000).toISOString(),
    status: "submitted",
    responses: { "q-1": "A", "q-2": "B", "q-3": "C" },
    monitoringLogs: [
      { timestamp: new Date(Date.now() - 20 * 60000).toISOString(), eventType: 'tab-switch', detail: "Học viên thoát toàn màn hình 15 giây" },
      { timestamp: new Date(Date.now() - 17 * 60000).toISOString(), eventType: 'tab-switch', detail: "Phát hiện rời tab thi thêm 20 giây" },
      { timestamp: new Date(Date.now() - 15 * 60000).toISOString(), eventType: 'blur', detail: "Nhấp ra ngoài tiêu điểm bài thi" }
    ],
    score: 1,
    graded: true,
    totalPoints: 3
  }
];

const INITIAL_REGISTRATIONS: Registration[] = [
  {
    id: "reg-admin",
    name: "Quản trị viên Trần Xuân Hiệp",
    email: "baokagami@gmail.com",
    password: "Hieptran275@",
    securityQuestion: "Thần tượng toán học của bạn là ai?",
    securityAnswer: "Newton",
    role: "teacher",
    phone: "0912345678",
    school: "Hệ sinh thái MathWonder",
    status: "approved",
    createdAt: new Date().toISOString()
  },
  {
    id: "reg-1",
    name: "Thầy Nguyễn Quốc Đạt",
    email: "theanh.phy@gmail.com",
    password: "123456",
    securityQuestion: "Tên trường tiểu học đầu tiên của bạn?",
    securityAnswer: "Lê Quý Đôn",
    role: "teacher",
    phone: "0912111222",
    school: "THPT Chuyên Lê Hồng Phong",
    specialty: "Vật Lý THPT Quốc Gia",
    status: "approved",
    createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString()
  },
  {
    id: "reg-2",
    name: "Trần Khánh Vy",
    email: "khanhvy.school@gmail.com",
    password: "123456",
    securityQuestion: "Tên trường tiểu học đầu tiên của bạn?",
    securityAnswer: "Lê Quý Đôn",
    role: "student",
    phone: "0987123456",
    school: "THPT Chuyên Hà Nội - Amsterdam",
    status: "pending",
    createdAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString()
  },
  {
    id: "reg-3",
    name: "Cô Trần Phương Linh",
    email: "lh.tranphuong@gmail.com",
    password: "123456",
    securityQuestion: "Tên trường tiểu học đầu tiên của bạn?",
    securityAnswer: "Lê Quý Đôn",
    role: "teacher",
    phone: "0905556677",
    school: "THPT Chuyên Lam Sơn",
    specialty: "Toán Đại Số & Giải Tích",
    status: "pending",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: "reg-4",
    name: "Nguyễn Thế Anh",
    email: "theanh.phy2@gmail.com",
    password: "123456",
    securityQuestion: "Tên trường tiểu học đầu tiên của bạn?",
    securityAnswer: "Lê Quý Đôn",
    role: "student",
    phone: "0923456789",
    school: "THPT Chuyên Lê Hồng Phong",
    status: "approved",
    createdAt: new Date(Date.now() - 15 * 24 * 3600000).toISOString()
  }
];

const INITIAL_LESSONS: Lesson[] = [
  {
    id: "lesson-1",
    classroomId: "class-1",
    date: "2026-05-15",
    type: "fixed",
    topic: "Chuyên đề Dao động điều hòa phần I",
    attendance: [
      { studentId: "std-1", status: "present" },
      { studentId: "std-2", status: "present" },
      { studentId: "std-3", status: "late", note: "Muộn 10 phút" }
    ],
    createdDate: new Date("2026-05-15T08:00:00Z").toISOString()
  },
  {
    id: "lesson-2",
    classroomId: "class-1",
    date: "2026-05-20",
    type: "extra",
    topic: "Học thêm Chuyên đề bồi dưỡng Dao động tắt dần",
    attendance: [
      { studentId: "std-1", status: "present" },
      { studentId: "std-2", status: "absent", note: "Ốm xin nghỉ" },
      { studentId: "std-3", status: "present" }
    ],
    createdDate: new Date("2026-05-20T14:00:00Z").toISOString()
  },
  {
    id: "lesson-3",
    classroomId: "class-2",
    date: "2026-05-18",
    type: "fixed",
    topic: "Giới hạn của dãy số - Định lý kẹp Toán đại cương",
    attendance: [
      { studentId: "std-4", status: "present" },
      { studentId: "std-5", status: "present" }
    ],
    createdDate: new Date("2026-05-18T09:00:00Z").toISOString()
  }
];

export default function App() {
  // Sync states directly within browser local storage
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => {
    const saved = localStorage.getItem("edugrade_classrooms");
    return saved ? JSON.parse(saved) : INITIAL_CLASSROOMS;
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem("edugrade_exams");
    return saved ? JSON.parse(saved) : INITIAL_EXAMS;
  });

  const [sessions, setSessions] = useState<ExamSession[]>(() => {
    const saved = localStorage.getItem("edugrade_sessions");
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  // User and Registrations persistent states
  const [registrations, setRegistrations] = useState<Registration[]>(() => {
    const saved = localStorage.getItem("mw_registrations");
    return saved ? JSON.parse(saved) : INITIAL_REGISTRATIONS;
  });

  const [evaluations, setEvaluations] = useState<StudentEvaluation[]>(() => {
    const saved = localStorage.getItem("mw_evaluations");
    return saved ? JSON.parse(saved) : [];
  });

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem("mw_lessons");
    return saved ? JSON.parse(saved) : INITIAL_LESSONS;
  });

  const [currentUserSession, setCurrentUserSession] = useState<{ email: string; name: string; role: 'student' | 'teacher' | 'admin' } | null>(() => {
    const saved = localStorage.getItem("mw_current_session");
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation controller routing
  const [currentView, setCurrentView] = useState<'teacher_dashboard' | 'ai_creator' | 'student_assessment' | 'exam_report' | 'scorecard' | 'admin_panel' | 'student_portal'>(() => {
    const saved = localStorage.getItem("mw_current_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.role === 'admin') return 'admin_panel';
      if (parsed.role === 'teacher') return 'teacher_dashboard';
      if (parsed.role === 'student') return 'student_portal';
    }
    return 'student_portal';
  });

  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>("class-1");
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [simulatedStudent, setSimulatedStudent] = useState<{ id: string; name: string; email: string } | null>(null);

  
  // Results view helper
  const [lastSubmittedScore, setLastSubmittedScore] = useState<any | null>(null);
  const [showQuizReview, setShowQuizReview] = useState(false);

  // Auto-sync writes to browser LocalStorage
  useEffect(() => {
    localStorage.setItem("edugrade_classrooms", JSON.stringify(classrooms));
  }, [classrooms]);

  useEffect(() => {
    localStorage.setItem("edugrade_exams", JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem("edugrade_sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("mw_registrations", JSON.stringify(registrations));
  }, [registrations]);

  useEffect(() => {
    localStorage.setItem("mw_evaluations", JSON.stringify(evaluations));
  }, [evaluations]);

  useEffect(() => {
    localStorage.setItem("mw_lessons", JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    if (currentUserSession) {
      localStorage.setItem("mw_current_session", JSON.stringify(currentUserSession));
    } else {
      localStorage.removeItem("mw_current_session");
    }
  }, [currentUserSession]);

  // Firebase Auth state and Firestore synchronization
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "registrations"), (snapshot) => {
      const list: Registration[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Registration;
        list.push({
          ...data,
          id: data.id || doc.id
        });
      });
      
      const hasAdmin = list.some(r => r.email.toLowerCase() === "baokagami@gmail.com");
      if (hasAdmin) {
        setRegistrations(list);
      } else {
        // If snapshot is empty or doesn't have the admin seed, we seed the missing items securely
        const missingRegs = INITIAL_REGISTRATIONS.filter(ir => !list.some(r => r.email.toLowerCase() === ir.email.toLowerCase()));
        missingRegs.forEach(async (reg) => {
          try {
            await setDoc(doc(db, "registrations", reg.id), cleanUndefined(reg));
          } catch (err) {
            console.error("Failed to seed initial registration:", err);
          }
        });
        // Combine them immediately in local state
        setRegistrations([...list, ...missingRegs]);
      }
    }, (error) => {
      console.error("Firestore registrations snapshot listener error:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "classrooms"), (snapshot) => {
      const list: Classroom[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Classroom);
      });
      if (list.length > 0) {
        setClassrooms(list);
      } else {
        INITIAL_CLASSROOMS.forEach(async (c) => {
          await setDoc(doc(db, "classrooms", c.id), cleanUndefined(c));
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "lessons"), (snapshot) => {
      const list: Lesson[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Lesson);
      });
      if (list.length > 0) {
        setLessons(list);
      } else {
        INITIAL_LESSONS.forEach(async (l) => {
          await setDoc(doc(db, "lessons", l.id), cleanUndefined(l));
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "exams"), (snapshot) => {
      const list: Exam[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Exam);
      });
      if (list.length > 0) {
        setExams(list);
      } else {
        INITIAL_EXAMS.forEach(async (e) => {
          await setDoc(doc(db, "exams", e.id), cleanUndefined(e));
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sessions"), (snapshot) => {
      const list: ExamSession[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as ExamSession);
      });
      if (list.length > 0) {
        setSessions(list);
      } else {
        INITIAL_SESSIONS.forEach(async (s) => {
          await setDoc(doc(db, "sessions", s.id), cleanUndefined(s));
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "evaluations"), (snapshot) => {
      const list: StudentEvaluation[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as StudentEvaluation);
      });
      setEvaluations(list);
    });
    return () => unsubscribe();
  }, []);

  // Firebase auth state hook
  useEffect(() => {
    const unsubscribe = initAuth(
      (googleUser) => {
        const emailLower = (googleUser.email || "").toLowerCase();
        if (emailLower === "baokagami@gmail.com") {
          setCurrentUserSession({
            email: googleUser.email || "baokagami@gmail.com",
            name: googleUser.displayName || "Trần Xuân Hiệp",
            role: "admin"
          });
          setCurrentView("admin_panel");
          return;
        }

        const reg = registrations.find(r => r.email.toLowerCase() === emailLower);
        if (reg && reg.status === "approved") {
          setCurrentUserSession({
            email: reg.email,
            name: reg.name,
            role: reg.role
          });
          setCurrentView(reg.role === "teacher" ? "teacher_dashboard" : "student_portal");
        }
      },
      () => {
        // No Google authentication session on load, fallback to local/simulation
      }
    );
    return () => unsubscribe();
  }, [registrations]);

  // Auth & Registration Handlers
  const handleRegister = async (data: Omit<Registration, "id" | "createdAt" | "status">) => {
    const newRegId = `reg-${Date.now()}`;
    const newReg: Registration = {
      ...data,
      id: newRegId,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    // Add to local state first to guarantee instantaneous update & prevent blank screen
    setRegistrations((prev) => {
      const exists = prev.some(r => r.email.toLowerCase() === newReg.email.toLowerCase());
      if (exists) return prev;
      const updated = [...prev, newReg];
      localStorage.setItem("mw_registrations", JSON.stringify(updated));
      return updated;
    });

    await setDoc(doc(db, "registrations", newRegId), cleanUndefined(newReg));
  };

  const handleUpdatePassword = async (email: string, nextPassword: string) => {
    const reg = registrations.find(r => r.email.toLowerCase() === email.toLowerCase());
    if (reg) {
      await setDoc(doc(db, "registrations", reg.id), cleanUndefined({ ...reg, password: nextPassword }));
    }
  };

  const handleUpdateRegistrationStatus = async (id: string, newStatus: "approved" | "rejected") => {
    const reg = registrations.find(r => r.id === id);
    if (reg) {
      await setDoc(doc(db, "registrations", id), cleanUndefined({ ...reg, status: newStatus }));
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    await deleteDoc(doc(db, "registrations", id));
  };

  const handleJoinClassroom = (code: string): boolean => {
    if (!currentUserSession) return false;
    const targetClass = classrooms.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (!targetClass) return false;

    // Check if already enrolled
    const alreadyJoined = targetClass.students.some(
      s => s.email.toLowerCase() === currentUserSession.email.toLowerCase()
    );
    if (alreadyJoined) return false;

    // Enroll and push to Firestore
    const updatedClass = {
      ...targetClass,
      students: [
        ...targetClass.students,
        { id: `student-${Date.now()}`, name: currentUserSession.name, email: currentUserSession.email }
      ]
    };
    setDoc(doc(db, "classrooms", targetClass.id), cleanUndefined(updatedClass)).catch(console.error);
    return true;
  };

  const handleBypassLogin = (role: "student" | "teacher" | "admin", email?: string, name?: string) => {
    if (role === "admin") {
      alert("⚠️ Không thể giả lập vai trò Quản trị viên trực tiếp! Vui lòng đăng nhập bằng Gmail hoặc Google với đúng thông tin tài khoản.");
      return;
    }

    const emailDefault = role === "teacher" ? "teacher.wonder@gmail.com" : "hocsinh@gmail.com";
    const nameDefault = role === "teacher" ? "Cô Trần Phương Linh" : "Kiều Học Sinh Thử Nghiệm";

    const sessionObj = {
      email: email || emailDefault,
      name: name || nameDefault,
      role
    };

    setCurrentUserSession(sessionObj);
    
    if (role === "teacher") {
      setCurrentView("teacher_dashboard");
    } else {
      setCurrentView("student_portal");
    }
  };

  const handleLogout = () => {
    setCurrentUserSession(null);
    setCurrentView("student_portal");
    localStorage.removeItem("mw_current_session");
  };


  // Create & Manage classrooms
  const handleCreateClassroom = (name: string, subject: string, teacher: string) => {
    const newClass: Classroom = {
      id: `class-${Date.now()}`,
      name,
      subject,
      teacherName: teacher,
      code: Math.random().toString(36).substr(2, 8).toUpperCase(),
      createdDate: new Date().toISOString(),
      students: [
        { id: `student-${Math.random()}`, name: "Hoàng Minh Quân", email: "quanminh@gmail.com" },
        { id: `student-${Math.random()}`, name: "Hà Diệu Chi", email: "dieuchi.ha@gmail.com" },
        { id: `student-${Math.random()}`, name: "Nguyễn Duy Tân", email: "duytan@gmail.com" },
      ]
    };
    setDoc(doc(db, "classrooms", newClass.id), cleanUndefined(newClass)).catch(console.error);
    setSelectedClassroomId(newClass.id);
  };

  const handleDeleteClassroom = (classId: string) => {
    deleteDoc(doc(db, "classrooms", classId)).catch(console.error);
  };

  const handleRemoveStudentFromClassroom = (classId: string, studentId: string) => {
    const cls = classrooms.find(c => c.id === classId);
    if (cls) {
      const updated = {
        ...cls,
        students: cls.students.filter((s) => s.id !== studentId)
      };
      setDoc(doc(db, "classrooms", classId), cleanUndefined(updated)).catch(console.error);
    }
  };

  // Create & Save Exams from AICreator
  const handleSaveExamFromAICreator = (
    title: string,
    description: string,
    duration: number,
    questions: Question[],
    examType?: 'daily' | 'periodic' | 'custom',
    requireCamera?: boolean
  ) => {
    if (!selectedClassroomId) return;
    const newExam: Exam = {
      id: `exam-${Date.now()}`,
      title,
      description,
      duration,
      classroomId: selectedClassroomId,
      questions,
      totalPoints: Number(questions.reduce((sum, q) => sum + (q.points || 0), 0).toFixed(2)),
      status: "draft",
      createdDate: new Date().toISOString(),
      examType: examType || "custom",
      requireCamera: requireCamera !== false // Default to true if undefined
    };
    setDoc(doc(db, "exams", newExam.id), cleanUndefined(newExam)).catch(console.error);
    setCurrentView("teacher_dashboard");
  };

  const handleDeleteExam = (examId: string) => {
    deleteDoc(doc(db, "exams", examId)).catch(console.error);
    sessions.filter((s) => s.examId === examId).forEach((s) => {
      deleteDoc(doc(db, "sessions", s.id)).catch(console.error);
    });
  };

  const handleToggleExamStatus = (examId: string, nextStatus: 'draft' | 'active' | 'ended') => {
    const exam = exams.find((e) => e.id === examId);
    if (exam) {
      setDoc(doc(db, "exams", examId), cleanUndefined({ ...exam, status: nextStatus })).catch(console.error);
    }
  };

  // Simulate exam taking & submitting
  const handleLaunchStudentAssessment = (exam: Exam, student: { id: string; name: string; email: string }) => {
    setActiveExam(exam);
    setSimulatedStudent(student);
    setCurrentView("student_assessment");
  };

  const handleStudentSubmitExam = (responses: Record<string, string>, monitoringLogs: any[], score: number) => {
    if (!activeExam || !simulatedStudent) return;

    const newSession: ExamSession = {
      id: `session-${Date.now()}`,
      examId: activeExam.id,
      studentId: simulatedStudent.id,
      studentName: simulatedStudent.name,
      studentEmail: simulatedStudent.email,
      startTime: new Date(Date.now() - activeExam.duration * 30000).toISOString(),
      submitTime: new Date().toISOString(),
      status: "submitted",
      responses,
      monitoringLogs,
      score,
      graded: true,
      totalPoints: activeExam.totalPoints
    };

    setDoc(doc(db, "sessions", newSession.id), cleanUndefined(newSession)).catch(console.error);

    setLastSubmittedScore({
      studentName: simulatedStudent.name,
      score,
      totalPoints: activeExam.totalPoints,
      examTitle: activeExam.title,
      violations: monitoringLogs.filter(l => l.eventType !== 'resume').length,
      exam: activeExam,
      responses
    });
    
    // Switch to scorecard feedback view
    setShowQuizReview(false);
    setCurrentView("scorecard");
  };

  const handleSaveEvaluation = (newEval: StudentEvaluation) => {
    setDoc(doc(db, "evaluations", newEval.id), cleanUndefined(newEval)).catch(console.error);
  };

  const handleDeleteEvaluation = (evalId: string) => {
    deleteDoc(doc(db, "evaluations", evalId)).catch(console.error);
  };

  const handleSaveLessons = (nextLessons: Lesson[]) => {
    nextLessons.forEach((l) => {
      setDoc(doc(db, "lessons", l.id), cleanUndefined(l)).catch(console.error);
    });
    // Remove deleted lessons from Firestore
    lessons.forEach((l) => {
      if (!nextLessons.some((nl) => nl.id === l.id)) {
        deleteDoc(doc(db, "lessons", l.id)).catch(console.error);
      }
    });
  };

  if (!currentUserSession) {
    return (
      <AisAuthGate
        registrations={registrations}
        onRegister={handleRegister}
        onUpdatePassword={handleUpdatePassword}
        onLoginSuccess={(session) => {
          setCurrentUserSession(session);
          if (session.role === 'admin') setCurrentView('admin_panel');
          else if (session.role === 'teacher') setCurrentView('teacher_dashboard');
          else setCurrentView('student_portal');
        }}
        onBypass={handleBypassLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="applet-core-layout">
      {/* Brand Navigation Header styled with Bento Slate aesthetic */}
      <header className="bg-white text-slate-800 shrink-0 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Graphic */}
            <div className="cursor-pointer flex items-center gap-2 select-none" onClick={() => {
              if (currentUserSession.role === 'admin') setCurrentView('admin_panel');
              else if (currentUserSession.role === 'teacher') setCurrentView('teacher_dashboard');
              else setCurrentView('student_portal');
            }}>
              <div className="flex items-center">
                <span className="text-2xl font-black text-blue-600 tracking-tighter leading-none">Δ</span>
                <span className="text-2xl font-black text-amber-500 tracking-tighter -ml-2.5 leading-none">W</span>
              </div>
              <div className="h-6 w-px bg-slate-200 ml-1"></div>
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1">
                <span>MATHWONDER</span>
              </div>
              <div className="text-[8px] text-blue-600 font-bold uppercase tracking-wider">TOÁN HỌC - KHÁM PHÁ - TRẢI NGHIỆM</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Admin navigation selectors */}
            {currentUserSession.role === 'admin' && (
              <div className="flex gap-1.5 border border-slate-200/80 p-1 rounded-xl bg-slate-50">
                <button
                  onClick={() => setCurrentView('admin_panel')}
                  className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                    currentView === 'admin_panel' 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ⚙️ Thành viên & Sheets
                </button>
                <button
                  onClick={() => setCurrentView('teacher_dashboard')}
                  className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                    currentView === 'teacher_dashboard' 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🏫 Phòng học Giáo viên
                </button>
              </div>
            )}

            {/* Back button for secondary pages */}
            {currentUserSession.role !== 'student' && currentView !== 'teacher_dashboard' && currentView !== 'admin_panel' && (
              <button
                onClick={() => setCurrentView(currentUserSession.role === 'admin' ? 'admin_panel' : 'teacher_dashboard')}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3.5 rounded-xl border border-slate-200/60 transition"
              >
                ← Trở lại bảng
              </button>
            )}

            <div className="text-right text-[11px] text-slate-500 hidden md:block">
              <span className="text-blue-600 font-extrabold uppercase bg-blue-50 px-1.5 py-0.5 rounded mr-1">
                {currentUserSession.role === 'admin' ? "ADMIN" : currentUserSession.role === 'teacher' ? "GIÁO VIÊN" : "HỌC SINH"}
              </span>
              <span className="font-bold text-slate-805">{currentUserSession.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-50 rounded-lg transition cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Views Coordinator render selection */}
      <main className="grow">
        {/* Admin Center view */}
        {currentView === "admin_panel" && currentUserSession.role === "admin" && (
          <AdminRegistrationManager
            registrations={registrations}
            onUpdateStatus={handleUpdateRegistrationStatus}
            onSyncAll={() => {}}
            onDeleteRegistration={handleDeleteRegistration}
          />
        )}

        {/* Student Portal view */}
        {currentView === "student_portal" && (
          <StudentPortal
            classrooms={classrooms}
            exams={exams}
            sessions={sessions}
            evaluations={evaluations}
            studentEmail={currentUserSession.email}
            studentName={currentUserSession.name}
            onJoinClassroom={handleJoinClassroom}
            onTakeExam={handleLaunchStudentAssessment}
            onLogout={handleLogout}
          />
        )}

        {/* Teacher Dashboard */}
        {currentView === "teacher_dashboard" && (
          <TeacherDashboard
            classrooms={classrooms}
            exams={exams}
            sessions={sessions}
            evaluations={evaluations}
            onSaveEvaluation={handleSaveEvaluation}
            onDeleteEvaluation={handleDeleteEvaluation}
            onCreateClassroom={handleCreateClassroom}
            onDeleteClassroom={handleDeleteClassroom}
            onDeleteExam={handleDeleteExam}
            onActivateAICreator={(classId) => {
              setSelectedClassroomId(classId);
              setCurrentView("ai_creator");
            }}
            onViewReport={(exam) => {
              setActiveExam(exam);
              setCurrentView("exam_report");
            }}
            onSimulateStudent={handleLaunchStudentAssessment}
            onExamStatusToggle={handleToggleExamStatus}
            onSelectedClassroom={setSelectedClassroomId}
            selectedClassroomId={selectedClassroomId}
            onRemoveStudentFromClassroom={handleRemoveStudentFromClassroom}
            lessons={lessons}
            onSaveLessons={handleSaveLessons}
          />
        )}

        {currentView === "ai_creator" && selectedClassroomId && (
          <div className="py-6">
            <AICreator
              classroomId={selectedClassroomId}
              onExamCreated={handleSaveExamFromAICreator}
              onCancel={() => setCurrentView(currentUserSession.role === 'admin' ? "admin_panel" : "teacher_dashboard")}
            />
          </div>
        )}

        {currentView === "student_assessment" && activeExam && simulatedStudent && (
          <StudentAssessment
            exam={activeExam}
            studentName={simulatedStudent.name}
            studentEmail={simulatedStudent.email}
            studentId={simulatedStudent.id}
            onSubmitExam={handleStudentSubmitExam}
            onExit={() => setCurrentView(currentUserSession.role === 'student' ? "student_portal" : "teacher_dashboard")}
          />
        )}

        {currentView === "exam_report" && activeExam && (
          <ExamReport
            exam={activeExam}
            sessions={sessions.filter((s) => s.examId === activeExam.id)}
            onBack={() => setCurrentView(currentUserSession.role === 'admin' ? "admin_panel" : "teacher_dashboard")}
          />
        )}

        {/* Scorecard Feedback View */}
        {currentView === "scorecard" && lastSubmittedScore && (
          <div className="min-h-[85vh] py-8 px-4 bg-slate-900 text-white flex items-center justify-center animate-fadeIn" id="scorecard-screen">
            <div className={`w-full ${showQuizReview ? "max-w-5xl" : "max-w-md"} transition-all duration-300 space-y-6`}>
              <div className={`grid grid-cols-1 ${showQuizReview ? "md:grid-cols-3" : "grid-cols-1"} gap-6`}>
                
                {/* Main Scorecard summary card */}
                <div className={`bg-slate-850 p-6 rounded-2xl border border-slate-755 text-center space-y-4 shadow-2xl h-fit ${showQuizReview ? "md:col-span-1" : ""}`}>
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                  </div>
                  
                  <div>
                    <span className="text-[9px] tracking-wider uppercase font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded">
                      Bản điểm nộp tự động - azota.vn
                    </span>
                    <h2 className="text-lg font-bold text-white mt-3.5">Đã nộp bài thành công!</h2>
                    <p className="text-xs text-slate-400 mt-1">Học viên: <strong className="text-slate-200">{lastSubmittedScore.studentName}</strong></p>
                  </div>

                  {/* Detailed Points feedback */}
                  <div className="p-4 bg-slate-900 border border-slate-750 rounded-xl space-y-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Điểm quy đổi hệ số 10</div>
                    <div className="text-3xl font-mono font-extrabold text-indigo-400">
                      {lastSubmittedScore.score} / {lastSubmittedScore.totalPoints}
                    </div>
                    <div className="text-xs text-slate-400">
                      (Đề thi: {lastSubmittedScore.examTitle})
                    </div>
                  </div>

                  {/* Warnings log alert feedback */}
                  <div className="p-3 bg-slate-900/40 border border-slate-780 rounded-xl space-y-1 text-left">
                    <div className="text-[9px] font-bold text-slate-450 uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Báo cáo vi phạm (Azota Proctor)
                    </div>
                    <p className="text-xs text-slate-300">
                      Lỗi chuyển tab: <strong className={lastSubmittedScore.violations > 0 ? "text-amber-500" : "text-emerald-400"}>{lastSubmittedScore.violations} lần</strong>
                    </p>
                    <p className="text-[9px] text-slate-500 italic mt-1 leading-normal">
                      *Nhật ký giám sát đã được gán trực tiếp vào báo cáo học tập của giáo viên.
                    </p>
                  </div>

                  {/* Show/Hide solution detail review button */}
                  <button
                    type="button"
                    onClick={() => setShowQuizReview(!showQuizReview)}
                    className={`w-full py-2.5 font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${
                      showQuizReview 
                        ? "bg-slate-700 hover:bg-slate-650 text-slate-200 border border-slate-600"
                        : "bg-gradient-to-r from-indigo-650 to-indigo-500 hover:brightness-110 text-white"
                    }`}
                  >
                    <span>{showQuizReview ? "✕ Đóng lời giải chi tiết" : "📖 Xem đáp án & Lời giải LaTeX, TikZ"}</span>
                  </button>

                  <button
                    onClick={() => setCurrentView(currentUserSession.role === 'student' ? 'student_portal' : 'teacher_dashboard')}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition border border-slate-700 cursor-pointer"
                    id="btn-return-from-scorecard"
                  >
                    {currentUserSession.role === 'student' ? "Trở về Cổng Học Sinh 🎒" : "Trở về phòng học giáo viên 🏫"}
                  </button>
                </div>

                {/* Substantially detailed pedagogical solution reviews (Math LaTeX + TikZ study guide) */}
                {showQuizReview && lastSubmittedScore.exam && (
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-slate-850 p-5 rounded-2xl border border-slate-755 space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                      <div className="flex items-center justify-between border-b border-slate-750 pb-2.5">
                        <h3 className="text-sm font-bold text-indigo-405 flex items-center gap-1.5 uppercase tracking-wide">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Phần đối chiếu đáp án & Lời giải chi tiết
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({lastSubmittedScore.exam.questions.length} câu hỏi)
                        </span>
                      </div>

                      <div className="space-y-4">
                        {lastSubmittedScore.exam.questions.map((q: Question, idx: number) => {
                          const studentAns = lastSubmittedScore.responses[q.id] || "Không trả lời";
                          let isCorrect = studentAns === q.correctAnswer;
                          
                          if (q.type === 'short_answer') {
                            isCorrect = studentAns.trim().toLowerCase() === (q.correctAnswer || "").trim().toLowerCase();
                          } else if (q.type === 'true_false') {
                            const stdP = (studentAns || "").split(",");
                            const corP = (q.correctAnswer || "").split(",");
                            let matches = 0;
                            for (let i = 0; i < 4; i++) {
                              if (stdP[i] && corP[i] && stdP[i].toLowerCase().trim() === corP[i].toLowerCase().trim()) {
                                matches++;
                              }
                            }
                            isCorrect = matches === 4;
                          }

                          return (
                            <div key={q.id} className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                              isCorrect 
                                ? "bg-emerald-950/20 border-emerald-500/20 shadow-sm" 
                                : "bg-red-950/15 border-red-500/20"
                            }`}>
                              {/* Header question status bar */}
                              <div className="flex justify-between items-center bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                                <span className="font-bold text-slate-300 font-mono">Câu hỏi {idx + 1} ({q.points}đ)</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                                  isCorrect ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" : "bg-red-950/80 text-red-400 border border-red-900"
                                }`}>
                                  {isCorrect ? "Đúng" : "Sai / Chưa đủ ý"}
                                </span>
                              </div>

                              {/* Question TEXT with LaTeX MathRenderer */}
                              <div className="text-sm font-semibold text-slate-200 leading-relaxed font-sans">
                                <MathRenderer text={q.text} />
                              </div>

                              {/* Attached snapshot image */}
                              {q.image && (
                                <div className="max-w-xs bg-white p-1 rounded-lg border border-slate-700">
                                  <img src={q.image} alt={`Ảnh câu ${idx+1}`} className="max-h-40 object-contain mx-auto" referrerPolicy="no-referrer" />
                                </div>
                              )}

                              {/* Real TikZ figure render if exists */}
                              {q.tikz && (
                                <div className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-805 rounded-xl max-w-sm">
                                  <span className="text-[9px] font-extrabold text-slate-400 block mb-1 uppercase tracking-wider">Hình vẽ hình học TikZ (Thực tế):</span>
                                  <TikzRenderer code={q.tikz} readOnly={true} />
                                </div>
                              )}

                              {/* Answers comparison panel */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px]">
                                <div className="flex items-center gap-1 text-slate-350">
                                  <span>Đã trả lời:</span>
                                  <strong className={isCorrect ? "text-emerald-400" : "text-red-450"}>{studentAns}</strong>
                                </div>
                                <div className="flex items-center gap-1 text-slate-350">
                                  <span>Đáp án đúng:</span>
                                  <strong className="text-emerald-405">{q.correctAnswer}</strong>
                                </div>
                              </div>

                              {/* Detailed Pedagogical Solution and Code Explainer */}
                              <div className="mt-3.5 space-y-2.5 pt-3.5 border-t border-slate-800/80">
                                {q.explanation && (
                                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/10 rounded-xl leading-relaxed">
                                    <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block mb-1.5 font-sans">🧠 Lời giải chi tiết toán học:</span>
                                    <div className="text-slate-300 font-normal leading-relaxed text-xs md:text-[12.5px] selection:bg-indigo-900">
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
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </main>

      {/* Humble, literal footer conforming to guidelines */}
      <footer className="bg-white text-slate-400 text-xs py-5 text-center shrink-0 border-t border-slate-200">
        <p className="font-mono text-[9px] tracking-wide">MathWonder © 2026 • Toán học - Khám phá - Trải nghiệm • Bảo mật dữ liệu mã hóa SSL tích hợp AzotaShub LMS Portal.</p>
      </footer>
    </div>
  );

}
