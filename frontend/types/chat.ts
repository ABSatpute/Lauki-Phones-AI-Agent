export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date | string;
  toolsUsed?: string[];
  cached?: boolean;
  escalationFlagged?: boolean;
  error?: boolean;
}

export interface ChatResponse {
  result: string;
  actor_id: string;
  thread_id: string;
  tools_used?: string[];
  cached?: boolean;
  escalation_flagged?: boolean;
  error?: string;
}
