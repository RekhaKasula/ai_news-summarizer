import { Bot, User } from "lucide-react";
import { formatTime } from "../utils/format";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-ink-900 text-white" : "bg-brand-700 text-white"}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </span>
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${isUser ? "bg-ink-900 text-white" : "border border-ink-200 bg-white text-ink-900"}`}>
          {message.content}
        </div>
        <time className="mt-1 block text-xs text-ink-500" dateTime={message.created_at}>{formatTime(message.created_at)}</time>
      </div>
    </div>
  );
}
