import React, { useState } from "react";
import { googleSignIn, logout, getAccessToken } from "../utils/firebaseAuth";
import { User } from "firebase/auth";
import { Registration } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";
import { 
  LogIn, UserCheck, ShieldAlert, GraduationCap, Users, 
  Settings, Building2, Phone, BookOpen, AlertCircle, ChevronRight, LogOut, RefreshCw
} from "lucide-react";

interface AisAuthGateProps {
  registrations: Registration[];
  onRegister: (data: Omit<Registration, 'id' | 'createdAt' | 'status'>) => Promise<void> | void;
  onLoginSuccess: (user: { email: string; name: string; role: 'student' | 'teacher' | 'admin' }) => void;
  onBypass: (role: 'student' | 'teacher' | 'admin', email?: string, name?: string) => void;
  onUpdatePassword?: (email: string, nextPassword: string) => void;
}

export default function AisAuthGate({
  registrations,
  onRegister,
  onLoginSuccess,
  onBypass,
  onUpdatePassword
}: AisAuthGateProps) {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  // Google Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [school, setSchool] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Non-Google login & register states
  const [directUser, setDirectUser] = useState<{ email: string; name: string; role: 'student' | 'teacher' } | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mw_direct_user");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [directName, setDirectName] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [directRole, setDirectRole] = useState<'student' | 'teacher'>('student');
  const [directSchool, setDirectSchool] = useState("");
  const [directSpecialty, setDirectSpecialty] = useState("");
  const [authTab, setAuthTab] = useState<'google' | 'direct_login' | 'direct_register' | 'forgot_password'>('google');

  // Security question & password recovery states
  const [securityQuestion, setSecurityQuestion] = useState("Tên trường tiểu học đầu tiên của bạn?");
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setName(result.user.displayName || "");
        
        // Check if user is already registered
        const userEmail = result.user.email || "";
        
        // Auto-approve admin
        if (userEmail.toLowerCase() === "baokagami@gmail.com") {
          onLoginSuccess({
            email: userEmail,
            name: result.user.displayName || "Trần Xuân Hiệp",
            role: "admin"
          });
          return;
        }

        const existingReg = registrations.find(r => r.email.toLowerCase() === userEmail.toLowerCase());
        if (existingReg && existingReg.status === "approved") {
          onLoginSuccess({
            email: existingReg.email,
            name: existingReg.name,
            role: existingReg.role
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      const isPopupClosed = err && (err.code === "auth/popup-closed-by-user" || (err.message && err.message.toLowerCase().includes("popup-closed-by-user")));
      const isUnauthorizedDomain = err && (
        err.code === "auth/unauthorized-domain" || 
        err.code === "auth/unauthorized_domain" ||
        (err.message && (
          err.message.toLowerCase().includes("unauthorized-domain") || 
          err.message.toLowerCase().includes("unauthorized_domain") || 
          err.message.toLowerCase().includes("unauthorized domain") ||
          err.message.toLowerCase().includes("unauthorized-client")
        ))
      );

      if (isPopupClosed) {
        setError("Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất. Vui lòng click chọn và thử lại.");
      } else if (isUnauthorizedDomain) {
        setUnauthorizedDomain(window.location.hostname);
        setError(`Lỗi xác thực: Tên miền (${window.location.hostname}) chưa được ủy quyền ủy thác trong danh sách Authorized Domains của Firebase Authentication.`);
      } else {
        setError(`Không thể đăng nhập bằng tài khoản Google: ${err?.message || "Vui lòng bấm thử lại."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!directEmail.trim()) {
      setError("Vui lòng nhập Tài khoản / Email đăng nhập của bạn.");
      return;
    }
    if (!directPassword) {
      setError("Vui lòng nhập mật khẩu tài khoản của bạn.");
      return;
    }
    const emailLower = directEmail.trim().toLowerCase();
    
    // Auto-approve admin with requested initial password Hieptran275@
    if (emailLower === "baokagami@gmail.com") {
      const adminReg = registrations.find(r => r.email.toLowerCase() === "baokagami@gmail.com");
      const correctAdminPass = adminReg?.password || "Hieptran275@";
      if (directPassword !== correctAdminPass) {
        setError("Mật khẩu Quản trị viên (baokagami@gmail.com) không chính xác. Vui lòng nhập đúng mật khẩu!");
        return;
      }
      onLoginSuccess({
        email: emailLower,
        name: "Quản trị viên Trần Xuân Hiệp",
        role: "admin"
      });
      return;
    }

    const reg = registrations.find(r => r.email.toLowerCase() === emailLower);
    if (reg) {
      const correctPassword = reg.password || "123456";
      if (directPassword !== correctPassword) {
        setError("Mật khẩu đăng nhập không chính xác! Toàn bộ tài khoản ban đầu có mật khẩu mặc định là 123456.");
        return;
      }
      
      const userObj: { email: string; name: string; role: 'student' | 'teacher' } = {
        email: reg.email,
        name: reg.name,
        role: reg.role as 'student' | 'teacher'
      };

      if (reg.status === "approved") {
        onLoginSuccess(userObj);
      } else {
        setDirectUser(userObj);
        localStorage.setItem("mw_direct_user", JSON.stringify(userObj));
      }
    } else {
      setError("Tài khoản / Email này chưa được đăng ký trong danh sách. Vui lòng chuyển qua tab [Đăng ký Tài khoản] bên cạnh để tạo yêu cầu nhanh.");
    }
  };

  const handleDirectRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailLower = directEmail.trim().toLowerCase();
    if (!directName || !directEmail || !directPhone || !directSchool) {
      setError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
      return;
    }

    if (!directPassword || directPassword.length < 4) {
      setError("Yêu cầu nhập mật khẩu bảo mật dài ít nhất 4 ký tự.");
      return;
    }

    const finalQuestion = securityQuestion === "Câu hỏi tự đặt..." ? customSecurityQuestion.trim() : securityQuestion;
    if (!finalQuestion || !securityAnswer.trim()) {
      setError("Vui lòng chọn hoặc nhập Câu hỏi bảo mật và Câu trả lời.");
      return;
    }

    if (emailLower.length < 3) {
      setError("Tên tài khoản/Email đăng ký cần chứa ít nhất 3 ký tự.");
      return;
    }

    const existingReg = registrations.find(r => r.email.toLowerCase() === emailLower);
    if (existingReg) {
      setError("Tài khoản/Email này đã tồn tại trên hệ thống. Vui lòng chuyển qua tab [Đăng nhập] để vào trực tiếp.");
      return;
    }

    setLoading(true);
    try {
      await onRegister({
        name: directName,
        email: emailLower,
        password: directPassword,
        securityQuestion: finalQuestion,
        securityAnswer: securityAnswer.trim(),
        phone: directPhone,
        role: directRole,
        school: directSchool,
        specialty: directRole === 'teacher' ? directSpecialty : undefined
      });

      const userObj: { email: string; name: string; role: 'student' | 'teacher' } = {
        email: emailLower,
        name: directName,
        role: directRole
      };
      setDirectUser(userObj);
      localStorage.setItem("mw_direct_user", JSON.stringify(userObj));
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Gặp lỗi bất ngờ khi gửi đăng ký lên máy chủ: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser || !googleUser.email) return;
    if (!name || !phone || !school) {
      setError("Vui lòng nhập đầy đủ các thông tin bắt buộc.");
      return;
    }

    const finalQuestion = securityQuestion === "Câu hỏi tự đặt..." ? customSecurityQuestion.trim() : securityQuestion;
    if (!finalQuestion || !securityAnswer.trim()) {
      setError("Vui lòng chọn hoặc nhập Câu hỏi bảo mật và Câu trả lời.");
      return;
    }

    setLoading(true);
    try {
      await onRegister({
        name,
        email: googleUser.email,
        password: directPassword || "123456",
        securityQuestion: finalQuestion,
        securityAnswer: securityAnswer.trim(),
        phone,
        role,
        school,
        specialty: role === 'teacher' ? specialty : undefined
      });
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Gặp lỗi khi lưu thông tin đăng ký liên kết Google: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecoverySuccessMessage(null);

    const emailLower = recoveryEmail.trim().toLowerCase();
    if (!emailLower || !recoveryPhone.trim() || !recoveryAnswer.trim() || !newPassword.trim()) {
      setError("Vui lòng điền đầy đủ tất cả thông tin khôi phục mật khẩu.");
      return;
    }

    if (newPassword.length < 4) {
      setError("Mật khẩu mới yêu cầu tối thiểu 4 ký tự.");
      return;
    }

    const reg = registrations.find(r => r.email.toLowerCase() === emailLower);
    if (!reg) {
      setError("Không tìm thấy tài khoản đăng ký với email này trên hệ thống.");
      return;
    }

    // Verify phone number (ignore space and compare)
    const cleanRegPhone = reg.phone.replace(/\s+/g, '');
    const cleanInputPhone = recoveryPhone.trim().replace(/\s+/g, '');
    if (cleanRegPhone !== cleanInputPhone) {
      setError("Số điện thoại đăng ký không chính xác. Vui lòng nhập đúng số điện thoại!");
      return;
    }

    // Verify security answer (case insensitive and trimmed)
    const correctAns = (reg.securityAnswer || "Lê Quý Đôn").trim().toLowerCase();
    const inputAns = recoveryAnswer.trim().toLowerCase();
    if (correctAns !== inputAns) {
      setError("Câu trả lời bảo mật không chính xác. Đọc gợi ý: Mặc định nếu chưa đổi là 'Lê Quý Đôn'.");
      return;
    }

    // All checks pass! Let's update password
    if (onUpdatePassword) {
      onUpdatePassword(emailLower, newPassword);
      setRecoverySuccessMessage("Khôi phục mật khẩu thành công! Bạn đang chuẩn bị được chuyển hướng về trang Đăng nhập...");
      
      // Auto-fill and transition back to login page
      setDirectEmail(emailLower);
      setDirectPassword(newPassword);
      
      setTimeout(() => {
        setAuthTab('direct_login');
        setRecoverySuccessMessage(null);
        setRecoveryEmail("");
        setRecoveryPhone("");
        setRecoveryAnswer("");
        setNewPassword("");
      }, 3000);
    } else {
      setError("Hệ thống chưa cấu hình cập nhật mật khẩu.");
    }
  };

  const handleSignOut = async () => {
    if (googleUser) {
      await logout();
      setGoogleUser(null);
    }
    setDirectUser(null);
    localStorage.removeItem("mw_direct_user");
    setError(null);
  };

  // Find existing registration for logged in user
  const userRegistration = googleUser 
    ? registrations.find(r => r.email.toLowerCase() === (googleUser.email || "").toLowerCase())
    : directUser
      ? (registrations.find(r => r.email.toLowerCase() === directUser.email.toLowerCase()) || {
          id: `pending-${directUser.email}`,
          name: directUser.name,
          email: directUser.email,
          phone: "Đang tải...",
          school: "Đang tải...",
          role: directUser.role,
          status: "pending",
          createdAt: new Date().toISOString()
        } as Registration)
      : null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6" id="auth-gate-wrapper">
      <div className="max-w-md w-full bg-slate-850/95 border border-slate-755 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl"></div>

        <div className="text-center relative z-10">
          <div className="flex justify-center items-center gap-2 select-none mb-4">
            <span className="text-3xl font-black text-blue-500 tracking-tighter leading-none">Δ</span>
            <span className="text-3xl font-black text-amber-500 tracking-tighter -ml-3 leading-none">W</span>
            <span className="text-slate-300 ml-1 text-xs uppercase tracking-widest font-mono border-l border-slate-700 pl-3">Portal</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Hệ thống Đăng Ký Trực Tuyến</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Học tập chất lượng cao, giám sát thông minh, đồng bộ dữ liệu tới Google Sheets hệ sinh thái MathWonder.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/40 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2.5 relative z-10">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {unauthorizedDomain && (
          <div className="p-4 bg-slate-900/90 border border-amber-500/35 rounded-2xl text-xs space-y-3 relative z-10 animate-fadeIn text-left">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-[12px] uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Cần cấu hình Authorized Domain</span>
            </div>
            
            <div className="p-3 bg-indigo-950/50 border border-indigo-500/20 rounded-xl space-y-1">
              <p className="text-[11px] text-indigo-350 font-bold flex items-center gap-1">
                <span>💡 Hướng dẫn nhanh cho các em học sinh:</span>
              </p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Để đăng ký tài khoản mới mà không gặp lỗi này, các em chỉ cần bấm <strong className="text-indigo-400">Đóng thông báo này</strong>, sau đó chọn tab <strong className="text-white">"Đăng ký Tài khoản"</strong> hoặc <strong className="text-white">"Đăng nhập trực tiếp"</strong> bên dưới để đăng ký trực tiếp bằng Tên và Mật khẩu tự chọn rất đơn giản!
              </p>
            </div>

            <p className="text-slate-350 text-[11px] leading-relaxed">
              <strong>Dành cho Quản trị viên (Thầy Hiệp):</strong> Tên miền Vercel này chưa được cấu hình ủy nhiệm trong cài đặt Firebase. Thầy hãy thực hiện theo các bước sau để cho phép đăng nhập bằng Google:
            </p>
            <div className="p-2 bg-slate-955 border border-slate-800 rounded-lg font-mono text-[11px] text-emerald-400 select-all flex justify-between items-center bg-black/45">
              <span>{unauthorizedDomain}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded font-sans text-slate-400 font-bold">Copy</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 pl-1">
              <div className="flex items-start gap-1.5">
                <span className="text-amber-500 font-black">1.</span>
                <span>Truy cập trang cấu hình auth: <a href={`https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || "splendid-topic-xmvz5"}/authentication/settings`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline underline-offset-2 font-bold inline-flex items-center gap-0.5 font-sans">Firebase Console Settings →</a></span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-500 font-black">2.</span>
                <span>Nhấp chọn mục <strong>Miền được ủy quyền</strong> (Authorized domains).</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-500 font-black">3.</span>
                <span>Nhấp <strong>Thêm miền</strong> (Add domain) và điền tên miền đã sao chép bên trên vào.</span>
              </div>
            </div>
            <div className="border-t border-slate-800/80 my-2 pt-2.5 text-center">
              <div className="flex items-center justify-between gap-2.5 mb-2.5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">⚡ Chọn Đăng nhập nhanh để trải nghiệm ngay:</p>
                <button 
                  onClick={() => setUnauthorizedDomain(null)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-bold cursor-pointer"
                >
                  Đóng/Bỏ qua lỗi
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onBypass('student', 'hocsinh@gmail.com', 'Học Học Sinh Thử Nghiệm')}
                  className="py-2 px-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/20 text-indigo-300 rounded-lg text-[10px] font-black transition cursor-pointer"
                >
                  🎒 Giả lập Học Sinh
                </button>
                <button
                  type="button"
                  onClick={() => onBypass('teacher', 'teacher.wonder@gmail.com', 'Cô Trần Phương Linh')}
                  className="py-2 px-2 bg-blue-950 hover:bg-blue-900 border border-blue-500/20 text-blue-300 rounded-lg text-[10px] font-black transition cursor-pointer"
                >
                  🏫 Giả lập Giáo Viên
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 relative z-10">
          
          {/* STATE 1: Not logged in */}
          {!googleUser && !directUser && (
            <div className="space-y-4">
              
              {/* Premium Auth Tabs Selection */}
              <div className="flex bg-slate-900/60 p-1 border border-slate-800 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => { setAuthTab('google'); setError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer text-center ${
                    authTab === 'google'
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🚀 Google Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('direct_login'); setError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer text-center ${
                    authTab === 'direct_login' || authTab === 'forgot_password'
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🔑 Đăng nhập trực tiếp
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('direct_register'); setError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer text-center ${
                    authTab === 'direct_register'
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📝 Đăng ký Tài khoản
                </button>
              </div>

              {authTab === 'google' && (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-[10px] text-slate-450 text-center">Phương thức đăng nhập tiêu chuẩn bằng tài khoản Google (Yêu cầu popup xác thực)</p>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 hover:bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer animate-pulse"
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
                    ) : (
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.123C18.29 1.846 15.483 1 12.24 1c-6.076 0-11 4.924-11 11s4.924 11 11 11c6.342 0 10.55-4.456 10.55-10.743 0-.726-.078-1.282-.172-1.972H12.24z"
                        />
                      </svg>
                    )}
                    <span>{loading ? "Đang xác thực Google..." : "Đăng nhập nhanh bằng Google"}</span>
                  </button>
                </div>
              )}

              {authTab === 'direct_login' && (
                <form onSubmit={handleDirectLogin} className="space-y-4 text-xs animate-fadeIn">
                  <p className="text-[10px] text-amber-400 text-center font-bold">Nhập chính xác thông tin Tài khoản/Email và Mật khẩu của bạn.</p>
                  <div className="space-y-3.5 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-h-[280px] overflow-y-auto">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tên tài khoản / Email đăng nhập</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: baokagami@gmail.com hoặc học sinh tự đặt"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono tracking-wide text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mật khẩu tài khoản</label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold focus:outline-none cursor-pointer"
                        >
                          {showPassword ? "Ẩn bớt" : "Hiển thị"}
                        </button>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Nhập mật khẩu (mặc định cho các học sinh là 123456)"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] text-slate-500">Mật khẩu ban đầu của Admin là Hieptran275@</span>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('forgot_password'); setError(null); }}
                      className="text-[10px] text-amber-500 hover:text-amber-400 hover:underline font-bold focus:outline-none cursor-pointer"
                    >
                      🔑 Quên mật khẩu? Khôi phục
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" /> Đăng nhập hệ thống bảo mật ✓
                  </button>
                </form>
              )}

              {authTab === 'forgot_password' && (
                <form onSubmit={handlePasswordRecovery} className="space-y-4 text-xs animate-fadeIn text-left">
                  <div className="text-center">
                    <span className="px-2.5 py-1 bg-amber-550/10 text-amber-400 border border-amber-500/20 text-[10px] font-black rounded-lg uppercase tracking-wider">Khôi phục mật khẩu bảo mật</span>
                    <p className="text-[10px] text-slate-400 mt-2">Xác minh Số điện thoại và trả lời đúng Câu hỏi bảo mật để tự khôi phục tài khoản.</p>
                  </div>

                  {recoverySuccessMessage && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-bold text-center">
                      ✨ {recoverySuccessMessage}
                    </div>
                  )}

                  <div className="space-y-3.5 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-h-[300px] overflow-y-auto">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Địa chỉ Gmail tài khoản *</label>
                      <input
                        type="email"
                        placeholder="Ví dụ: hoctro@gmail.com hoặc baokagami@gmail.com"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-505 font-mono text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Số điện thoại đăng ký *</label>
                      <input
                        type="text"
                        placeholder="Nhập chính xác số điện thoại đăng ký tài khoản"
                        value={recoveryPhone}
                        onChange={(e) => setRecoveryPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-505 font-mono text-xs"
                        required
                      />
                    </div>

                    {(() => {
                      const foundReg = registrations.find(r => r.email.toLowerCase() === recoveryEmail.trim().toLowerCase());
                      const displayQuestion = foundReg?.securityQuestion || "Tên trường tiểu học đầu tiên của bạn? (Học sinh cũ có đáp án mặc định là: Lê Quý Đôn)";
                      return (
                        <div className="space-y-3 p-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl">
                          <div className="space-y-1">
                            <span className="block text-[10px] text-indigo-400 uppercase font-extrabold tracking-wider">Câu hỏi bảo mật của tài khoản:</span>
                            <span className="block text-xs text-white font-bold italic mb-1.5">{displayQuestion}</span>
                            <input
                              type="text"
                              placeholder="Trình bày đúng câu trả lời (Ví dụ: Lê Quý Đôn hoặc Newton)"
                              value={recoveryAnswer}
                              onChange={(e) => setRecoveryAnswer(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mật khẩu mới muốn đổi *</label>
                            <input
                              type="password"
                              placeholder="Nhập mật khẩu mới (ít nhất 4 ký tự)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-505 text-xs"
                              required
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('direct_login'); setError(null); }}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                    >
                      Bỏ qua
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-950/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Đặt lại mật khẩu mới ✓
                    </button>
                  </div>
                </form>
              )}

              {authTab === 'direct_register' && (
                <form onSubmit={handleDirectRegister} className="space-y-3.5 text-xs animate-fadeIn">
                  <p className="text-[10px] text-slate-450 text-center">Đăng ký thành viên trực tuyến sử dụng Email bất kỳ hoặc Tên tài khoản tự chọn.</p>
                  <div className="space-y-3.5 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-h-[360px] overflow-y-auto text-left">
                    <div>
                      <label className="block text-[10px] text-slate-455 uppercase font-bold mb-1">Họ tên đầy đủ *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Đỗ Hồng Anh"
                        value={directName}
                        onChange={(e) => setDirectName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-455 uppercase font-bold mb-1 font-mono">Địa chỉ Email Gmail của bạn *</label>
                      <input
                        type="email"
                        placeholder="tài_khoản@gmail.com"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-slate-455 uppercase font-bold">Mật khẩu bảo mật đăng nhập *</label>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold focus:outline-none cursor-pointer"
                        >
                          {showPassword ? "Ẩn" : "Hiện"}
                        </button>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Đặt mật khẩu tự chọn (tối thiểu 4 ký tự)"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-455 uppercase font-bold mb-1">Số điện thoại liên hệ *</label>
                      <input
                        type="tel"
                        placeholder="Ví dụ: 0987123456"
                        value={directPhone}
                        onChange={(e) => setDirectPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505"
                        required
                      />
                    </div>

                    <div className="space-y-3.5 p-3 bg-indigo-950/20 border border-indigo-500/15 rounded-xl">
                      <div className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider">Cấu hình Câu hỏi bảo mật (Để tự đổi mật khẩu)</div>
                      
                      <div className="space-y-1 text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chọn câu hỏi bảo mật *</label>
                        <select
                          value={securityQuestion}
                          onChange={(e) => setSecurityQuestion(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                        >
                          <option value="Tên trường tiểu học đầu tiên của bạn?">Tên trường tiểu học đầu tiên của bạn?</option>
                          <option value="Thần tượng toán học của bạn là ai?">Thần tượng toán học của bạn là ai? (Newton, Euler,...)</option>
                          <option value="Tên con vật nuôi đầu tiên của bạn?">Tên con vật nuôi đầu tiên của bạn?</option>
                          <option value="Thành phố quê hương của mẹ bạn?">Thành phố quê hương của mẹ bạn?</option>
                          <option value="Câu hỏi tự đặt...">Câu hỏi bảo mật tự đặt...</option>
                        </select>
                      </div>

                      {securityQuestion === "Câu hỏi tự đặt..." && (
                        <div className="space-y-1 text-left animate-fadeIn">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tự soạn câu hỏi *</label>
                          <input
                            type="text"
                            placeholder="Ví dụ: Người giáo viên truyền cảm hứng nhất?"
                            value={customSecurityQuestion}
                            onChange={(e) => setCustomSecurityQuestion(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-1 text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Câu trả lời bảo mật *</label>
                        <input
                          type="text"
                          placeholder="Nhập câu trả lời (Ví dụ: Lê Quý Đôn)"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">Vai trò mong muốn</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setDirectRole('student')}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            directRole === 'student'
                              ? "bg-emerald-950/80 border-emerald-500 text-emerald-400"
                              : "bg-slate-950 border-slate-800 text-slate-400"
                          }`}
                        >
                          <GraduationCap className="w-4 h-4 text-emerald-500" /> Học sinh
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirectRole('teacher')}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            directRole === 'teacher'
                              ? "bg-blue-950/80 border-blue-500 text-blue-400"
                              : "bg-slate-950 border-slate-800 text-slate-400"
                          }`}
                        >
                          <Users className="w-4 h-4 text-blue-505" /> Giáo viên
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-455 uppercase font-bold mb-1">Trường học / Lớp học sở tại *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: THPT Chuyên Lê Hồng Phong"
                        value={directSchool}
                        onChange={(e) => setDirectSchool(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505"
                        required
                      />
                    </div>

                    {directRole === 'teacher' && (
                      <div className="animate-fadeIn">
                        <label className="block text-[10px] text-slate-455 uppercase font-bold mb-1">Chuyên mục giảng dạy chính</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Toán Đại Số & Giải Tích"
                          value={directSpecialty}
                          onChange={(e) => setDirectSpecialty(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-505"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-550 text-white font-bold rounded-xl text-xs tracking-wide shadow-lg transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    Gửi yêu cầu đăng ký cho Admin <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              <div className="relative flex items-center justify-center my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <span className="relative z-10 px-3 bg-slate-850 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hoặc sử dụng thử nghiệm</span>
              </div>

              {/* Simulation options for review */}
              <div className="space-y-2">
                <div className="text-[10px] text-slate-500 text-center uppercase tracking-wide font-black">Lối tắt Giả Lập nhanh (Để Duyệt thử)</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onBypass('student', 'hocsinh@gmail.com', 'Học Sinh Thử Nghiệm')}
                    className="py-2.5 px-3 bg-indigo-950/65 hover:bg-indigo-900/65 border border-indigo-500/10 hover:border-indigo-505 text-[11px] text-indigo-300 font-bold rounded-xl text-center cursor-pointer transition"
                  >
                    🎒 Học sinh giả lập
                  </button>
                  <button
                    onClick={() => onBypass('teacher', 'teacher.wonder@gmail.com', 'Cô Trần Phương Linh')}
                    className="py-2.5 px-3 bg-blue-950/65 hover:bg-blue-900/65 border border-blue-500/10 hover:border-blue-505 text-[11px] text-blue-300 font-bold rounded-xl text-center cursor-pointer transition"
                  >
                    🏫 Giáo viên giả lập
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: Google logged in but not registered */}
          {googleUser && !userRegistration && (
            <form onSubmit={handleFormSubmit} className="space-y-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">Email: <strong className="text-white">{googleUser.email}</strong></span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-400 hover:text-red-350 font-bold flex items-center gap-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Thoát
                </button>
              </div>

              <div className="space-y-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="text-xs text-indigo-400 font-black uppercase tracking-wider border-b border-slate-800 pb-1 mb-2">Đăng ký thông tin tài khoản</div>
                
                <div>
                  <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">Họ tên của bạn</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nhập họ và tên đầy đủ"
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">Số điện thoại *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ví dụ: 0987123456"
                      className="w-full pl-9 text-xs bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 p-3.5 bg-indigo-950/20 border border-indigo-500/15 rounded-xl">
                  <div className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider">Cấu hình Câu hỏi bảo mật (Để tự đổi mật khẩu)</div>
                  
                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chọn câu hỏi *</label>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    >
                      <option value="Tên trường tiểu học đầu tiên của bạn?">Tên trường tiểu học đầu tiên của bạn?</option>
                      <option value="Thần tượng toán học của bạn là ai?">Thần tượng toán học của bạn là ai? (Newton, Euler,...)</option>
                      <option value="Tên con vật nuôi đầu tiên của bạn?">Tên con vật nuôi đầu tiên của bạn?</option>
                      <option value="Thành phố quê hương của mẹ bạn?">Thành phố quê hương của mẹ bạn?</option>
                      <option value="Câu hỏi tự đặt...">Câu hỏi bảo mật tự đặt...</option>
                    </select>
                  </div>

                  {securityQuestion === "Câu hỏi tự đặt..." && (
                    <div className="space-y-1 text-left animate-fadeIn">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tự soạn câu hỏi *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Người giáo viên truyền cảm hứng nhất?"
                        value={customSecurityQuestion}
                        onChange={(e) => setCustomSecurityQuestion(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-indigo-505 text-xs"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-1 text-left">
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Câu trả lời bảo mật của bạn *</label>
                    <input
                      type="text"
                      placeholder="Câu trả lời (Ví dụ: Lê Quý Đôn)"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-505 text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">Vai trò thành viên</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        role === 'student'
                          ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" /> Học sinh (Student)
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        role === 'teacher'
                          ? "bg-blue-950 border-blue-500 text-blue-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Users className="w-4 h-4" /> Giáo viên (Teacher)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">
                    {role === 'teacher' ? "Trường học/Đơn vị công tác *" : "Trường học / Lớp học sở tại *"}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="Ví dụ: Trường THPT Chuyên Lê Hồng Phong"
                      className="w-full pl-9 text-xs bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {role === 'teacher' && (
                  <div className="animate-fadeIn">
                    <label className="block text-[10px] text-slate-450 uppercase font-bold mb-1">Chuyên môn giảng dạy</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        placeholder="Ví dụ: Toán Đại Số & Giải Tích"
                        className="w-full pl-9 text-xs bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm tracking-wide shadow-lg shadow-indigo-950/50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                Gửi yêu cầu đăng ký cho Admin <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STATE 3: Logged in but status is PENDING */}
          {userRegistration && userRegistration.status === 'pending' && (
            <div className="space-y-4 border border-amber-500/20 bg-amber-950/15 p-5 rounded-2xl text-center space-y-4 animate-fadeIn">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] bg-amber-950 text-amber-400 font-extrabold px-2 py-0.5 rounded border border-amber-500/15 uppercase tracking-wider">Đang chờ xét duyệt</span>
                <h3 className="text-white font-bold text-base mt-2">Đăng ký của bạn đang chờ phê duyệt</h3>
                <p className="text-[11px] text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                  Quản trị viên <strong>Trần Xuân Hiệp (baokagami@gmail.com)</strong> cần cấp quyền trước khi bạn có thể sử dụng các chức năng của MathWonder.
                </p>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-left text-[11px] space-y-1">
                <div className="text-slate-500">Người đăng ký: <strong className="text-slate-300">{userRegistration.name}</strong></div>
                <div className="text-slate-500">Vai trò yêu cầu: <strong className="text-indigo-400 uppercase">{userRegistration.role === 'teacher' ? "Giáo viên 🏫" : "Học sinh 🎒"}</strong></div>
                <div className="text-slate-500">Số điện thoại: <strong className="text-slate-300 font-mono">{userRegistration.phone}</strong></div>
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 text-xs text-slate-300 font-bold rounded-xl transition cursor-pointer"
                >
                  Đăng nhập tài khoản khác
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: Logged in but REJECTED */}
          {userRegistration && userRegistration.status === 'rejected' && (
            <div className="space-y-4 border border-red-500/20 bg-red-950/15 p-5 rounded-2xl text-center space-y-4 animate-fadeIn">
              <div className="w-12 h-12 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] bg-red-950 text-red-400 font-extrabold px-2 py-0.5 rounded border border-red-500/15 uppercase tracking-wider">Từ Chối Trực Tiếp</span>
                <h3 className="text-white font-bold text-base mt-2">Yêu cầu đăng ký bị từ chối</h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Thành thật xin lỗi! Đăng ký tài khoản lớp của bạn hiện không nhận được phê duyệt từ thầy Trần Xuân Hiệp.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 bg-slate-800 hover:bg-slate-755 border border-slate-705 text-xs text-slate-300 font-bold rounded-xl transition cursor-pointer"
              >
                Trở về trang Đăng nhập chính
              </button>
            </div>
          )}

          {/* STATE 5: Logged in and APPROVED */}
          {userRegistration && userRegistration.status === 'approved' && (
            <div className="space-y-4 border border-emerald-500/20 bg-emerald-950/15 p-6 rounded-2xl text-center animate-fadeIn">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <UserCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded border border-emerald-500/15 uppercase tracking-wider">Đã phê duyệt ✅</span>
                <h3 className="text-white font-bold text-base mt-2">Tài khoản khả dụng!</h3>
                <p className="text-[11px] text-slate-400 mt-1">Chào mừng <strong className="text-slate-200">{userRegistration.name}</strong> quay trở lại MathWonder.</p>
              </div>

              <button
                type="button"
                onClick={() => onLoginSuccess({
                  email: userRegistration.email,
                  name: userRegistration.name,
                  role: userRegistration.role
                })}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-555 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer"
              >
                Vào hệ thống MathWonder !
              </button>
            </div>
          )}

        </div>

        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-500">Bảo mật tích hợp Google OAuth 2.0 & Firebase Auth</p>
        </div>

      </div>
    </div>
  );
}
