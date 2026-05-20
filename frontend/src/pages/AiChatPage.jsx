import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AiChatPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "ai",
      text: "Chào buổi chiều nha, mình là Trợ lý AI. Mình có thể giúp gì cho bạn hôm nay?",
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { authUser } = useAuthStore();

  const suggestions = [
    "Tôi muốn tìm nhạc mới để nghe",
    "Tôi muốn viết lời chúc mừng sinh nhật",
    "Tôi cần tìm kiếm gì đó",
    "Tôi muốn hiểu rõ khái niệm mới"
  ];

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text) => {
    const msg = text.trim();
    if (!msg) return;

    // Add user message
    const newUserMsg = { id: Date.now(), sender: "user", text: msg };
    setMessages((prev) => [...prev, newUserMsg]);
    setInputText("");
    setIsTyping(true);

    try {
      const res = await axiosInstance.post("/ai/chat", { prompt: msg });
      const aiResponse = { 
        id: Date.now() + 1, 
        sender: "ai", 
        text: res.data.text 
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("AI chat error:", error);
      const aiResponse = { 
        id: Date.now() + 1, 
        sender: "ai", 
        text: "Xin lỗi, hiện tại mình đang gặp trục trặc kỹ thuật. Cậu kiểm tra lại cấu hình API giúp mình nhé!" 
      };
      setMessages((prev) => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

  return (
    <div className="h-screen pt-20 px-4 bg-base-200">
      <div className="flex justify-center h-[calc(100vh-6rem)]">
        <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-base-100 border-b border-base-300 p-4 shrink-0 flex gap-3 items-center">
            <div className="avatar">
              <div className="w-10 rounded-full border border-primary/30 p-1 flex items-center justify-center bg-primary/10">
                <Bot className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                Trợ lý AI <Sparkles className="w-4 h-4 text-warning" />
              </h2>
              <p className="text-xs text-base-content/70">Sẵn sàng giải đáp mọi thắc mắc</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 1 && (
              <div className="flex flex-col items-center justify-center mt-10 mb-8 space-y-6">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-center">
                  Chào buổi chiều nha {authUser?.fullName?.split(" ")[0] || "bạn"}
                </h3>
                
                <div className="w-full max-w-md space-y-2 mt-4">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(suggestion)}
                      className="w-full bg-base-200 hover:bg-base-300 transition-colors p-3 rounded-xl text-left border border-base-300 shadow-sm flex items-center gap-3"
                    >
                      <Sparkles className="w-4 h-4 text-base-content/50" />
                      <span className="text-sm font-medium">{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat ${message.sender === "user" ? "chat-end" : "chat-start"}`}
              >
                <div className="chat-image avatar">
                  <div className="size-8 rounded-full border">
                    {message.sender === "user" ? (
                      <img src={authUser?.profilePic || "/avatar.png"} alt="User avatar" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <Bot className="size-5 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                {message.sender === "ai" && <div className="chat-header mb-1">Trợ lý AI</div>}
                
                <div className={`chat-bubble flex flex-col ${
                  message.sender === "user" ? "chat-bubble-primary text-primary-content" : "chat-bubble-base-200 bg-base-200 text-base-content"
                }`}>
                  {message.sender === "user" ? (
                    <div className="whitespace-pre-wrap">{message.text}</div>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-4" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold mb-2 mt-2" {...props} />,
                        a: ({node, ...props}) => <a className="text-primary underline hover:text-primary-focus" target="_blank" rel="noopener noreferrer" {...props} />,
                        code: ({node, inline, ...props}) => 
                          inline ? (
                            <code className="bg-base-300 text-base-content px-1 py-0.5 rounded text-sm" {...props} />
                          ) : (
                            <pre className="bg-base-300 text-base-content p-3 rounded-lg overflow-x-auto my-2 text-sm">
                              <code {...props} />
                            </pre>
                          ),
                        strong: ({node, ...props}) => <strong className="font-bold text-current" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 my-2 italic opacity-80" {...props} />,
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chat chat-start">
                <div className="chat-image avatar">
                  <div className="size-8 rounded-full border bg-primary/10 flex items-center justify-center">
                    <Bot className="size-5 text-primary" />
                  </div>
                </div>
                <div className="chat-bubble bg-base-200 text-base-content flex flex-col items-center justify-center min-h-[2.5rem]">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="bg-base-100 p-4 border-t border-base-300 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Hỏi bất kỳ điều gì..."
                className="input input-bordered w-full rounded-full bg-base-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
              />
              <button 
                type="submit" 
                className="btn btn-circle btn-primary"
                disabled={!inputText.trim() || isTyping}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiChatPage;
