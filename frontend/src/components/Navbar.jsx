
import { Link } from "react-router-dom";
import { LogOut, MessageSquare, Settings, User, Bot } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore.js";
import { useChatStore } from "../store/useChatStore.js";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { setSelectedUser } = useChatStore();

  return (
    <header className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 backdrop-blur-lg bg-base-100/80">
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">

          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-all"
              onClick={() => setSelectedUser(null)}
            >
              <div className="flex items-center justify-center">
                <img src="/logo_no_bg.png" alt="JudoChat Logo" className="size-9 object-contain" />
              </div>
              <h1 className="text-lg font-bold">JudoChat</h1>
            </Link>
          </div>
          {/*  */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/settings"
              className="btn btn-sm btn-ghost sm:btn-outline gap-2 transition-colors px-2 sm:px-3"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Cài đặt</span>
            </Link>


            {authUser && (
              <>
                <Link
                  to="/ai-chat"
                  className="btn btn-sm btn-ghost sm:btn-outline gap-2 px-2 sm:px-3"
                >
                  <Bot className="size-5" />
                  <span className="hidden md:inline">Trợ lý AI</span>
                </Link>

                <Link
                  to="/profile"
                  className="btn btn-sm btn-ghost sm:btn-outline gap-2 px-2 sm:px-3"
                >
                  <User className="size-5" />
                  <span className="hidden md:inline">Hồ sơ</span>
                </Link>

                <button
                  className="btn btn-sm btn-ghost sm:text-error gap-2 px-2 sm:px-3 flex items-center"
                  onClick={logout}
                >
                  <LogOut className="size-5" />
                  <span className="hidden md:inline">Đăng xuất</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
