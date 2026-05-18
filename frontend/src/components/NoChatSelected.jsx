import { MessageSquare } from "lucide-react";

const NoChatSelected = () => {
    return (
        <div className="w-full flex flex-1 flex-col items-center justify-center p-16 bg-base-100/50">
            <div className="max-w-md text-center space-y-6">

                {/* Icon Display */}
                <div className="flex justify-center gap-4 mb-4">
                    <div className="relative">
                        <div className="w-28 h-28 flex items-center justify-center animate-bounce">
                            <img src="/logo_no_bg.png" alt="JudoChat Logo" className="w-28 h-28 object-contain" />
                        </div>
                    </div>
                </div>

                {/* Welcome Text */}
                <h2 className="text-2xl font-bold">Chào mừng bạn đến với JudoChat!</h2>

                <p className="text-base-content/60">
                    Chọn một cuộc trò chuyện từ thanh bên để bắt đầu trò chuyện
                </p>

            </div>
        </div>
    );
};

export default NoChatSelected;