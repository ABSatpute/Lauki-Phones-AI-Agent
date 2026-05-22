"use client";

import { Message } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bot, User, Zap, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  search_faq: "FAQ Search",
  search_detailed_faq: "Detailed FAQ",
  reformulate_query: "Query Reformulation",
  get_weather_network_impact: "Weather",
  get_country_info: "Country Info",
  validate_phone_number: "Number Validation",
  check_public_holidays: "Holidays",
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-3 group", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "flex-none w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold mt-0.5",
        isUser ? "bg-gray-700" : "bg-emerald-600"
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1.5 max-w-[80%]", isUser && "items-end")}>
        {/* Bubble */}
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gray-900 text-white rounded-tr-sm"
            : message.error
            ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-sm"
            : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none",
              message.error ? "prose-red" : "prose-gray",
              // Table styles
              "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
              "[&_th]:bg-gray-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
              "[&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2",
              "[&_tr:nth-child(even)_td]:bg-gray-50/50",
              // List styles
              "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5",
              // Code styles
              "[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
              // Heading styles
              "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:font-semibold",
              // Paragraph spacing
              "[&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0",
            )}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className={cn("flex flex-wrap items-center gap-1.5 px-1", isUser && "justify-end")}>
          <span className="text-xs text-gray-400" suppressHydrationWarning>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>

          {message.cached && (
            <Badge variant="secondary" className="text-xs py-0 h-4 gap-1 font-normal">
              <Zap size={9} />Cached
            </Badge>
          )}

          {message.escalationFlagged && (
            <Badge variant="destructive" className="text-xs py-0 h-4 gap-1 font-normal">
              <AlertTriangle size={9} />Escalated
            </Badge>
          )}

          {message.toolsUsed?.map((tool) => (
            <Badge key={tool} variant="outline" className="text-xs py-0 h-4 font-normal text-emerald-700 border-emerald-200 bg-emerald-50">
              {TOOL_LABELS[tool] ?? tool}
            </Badge>
          ))}

          {/* Copy button — only on assistant messages */}
          {!isUser && (
            <button onClick={copy}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 ml-1"
              aria-label="Copy response">
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
