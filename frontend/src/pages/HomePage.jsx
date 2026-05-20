import { useChatStore } from "../store/useChatStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();
  return (
    <div className="bg-base-200">
      <div className="flex items-center justify-center h-[100dvh] pt-16 sm:pt-20 sm:px-4 box-border overflow-hidden">
        <div className="bg-base-100 sm:rounded-xl sm:shadow-lg w-full max-w-6xl h-full sm:h-[calc(100dvh-7rem)] border-t sm:border-transparent border-base-300 overflow-hidden">
          <div className="flex h-full sm:rounded-lg overflow-hidden">
            {/* Show Sidebar if no user selected on mobile, always show on lg */}
            <div className={`h-full ${selectedUser ? 'hidden lg:block' : 'w-full'} lg:w-80 flex-shrink-0 transition-all duration-300`}>
              <Sidebar />
            </div>
            
            {/* Show ChatContainer if user selected, else NoChatSelected on lg */}
            <div className={`flex-1 flex h-full ${!selectedUser ? 'hidden lg:flex' : 'flex'}`}>
              {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;