"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Send, ArrowUp } from "lucide-react";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useChatStore } from "@/store/chat";
import { Message, ChatResponse } from "@/types/chat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How do I activate roaming?",
  "My signal is bad in Mumbai",
  "I want to port +919876543210",
  "When will my dispute be resolved?",
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm Lauki Phones AI Assistant. I can help you with plans, billing, network issues, roaming, and more. How can I help you today?",
  timestamp: new Date(),
};

export function ChatPanel() {
  const { user, activeSessionId, getActiveSession, addMessage } = useChatStore();
  const session = getActiveSession();
  const messages = session?.messages ?? [];

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    setInput("");
    setIsLoading(false);
  }, [activeSessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    addMessage(activeSessionId, { id: uuidv4(), role: "user", content: trimmed, timestamp: new Date() });
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, actorId: user.actorId, threadId: activeSessionId }),
      });
      const data: ChatResponse = await res.json();
      addMessage(activeSessionId, {
        id: uuidv4(), role: "assistant",
        content: data.error ?? data.result ?? "Sorry, I couldn't process that.",
        timestamp: new Date(),
        toolsUsed: data.tools_used, cached: data.cached,
        escalationFlagged: data.escalation_flagged, error: !!data.error,
      });
    } catch {
      addMessage(activeSessionId, {
        id: uuidv4(), role: "assistant",
        content: "Connection error. Please try again.",
        timestamp: new Date(), error: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, activeSessionId, user.actorId, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const displayMessages = messages.length === 0 ? [WELCOME] : messages;

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-none h-14 bg-white border-b border-gray-200 px-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{session?.title ?? "New conversation"}</p>
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-none" />
            Online · Bedrock AgentCore
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {displayMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isLoading && <TypingIndicator />}
        </div>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="flex-none px-4 pb-3">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-none bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:border-emerald-400 focus-within:bg-white transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about plans, billing, network, roaming..."
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none min-h-[24px] max-h-32"
              aria-label="Message input"
              maxLength={500}
              style={{ height: "24px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "24px";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex-none w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                input.trim() && !isLoading ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
              aria-label="Send">
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Powered by Amazon Bedrock AgentCore · Press Enter to send</p>
        </div>
      </div>
    </div>
  );
}
