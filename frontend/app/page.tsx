"use client";

import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/ChatPanel";

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <ChatPanel />
    </div>
  );
}
