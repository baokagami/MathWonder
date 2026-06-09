import { useState, useEffect } from "react";
import { Registration } from "../types";
import { findOrCreateSpreadsheet, syncDataToSheet, getAccessToken, googleSignIn, db } from "../utils/firebaseAuth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { 
  ShieldCheck, FileSpreadsheet, RefreshCw, Check, X, 
  ExternalLink, Users, GraduationCap, Clock, Phone, MapPin, 
  AlertCircle, Shield, ArrowRight, BookOpen, Link2, Trash2, Search
} from "lucide-react";

interface AdminRegistrationManagerProps {
  registrations: Registration[];
  onUpdateStatus: (id: string, newStatus: 'approved' | 'rejected') => void;
  onSyncAll: () => void;
  onDeleteRegistration?: (id: string) => void;
}

export default function AdminRegistrationManager({
  registrations,
  onUpdateStatus,
  onSyncAll,
  onDeleteRegistration
}: AdminRegistrationManagerProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States to hold the Spreadsheet details (IDs and URLs)
  const [studentSheetId, setStudentSheetId] = useState<string>(() => localStorage.getItem("mw_student_sheet_id") || "");
  const [studentSheetUrl, setStudentSheetUrl] = useState<string>(() => localStorage.getItem("mw_student_sheet_url") || "");
  const [teacherSheetId, setTeacherSheetId] = useState<string>(() => localStorage.getItem("mw_teacher_sheet_id") || "");
  const [teacherSheetUrl, setTeacherSheetUrl] = useState<string>(() => localStorage.getItem("mw_teacher_sheet_url") || "");

  // Filters
  const [filterRole, setFilterRole] = useState<'all' | 'student' | 'teacher'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Load Saved Sheet Configs on render & sync from Firebase for multi-machine access
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "admin_settings", "sheets"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.studentSheetId) {
          setStudentSheetId(data.studentSheetId);
          localStorage.setItem("mw_student_sheet_id", data.studentSheetId);
        }
        if (data.studentSheetUrl) {
          setStudentSheetUrl(data.studentSheetUrl);
          localStorage.setItem("mw_student_sheet_url", data.studentSheetUrl);
        }
        if (data.teacherSheetId) {
          setTeacherSheetId(data.teacherSheetId);
          localStorage.setItem("mw_teacher_sheet_id", data.teacherSheetId);
        }
        if (data.teacherSheetUrl) {
          setTeacherSheetUrl(data.teacherSheetUrl);
          localStorage.setItem("mw_teacher_sheet_url", data.teacherSheetUrl);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Save to LocalStorage if changed locally (useful fallback)
  useEffect(() => {
    if (studentSheetId) localStorage.setItem("mw_student_sheet_id", studentSheetId);
    if (studentSheetUrl) localStorage.setItem("mw_student_sheet_url", studentSheetUrl);
  }, [studentSheetId, studentSheetUrl]);

  useEffect(() => {
    if (teacherSheetId) localStorage.setItem("mw_teacher_sheet_id", teacherSheetId);
    if (teacherSheetUrl) localStorage.setItem("mw_teacher_sheet_url", teacherSheetUrl);
  }, [teacherSheetId, teacherSheetUrl]);

  // Keep Google Sheet perfectly synced to Firestore real-time whenever registrations state changes
  useEffect(() => {
    const token = getAccessToken();
    if (token && studentSheetId && teacherSheetId && registrations.length > 0) {
      const timer = setTimeout(() => {
        triggerSyncToSheets().catch(console.error);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [registrations, studentSheetId, teacherSheetId]);

  // Handle Sheet Creation and Sync
  const handleSetupSheets = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let token = getAccessToken();
      if (!token) {
        // Try to trigger Google sign-in to dynamically acquire access token
        setSuccessMsg("Khoan đã! Đang yêu cầu xác thực Google Account bằng Popup...");
        const result = await googleSignIn();
        if (result) {
          token = result.accessToken;
        }
      }
      if (!token) {
        throw new Error("Chưa có access token hoạt động! Chúng tôi cần quyền Google Sheets của bạn để đồng bộ.");
      }

      // 1. Create/Retrieve Student Sheet
      const studentHeaders = ["ID Đăng ký", "Họ và tên", "Email", "Số điện thoại", "Trường học", "Thời gian đăng ký", "Trạng thái phê duyệt"];
      const studentSheet = await findOrCreateSpreadsheet("Danh sách Học sinh Đăng ký - MathWonder", studentHeaders);
      setStudentSheetId(studentSheet.id);
      setStudentSheetUrl(studentSheet.url);

      // 2. Create/Retrieve Teacher Sheet
      const teacherHeaders = ["ID Đăng ký", "Họ và tên", "Email", "Số điện thoại", "Trường đào tạo/giảng dạy", "Chuyên môn giảng dạy", "Thời gian đăng ký", "Trạng thái phê duyệt"];
      const teacherSheet = await findOrCreateSpreadsheet("Danh sách Giáo viên Đăng ký - MathWonder", teacherHeaders);
      setTeacherSheetId(teacherSheet.id);
      setTeacherSheetUrl(teacherSheet.url);

      setSuccessMsg("Đã kết nối và cấu hình thành công các file Google Sheet trên Google Drive của bạn!");
      
      // Save configuration to Firestore so other administrative machines can access the spreadsheets
      await setDoc(doc(db, "admin_settings", "sheets"), {
        studentSheetId: studentSheet.id,
        studentSheetUrl: studentSheet.url,
        teacherSheetId: teacherSheet.id,
        teacherSheetUrl: teacherSheet.url
      });

      // Auto trigger a first sync
      await triggerSyncToSheets(studentSheet.id, teacherSheet.id);
    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "Xảy ra lỗi bất ngờ khi cấu hình Google Sheets.";
      const isUnauthorizedDomain = error && (
        error.code === "auth/unauthorized-domain" || 
        error.code === "auth/unauthorized_domain" ||
        (error.message && (
          error.message.toLowerCase().includes("unauthorized-domain") || 
          error.message.toLowerCase().includes("unauthorized_domain") || 
          error.message.toLowerCase().includes("unauthorized domain")
        ))
      );
      if (errMsg.includes("popup-closed-by-user")) {
        errMsg = "Cửa sổ đăng nhập Google đã bị đóng. Vui lòng bấm lại và phê duyệt liên kết Sheets.";
      } else if (isUnauthorizedDomain) {
        errMsg = `Lỗi ủy quyền: Tên miền (${window.location.hostname}) chưa được ủy quyền ủy thác trong danh sách Authorized domains của Firebase Console. Vui lòng thêm tên miền này vào mục Authorized domains trong Firebase settings.`;
      }
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const triggerSyncToSheets = async (overrideStId?: string, overrideTchId?: string) => {
    const stId = overrideStId || studentSheetId;
    const tchId = overrideTchId || teacherSheetId;

    if (!stId || !tchId) {
      setErrorMsg("Vui lòng click 'Khởi tạo & Kết nối Google Sheets' trước khi thực hiện đồng bộ.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let token = getAccessToken();
      if (!token) {
        // Try to trigger Google sign-in to dynamically acquire access token
        setSuccessMsg("Đang kết nối lại quyền Google Sheets sinh thái...");
        const result = await googleSignIn();
        if (result) {
          token = result.accessToken;
        }
      }
      if (!token) {
        throw new Error("Chưa có access token hoạt động! Vui lòng đăng nhập Google.");
      }

      // 1. Prepare student rows
      const studentRows = registrations
        .filter(r => r.role === 'student')
        .map(r => [
          r.id,
          r.name,
          r.email,
          r.phone,
          r.school,
          new Date(r.createdAt).toLocaleString('vi-VN'),
          r.status === 'approved' ? "Đã duyệt" : r.status === 'rejected' ? "Từ chối" : "Chờ duyệt"
        ]);

      await syncDataToSheet(stId, studentRows);

      // 2. Prepare teacher rows
      const teacherRows = registrations
        .filter(r => r.role === 'teacher')
        .map(r => [
          r.id,
          r.name,
          r.email,
          r.phone,
          r.school,
          r.specialty || "N/A",
          new Date(r.createdAt).toLocaleString('vi-VN'),
          r.status === 'approved' ? "Đã duyệt" : r.status === 'rejected' ? "Từ chối" : "Chờ duyệt"
        ]);

      await syncDataToSheet(tchId, teacherRows);

      setSuccessMsg("Đồng bộ dữ liệu tài khoản lên Google Sheets của bạn thành công!");
      onSyncAll(); // Call parent hook if needed
    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "Lỗi đồng bộ dữ liệu lên Google Sheets.";
      const isUnauthorizedDomain = error && (
        error.code === "auth/unauthorized-domain" || 
        error.code === "auth/unauthorized_domain" ||
        (error.message && (
          error.message.toLowerCase().includes("unauthorized-domain") || 
          error.message.toLowerCase().includes("unauthorized_domain") || 
          error.message.toLowerCase().includes("unauthorized domain")
        ))
      );
      if (errMsg.includes("popup-closed-by-user")) {
        errMsg = "Cửa sổ liên kết Google bị đóng. Vui lòng bấm thử lại và cấp quyền liên kết Sheets.";
      } else if (isUnauthorizedDomain) {
        errMsg = `Lỗi ủy quyền: Tên miền (${window.location.hostname}) chưa được ủy quyền ủy thác trong danh sách Authorized domains của Firebase Console. Vui lòng thêm tên miền này vào mục Authorized domains trong Firebase settings.`;
      }
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (id: string, status: 'approved' | 'rejected') => {
    onUpdateStatus(id, status);
    
    // Quick notification
    const reg = registrations.find(r => r.id === id);
    if (reg) {
      setSuccessMsg(`Đã chuyển trạng thái tài khoản của ${reg.name} sang: ${status === 'approved' ? "Đã duyệt ✅" : "Từ chối ❌"}`);
      // If sheets are connected, auto-update Sheets
      if (studentSheetId && teacherSheetId) {
        setTimeout(() => {
          triggerSyncToSheets();
        }, 200);
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn XÓA vĩnh viễn tài khoản của "${name}" khỏi danh sách đăng ký?`)) {
      if (onDeleteRegistration) {
        onDeleteRegistration(id);
        setSuccessMsg(`Đã xóa vĩnh viễn thành viên "${name}" khỏi danh sách đăng ký!`);
        // If sheets are connected, auto-update Sheets
        if (studentSheetId && teacherSheetId) {
          setTimeout(() => {
            triggerSyncToSheets();
          }, 200);
        }
      }
    }
  };

  // Filter and sort registrations (newest first so that recently registered students are instantly visible at the top)
  const filteredRegs = registrations
    .filter(r => {
      const roleMatch = filterRole === 'all' || r.role === filterRole;
      const statusMatch = filterStatus === 'all' || r.status === filterStatus;
      
      // Match query
      const query = searchQuery.trim().toLowerCase();
      if (!query) return roleMatch && statusMatch;

      const nameMatch = r.name?.toLowerCase().includes(query);
      const emailMatch = r.email?.toLowerCase().includes(query);
      const phoneMatch = r.phone?.toLowerCase().includes(query);
      const schoolMatch = r.school?.toLowerCase().includes(query);
      
      return roleMatch && statusMatch && (nameMatch || emailMatch || phoneMatch || schoolMatch);
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA; // Newest first
    });

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

  return (
    <div className="bg-slate-50 min-h-[80vh] p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Admin Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-700/50">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-200 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                <Shield className="w-4.5 h-4.5 text-amber-400" />
                ADMIN PANEL • QUẢN TRỊ VIÊN CẤP QUYỀN (BAOKAGAMI@GMAIL.COM)
              </div>
              <h1 className="text-2xl font-black tracking-tight mt-3">Chào thầy Trần Xuân Hiệp!</h1>
              <p className="text-slate-300 text-xs mt-1">
                Quản lý, phê duyệt tài khoản Giáo viên / Học sinh và tự động đồng bộ thời gian thực lên hệ thống Google Sheets cá nhân.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSetupSheets}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Khởi tạo & Kết nối Google Sheets
              </button>

              <button
                onClick={() => triggerSyncToSheets()}
                disabled={loading || !studentSheetId}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Đồng bộ ngay lên Sheets
              </button>
            </div>
          </div>
          
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Users className="w-64 h-64" />
          </div>
        </div>

        {/* Message HUDs */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-3 shadow-xs animate-fadeIn">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">✓</div>
            <div className="grow font-medium">{successMsg}</div>
            <button className="text-emerald-500 hover:text-emerald-700 font-bold" onClick={() => setSuccessMsg(null)}>Xóng</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center gap-3 shadow-xs animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="grow font-medium">{errorMsg}</div>
            <button className="text-red-500 hover:text-red-700 font-bold" onClick={() => setErrorMsg(null)}>Đóng</button>
          </div>
        )}

        {/* Excel Files Configuration Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Danh sách đăng ký Học sinh</h3>
                <p className="text-slate-400 text-xs font-mono mt-0.5 max-w-[250px] truncate">
                  {studentSheetId ? `ID: ${studentSheetId}` : "Chưa kết nối Google Sheet"}
                </p>
              </div>
            </div>
            <div>
              {studentSheetUrl ? (
                <a
                  href={studentSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-100 transition"
                >
                  Mở Sheet <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-400 font-bold py-1 px-2.5 rounded-lg border border-slate-200/50">Chưa tạo</span>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Danh sách đăng ký Giáo viên</h3>
                <p className="text-slate-400 text-xs font-mono mt-0.5 max-w-[250px] truncate">
                  {teacherSheetId ? `ID: ${teacherSheetId}` : "Chưa kết nối Google Sheet"}
                </p>
              </div>
            </div>
            <div>
              {teacherSheetUrl ? (
                <a
                  href={teacherSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition"
                >
                  Mở Sheet <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-400 font-bold py-1 px-2.5 rounded-lg border border-slate-200/50">Chưa tạo</span>
              )}
            </div>
          </div>
        </div>

        {/* Pending Approval Inbox */}
        {registrations.filter(r => r.status === 'pending').length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 shadow-sm animate-fadeIn space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-500 text-white rounded-lg flex items-center justify-center animate-bounce shadow-md">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    Hộp Thư Chờ Duyệt Tài Khoản
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {registrations.filter(r => r.status === 'pending').length} Đơn mới
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">Các yêu cầu học sinh và giáo viên vừa đăng ký đang xếp trong hàng đợi để xét duyệt vào học.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registrations.filter(r => r.status === 'pending').map((reg) => (
                <div 
                  key={`pending-queue-${reg.id}`} 
                  className="bg-white p-4 rounded-2xl border border-amber-150 hover:border-amber-300 shadow-xs flex flex-col justify-between gap-3.5 transition duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-sm">{reg.name}</h4>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                          reg.role === 'teacher' 
                            ? "bg-blue-50 text-blue-600 border border-blue-150" 
                            : "bg-emerald-50 text-emerald-600 border border-emerald-150"
                        }`}>
                          {reg.role === 'teacher' ? "Giáo viên" : "Học sinh"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{reg.email}</p>
                      
                      <div className="mt-2.5 space-y-1 text-slate-500 text-xs">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{reg.phone || "Chưa cung cấp SĐT"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{reg.school || "Chưa cung cấp trường"}</span>
                        </div>
                        {reg.role === 'teacher' && reg.specialty && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-500 font-bold">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{reg.specialty}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-50 pt-3 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono">
                      {reg.createdAt 
                        ? (() => {
                            const d = new Date(reg.createdAt);
                            return isNaN(d.getTime()) ? "Vừa xong" : d.toLocaleString("vi-VN");
                          })()
                        : "Vừa xong"
                      }
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveReject(reg.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-650 text-red-650 hover:text-white rounded-xl border border-red-200 font-extrabold hover:border-red-600 font-sans tracking-wide transition flex items-center gap-1 cursor-pointer"
                        title="Từ chối yêu cầu và từ chối cấp quyền"
                      >
                        <X className="w-3.5 h-3.5" /> Từ chối
                      </button>
                      <button
                        onClick={() => handleApproveReject(reg.id, 'approved')}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold shadow-sm shadow-emerald-500/20 hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
                        title="Phê duyệt kích hoạt tài khoản ngay tức thì"
                      >
                        <Check className="w-3.5 h-3.5" /> Duyệt đơn ✓
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Table Area */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-800 font-extrabold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-505" />
                Danh sách Đăng ký {pendingCount > 0 && <span className="bg-amber-100 border border-amber-200 text-amber-800 font-black px-2 py-0.5 rounded text-[10px] animate-pulse">{pendingCount} Đơn mới</span>}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm Tên, Email, SĐT, Trường..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs text-slate-700 pl-9 pr-3 py-1.5 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white w-56 sm:w-64"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-600 py-1.5 px-3 rounded-xl outline-none"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="student">Học sinh (Student)</option>
                <option value="teacher">Giáo viên (Teacher)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-600 py-1.5 px-3 rounded-xl outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ phê duyệt</option>
                <option value="approved">Đã phê duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredRegs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-700 text-xs">Không có yêu cầu đăng ký nào khớp với bộ lọc</h3>
              <p className="text-[11px] text-slate-400">Các yêu cầu đăng ký tài khoản mới của Giáo viên và Học sinh từ form đăng ký sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Thành viên</th>
                    <th className="px-5 py-3">Vai trò</th>
                    <th className="px-5 py-3">Thông tin liên hệ</th>
                    <th className="px-5 py-3">Trường học / Chuyên môn</th>
                    <th className="px-5 py-3">Ngày đăng ký</th>
                    <th className="px-5 py-3 text-center">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRegs.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800 text-xs sm:text-sm">{reg.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{reg.email}</div>
                        <div className="text-[9px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 inline-block font-mono mt-1 border border-amber-100/60">
                          Mật khẩu: <span className="font-bold">{reg.password || "123456"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg border uppercase tracking-wider ${
                          reg.role === 'teacher' 
                            ? "bg-blue-50 text-blue-600 border-blue-105" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-105"
                        }`}>
                          {reg.role === 'teacher' ? "Giáo viên 🏫" : "Học sinh 🎒"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-405 shrink-0" />
                          <span>{reg.phone}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{reg.school}</span>
                        </div>
                        {reg.role === 'teacher' && reg.specialty && (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold mt-1 pl-5">
                            <BookOpen className="w-3 h-3" /> {reg.specialty}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-400 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-350" />
                          <span>
                            {reg.createdAt 
                              ? (() => {
                                  const d = new Date(reg.createdAt);
                                  return isNaN(d.getTime()) ? "Chưa có ngày" : d.toLocaleString("vi-VN");
                                })()
                              : "Chưa có ngày"
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          reg.status === 'approved' 
                            ? "bg-emerald-100 border-emerald-200 text-emerald-800 shadow-xs" 
                            : reg.status === 'rejected' 
                              ? "bg-red-100 border-red-200 text-red-800" 
                              : "bg-amber-100 border-amber-200 text-amber-800 animate-pulse"
                        }`}>
                          {reg.status === 'approved' ? "Đã duyệt" : reg.status === 'rejected' ? "Bị từ chối" : "Đang chờ duyệt"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {reg.status === 'pending' || reg.status === 'rejected' ? (
                            <button
                              onClick={() => handleApproveReject(reg.id, 'approved')}
                              className="w-7 h-7 bg-emerald-50 hover:bg-emerald-500 border border-emerald-200 text-emerald-600 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer"
                              title="Phê duyệt tài khoản"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : null}

                          {reg.status === 'pending' || reg.status === 'approved' ? (
                            <button
                              onClick={() => handleApproveReject(reg.id, 'rejected')}
                              className="w-7 h-7 bg-red-50 hover:bg-red-500 border border-red-200 text-red-600 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer"
                              title="Từ chối tài khoản opacity-60"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleDelete(reg.id, reg.name)}
                            className="w-7 h-7 bg-rose-50 hover:bg-rose-600 border border-rose-250 text-rose-605 hover:text-white rounded-lg flex items-center justify-center transition cursor-pointer"
                            title="Xóa vĩnh viễn"
                            id={`btn-delete-registration-${reg.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
