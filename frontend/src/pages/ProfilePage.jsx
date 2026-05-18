import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Phone, Check, Edit2, Loader2 } from "lucide-react";

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [fullName, setFullName] = useState(authUser?.fullName || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (authUser?.fullName) setFullName(authUser.fullName);
  }, [authUser?.fullName]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const handleSaveName = async () => {
    if (!fullName.trim() || fullName.trim() === authUser?.fullName) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    await updateProfile({ fullName: fullName.trim() });
    setSavingName(false);
    setIsEditingName(false);
  };

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-base-300 rounded-xl p-6 space-y-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Hồ Sơ Của Bạn</h1>
            <p className="mt-2 text-zinc-400">Quản lý và cập nhật thông tin cá nhân</p>
          </div>

          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser?.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 border-primary/30 shadow-md"
              />

              {/* Upload Overlay */}
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0 
                  bg-primary text-white hover:scale-105
                  p-2.5 rounded-full cursor-pointer shadow-lg
                  transition-all duration-200
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                `}
              >
                <Camera className="w-5 h-5" />

                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>

            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Đang tải lên..." : "Nhấn vào biểu tượng camera để cập nhật ảnh đại diện"}
            </p>
          </div>

          <div className="space-y-6">
            {/* Full Name (Editable) */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Họ và tên
                </span>
                {!isEditingName && (
                  <button 
                    onClick={() => setIsEditingName(true)} 
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit2 className="size-3" /> Chỉnh sửa
                  </button>
                )}
              </div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input input-sm bg-base-100 border-primary flex-1 font-medium text-sm rounded-lg shadow-inner"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="btn btn-primary btn-sm text-white font-bold px-4 rounded-lg shadow-md flex items-center gap-1.5"
                  >
                    {savingName ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Lưu
                  </button>
                  <button
                    onClick={() => {
                      setFullName(authUser?.fullName || "");
                      setIsEditingName(false);
                    }}
                    className="btn btn-ghost btn-sm text-xs font-semibold"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <div className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300 font-medium flex items-center justify-between shadow-sm">
                  <span className="text-base-content text-sm">{authUser?.fullName || "Chưa cập nhật"}</span>
                </div>
              )}
            </div>

            {/* Phone Number (Disabled) */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" /> Số điện thoại
                </span>
                <span className="text-[10px] text-zinc-500 italic font-medium">Không thể thay đổi</span>
              </div>
              <input 
                type="text"
                disabled 
                value={authUser?.phoneNumber || "Chưa cập nhật"} 
                className="input input-sm w-full px-4 py-2.5 bg-base-200/60 text-base-content/60 rounded-lg border border-base-300 cursor-not-allowed font-medium text-sm"
              />
            </div>

            {/* Email Address (Disabled) */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> Địa chỉ Email
                </span>
                <span className="text-[10px] text-zinc-500 italic font-medium">Không thể thay đổi</span>
              </div>
              <input 
                type="text"
                disabled 
                value={authUser?.email || "Chưa có email"} 
                className="input input-sm w-full px-4 py-2.5 bg-base-200/60 text-base-content/60 rounded-lg border border-base-300 cursor-not-allowed font-medium text-sm"
              />
            </div>
          </div>
          <div className="mt-6 bg-base-300 rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Thông tin tài khoản</h2>

            <div className="space-y-3 text-sm">

              {/* Member Since */}
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span>Ngày tham gia</span>
                <span>{authUser?.createdAt?.split("T")[0]}</span>
              </div>

              {/* Account Status */}
              <div className="flex items-center justify-between py-2">
                <span>Trạng thái tài khoản</span>
                <span className="text-green-500">Hoạt động</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;