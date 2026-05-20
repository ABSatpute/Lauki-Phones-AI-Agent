import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { Message } from "@/types/chat";

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  name: string;
  actorId: string;
}

interface ChatStore {
  user: User;
  sessions: Session[];
  activeSessionId: string;
  sidebarOpen: boolean;

  setUser: (user: User) => void;
  createSession: () => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  toggleSidebar: () => void;
  getActiveSession: () => Session | undefined;
}

const defaultSession = (): Session => ({
  id: uuidv4(),
  title: "New conversation",
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      const initial = defaultSession();
      return {
        user: { name: "Guest", actorId: uuidv4() },
        sessions: [initial],
        activeSessionId: initial.id,
        sidebarOpen: true,

        setUser: (user) => set({ user }),

        createSession: () => {
          const session = defaultSession();
          set((s) => ({ sessions: [session, ...s.sessions], activeSessionId: session.id }));
          return session.id;
        },

        deleteSession: (id) =>
          set((s) => {
            const sessions = s.sessions.filter((s) => s.id !== id);
            if (!sessions.length) {
              const fresh = defaultSession();
              return { sessions: [fresh], activeSessionId: fresh.id };
            }
            return {
              sessions,
              activeSessionId: s.activeSessionId === id ? sessions[0].id : s.activeSessionId,
            };
          }),

        setActiveSession: (id) => set({ activeSessionId: id }),

        addMessage: (sessionId, message) =>
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id !== sessionId
                ? sess
                : {
                    ...sess,
                    messages: [...sess.messages, message],
                    updatedAt: new Date(),
                    // Auto-title from first user message
                    title:
                      sess.messages.length === 0 && message.role === "user"
                        ? message.content.slice(0, 40) + (message.content.length > 40 ? "…" : "")
                        : sess.title,
                  }
            ),
          })),

        updateSessionTitle: (sessionId, title) =>
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId ? { ...sess, title } : sess
            ),
          })),

        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

        getActiveSession: () => {
          const s = get();
          return s.sessions.find((sess) => sess.id === s.activeSessionId);
        },
      };
    },
    {
      name: "lauki-chat-store",
    }
  )
);
