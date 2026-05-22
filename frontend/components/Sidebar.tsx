"use client";

import { useChatStore } from "@/store/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Trash2, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export function Sidebar() {
  const { user, sessions, activeSessionId, sidebarOpen, createSession, deleteSession, setActiveSession, toggleSidebar, setUser } = useChatStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.name);

  return (
    <>
      {/* Collapsed toggle */}
      {!sidebarOpen && (
        <button onClick={toggleSidebar}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-200 border-l-0 rounded-r-md p-1 shadow-sm hover:bg-gray-50 transition-colors"
          aria-label="Open sidebar">
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      )}

      <aside className={cn(
        "flex flex-col h-screen flex-none bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden",
        sidebarOpen ? "w-60" : "w-0"
      )}>
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-4 h-14 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center flex-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Lauki Phones</span>
          </div>
          <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close sidebar">
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* New chat button */}
        <div className="flex-none px-3 py-3">
          <button onClick={() => createSession()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <Plus size={15} className="text-emerald-600 flex-none" />
            New conversation
          </button>
        </div>

        {/* Sessions */}
        <ScrollArea className="flex-1 px-2">
          <p className="text-xs font-medium text-gray-400 px-2 py-1 uppercase tracking-wider">Recent</p>
          <div className="space-y-0.5 pb-2">
            {sessions.map((session) => (
              <div key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "group flex items-start gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors",
                  session.id === activeSessionId ? "bg-emerald-50 text-emerald-900" : "text-gray-600 hover:bg-gray-50"
                )}>
                <MessageSquare size={14} className={cn("flex-none mt-0.5", session.id === activeSessionId ? "text-emerald-600" : "text-gray-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{session.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5" suppressHydrationWarning>
                    {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                  </p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                  className="flex-none opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all mt-0.5"
                  aria-label="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* User profile */}
        <div className="flex-none border-t border-gray-200 px-3 py-3">
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); setUser({ ...user, name: nameInput || "Guest" }); setEditingName(false); }}
              className="flex gap-2">
              <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 text-gray-900"
                maxLength={30} />
              <button type="submit" className="text-xs bg-emerald-600 text-white px-2 py-1.5 rounded-md hover:bg-emerald-700">Save</button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-none">
                <span className="text-xs font-semibold text-emerald-700">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-400">Customer</p>
              </div>
              <button onClick={() => { setNameInput(user.name); setEditingName(true); }}
                className="flex-none text-gray-300 hover:text-gray-500 transition-colors" aria-label="Edit name">
                <Settings size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
