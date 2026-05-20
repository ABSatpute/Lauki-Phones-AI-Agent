"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Send, RotateCcw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { Message, ChatResponse } from "@/types/chat";

const SUGGESTIONS = [
  "How do I activate roaming?",
  "My signal is bad in Mumbai",
  "I want to port number +919876543210",
  "When will my dispute be resolved?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuidv4(),
      role: "assistant",
      content: "Hi! I'm Lauki Phones AI Assistant. I can help you with plans, billing, network issues, roaming, and more. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, {
      id: uuidv4(), role: "user", content: trimmed, timestamp: new Date(),
    }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, actorId: "web-user", threadId: sessionId }),
      });
      const data: ChatResponse = await res.json();
      setMessages((prev) => [...prev, {
        id: uuidv4(),
        role: "assistant",
        content: data.error ?? data.result ?? "Sorry, I couldn't process that.",
        timestamp: new Date(),
        toolsUsed: data.tools_used,
        cached: data.cached,
        escalationFlagged: data.escalation_flagged,
        error: !!data.error,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: uuidv4(), role: "assistant",
        content: "Connection error. Please try again.",
        timestamp: new Date(), error: true,
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, sessionId]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center">
            <Wifi size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">Lauki Phones Support</h1>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
              AI Assistant Online
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMessages([{
          id: uuidv4(), role: "assistant",
          content: "Chat cleared. How can I help you?", timestamp: new Date(),
        }])} aria-label="Clear chat">
          <RotateCcw size={16} />
        </Button>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Suggestions — shown only on first load */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-400 mb-2">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Input */}
      <div className="bg-white px-4 py-3">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="max-w-2xl mx-auto flex gap-2">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about plans, billing, network, roaming..."
            disabled={isLoading}
            className="flex-1 rounded-full border-gray-200 focus-visible:ring-emerald-500"
            aria-label="Message input" maxLength={500} />
          <Button type="submit" disabled={!input.trim() || isLoading}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 w-10 h-10 p-0 flex-shrink-0"
            aria-label="Send message">
            <Send size={16} />
          </Button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">Powered by Amazon Bedrock AgentCore</p>
      </div>
    </div>
  );
}
