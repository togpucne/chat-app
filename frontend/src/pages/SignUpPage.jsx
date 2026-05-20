import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
  });

  const { signUp, isSigningUp } = useAuthStore();

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      return toast.error("Vui lòng nhập họ và tên");
    }
    if (!formData.email.trim()) {
      return toast.error("Vui lòng nhập email");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return toast.error("Định dạng email không hợp lệ");
    }
    if (!formData.phoneNumber.trim()) {
      return toast.error("Vui lòng nhập số điện thoại");
    }
    if (!/^0(3|5|7|8|9)\d{8}$/.test(formData.phoneNumber.trim())) {
      return toast.error("Số điện thoại không hợp lệ (đúng 10 số, đầu số VN 03, 05, 07, 08, 09)");
    }
    if (formData.password.length < 6) {
      return toast.error("Mật khẩu phải có ít nhất 6 ký tự");
    }
    return true;

  };
  const handleSubmit = (e) => {
    e.preventDefault();
    const success = validateForm();
    if (success === true) signUp(formData);
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* LOGO */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-20 h-20 flex items-center justify-center">
                <img src="/logo_no_bg.png" alt="JudoChat Logo" className="w-20 h-20 object-contain" />
              </div>

              <h1 className="text-2xl font-bold mt-2">Tạo Tài Khoản</h1>
              <p className="text-base-content/60">  Bắt đầu với tài khoản miễn phí của bạn  </p>
            </div>
          </div>
          {/* FORM CREATE ACCOUNT */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Họ và Tên</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input input-bordered w-full pl-10"
                  placeholder="Judoit Nguyen"
                  value={formData.fullName}
                  onChange={(e) => setFormData({
                    ...formData,
                    fullName: e.target.value
                  })}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="size-5 text-base-content/40" />
                </div>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Email</span>
              </label>

              <div className="relative">
                <input
                  type="email"
                  className="input input-bordered w-full pl-10"
                  placeholder="judoit@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    email: e.target.value
                  })}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="size-5 text-base-content/40" />
                </div>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Số điện thoại</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  className="input input-bordered w-full pl-10"
                  placeholder="0343635668"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({
                    ...formData,
                    phoneNumber: e.target.value
                  })}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="size-5 text-base-content/40" />
                </div>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Mật khẩu</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input input-bordered w-full pl-10"
                  placeholder="••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({
                    ...formData,
                    password: e.target.value
                  })}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="size-5 text-base-content/40" />
                </div>

                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-5 text-base-content/40" />
                  ) : (
                    <Eye className="size-5 text-base-content/40" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSigningUp}
            >
              {isSigningUp ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Đang tải...
                </>
              ) : (
                "Tạo tài khoản"
              )}
            </button>


            <div className="text-center">
              <p className="text-base-content/60">
                Bạn đã có tài khoản?{" "}
                <Link to="/login" className="link link-primary">
                  Đăng nhập
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <AuthImagePattern
        title="Tham gia cộng đồng"
        subtitle="Kết nối bạn bè, trao đổi, chia sẻ kiến thức và ở đây bạn sẽ tìm thấy những điều thú vị khác"
      />
    </div>);
};

export default SignUpPage;
