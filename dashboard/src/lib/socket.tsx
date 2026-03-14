"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ─── Types ───
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
  read?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
}

export interface TypingEvent {
  userId: string;
  userName?: string;
  channelId: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
  status: "online" | "offline";
}

export interface BuildUpdate {
  buildId: string;
  projectId: string;
  status: string;
  step?: string;
  progress?: number;
  log?: string;
}

export interface DeployUpdate {
  deployId: string;
  projectId: string;
  status: string;
  environment?: string;
  url?: string;
}

export interface TaskUpdate {
  taskId: string;
  projectId: string;
  action: string;
  task: Record<string, unknown>;
}

export interface PrUpdate {
  org: string;
  project: string;
  branch: string;
  sha?: string;
  action: "push" | "merged" | "closed" | "comment" | "updated" | "review_submitted";
  prNumber?: number;
  prId?: number;
  comment?: Record<string, unknown>;
}

// ─── Context ───
interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;
  // Messages
  messages: Message[];
  sendMessage: (channelId: string, content: string, type?: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  typingUsers: TypingEvent[];
  // Rooms
  joinOrg: (orgId: string) => void;
  leaveOrg: (orgId: string) => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  joinPr: (prId: string) => void;
  leavePr: (prId: string) => void;
  joinPrWatch: (key: string) => void;
  leavePrWatch: (key: string) => void;
  // Presence
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// ─── Provider ───
interface SocketProviderProps {
  children: ReactNode;
  token?: string;
  wsUrl?: string;
}

export function SocketProvider({ children, token, wsUrl }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const url = wsUrl || process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";

  useEffect(() => {
    if (!token) {
      console.log("[DEBUG SocketProvider] No token, skipping socket connection");
      return;
    }

    console.log(`[DEBUG SocketProvider] Connecting to ${url} with token (${token.length} chars)`);

    const socket = io(url, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("[WS] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("[WS] Connect error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      console.log("[WS] Disconnected:", reason);
    });

    // Notifications
    socket.on("notification", (data: Notification) => {
      setNotifications((prev) => [data, ...prev].slice(0, 50));
    });

    // Messages
    socket.on("message", (data: Message) => {
      setMessages((prev) => [...prev, data].slice(-200));
    });

    // Typing
    socket.on("typing", (data: TypingEvent) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return [...prev.filter((t) => t.userId !== data.userId), data];
        }
        return prev.filter((t) => t.userId !== data.userId);
      });
    });

    // Presence
    socket.on("presence", (data: PresenceEvent) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.status === "online") next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    });

    // Build & Deploy (dispatch custom events consumers can listen to)
    socket.on("build:update", (data: BuildUpdate) => {
      window.dispatchEvent(new CustomEvent("ws:build", { detail: data }));
    });

    socket.on("deploy:update", (data: DeployUpdate) => {
      window.dispatchEvent(new CustomEvent("ws:deploy", { detail: data }));
    });

    socket.on("task:update", (data: TaskUpdate) => {
      window.dispatchEvent(new CustomEvent("ws:task", { detail: data }));
    });

    socket.on("pr:update", (data: PrUpdate) => {
      console.log("[DEBUG socket] pr:update received:", data);
      window.dispatchEvent(new CustomEvent("ws:pr", { detail: data }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, url]);

  // ── Actions ──
  const sendMessage = useCallback((channelId: string, content: string, type = "text") => {
    socketRef.current?.emit("message:send", { channelId, content, type });
  }, []);

  const startTyping = useCallback((channelId: string) => {
    socketRef.current?.emit("typing:start", { channelId });
  }, []);

  const stopTyping = useCallback((channelId: string) => {
    socketRef.current?.emit("typing:stop", { channelId });
  }, []);

  const joinOrg = useCallback((orgId: string) => socketRef.current?.emit("join:org", orgId), []);
  const leaveOrg = useCallback((orgId: string) => socketRef.current?.emit("leave:org", orgId), []);
  const joinProject = useCallback((projectId: string) => socketRef.current?.emit("join:project", projectId), []);
  const leaveProject = useCallback((projectId: string) => socketRef.current?.emit("leave:project", projectId), []);
  const joinChannel = useCallback((channelId: string) => socketRef.current?.emit("join:channel", channelId), []);
  const leaveChannel = useCallback((channelId: string) => socketRef.current?.emit("leave:channel", channelId), []);
  const joinPr = useCallback((prId: string) => socketRef.current?.emit("join:pr", prId), []);
  const leavePr = useCallback((prId: string) => socketRef.current?.emit("leave:pr", prId), []);
  const joinPrWatch = useCallback((key: string) => socketRef.current?.emit("join:pr-watch", key), []);
  const leavePrWatch = useCallback((key: string) => socketRef.current?.emit("leave:pr-watch", key), []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        notifications,
        unreadCount,
        markAsRead,
        clearNotifications,
        messages,
        sendMessage,
        startTyping,
        stopTyping,
        typingUsers,
        joinOrg,
        leaveOrg,
        joinProject,
        leaveProject,
        joinChannel,
        leaveChannel,
        joinPr,
        leavePr,
        joinPrWatch,
        leavePrWatch,
        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// ─── Hook ───
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}

/** Safe version that returns null when outside SocketProvider */
function useOptionalSocket() {
  return useContext(SocketContext);
}

// ─── Convenience Hooks ───
export function useNotifications() {
  const { notifications, unreadCount, markAsRead, clearNotifications } = useSocket();
  return { notifications, unreadCount, markAsRead, clearNotifications };
}

export function useMessages(channelId?: string) {
  const { messages, sendMessage, startTyping, stopTyping, typingUsers, joinChannel, leaveChannel } = useSocket();

  useEffect(() => {
    if (!channelId) return;
    joinChannel(channelId);
    return () => { leaveChannel(channelId); };
  }, [channelId, joinChannel, leaveChannel]);

  const channelMessages = channelId ? messages.filter((m) => m.channelId === channelId) : messages;
  const channelTyping = channelId ? typingUsers.filter((t) => t.channelId === channelId) : typingUsers;

  return {
    messages: channelMessages,
    sendMessage: (content: string, type?: string) => channelId && sendMessage(channelId, content, type),
    startTyping: () => channelId && startTyping(channelId),
    stopTyping: () => channelId && stopTyping(channelId),
    typingUsers: channelTyping,
  };
}

export function usePresence() {
  const { onlineUsers } = useSocket();
  return { onlineUsers, isOnline: (userId: string) => onlineUsers.has(userId) };
}

export function useBuildUpdates(callback: (data: BuildUpdate) => void) {
  useEffect(() => {
    const handler = (e: Event) => callback((e as CustomEvent<BuildUpdate>).detail);
    window.addEventListener("ws:build", handler);
    return () => window.removeEventListener("ws:build", handler);
  }, [callback]);
}

export function useDeployUpdates(callback: (data: DeployUpdate) => void) {
  useEffect(() => {
    const handler = (e: Event) => callback((e as CustomEvent<DeployUpdate>).detail);
    window.addEventListener("ws:deploy", handler);
    return () => window.removeEventListener("ws:deploy", handler);
  }, [callback]);
}

export function usePrUpdates(callback: (data: PrUpdate) => void, watchKey?: string) {
  const ctx = useOptionalSocket();

  // Join/leave the pr-watch room if a key is provided and socket is available
  useEffect(() => {
    if (!watchKey) {
      console.log("[DEBUG usePrUpdates] No watchKey provided, skipping room join");
      return;
    }
    if (!ctx) {
      console.log("[DEBUG usePrUpdates] No socket context available, skipping room join");
      return;
    }
    console.log(`[DEBUG usePrUpdates] Joining pr-watch room: ${watchKey}`);
    ctx.joinPrWatch(watchKey);
    return () => {
      console.log(`[DEBUG usePrUpdates] Leaving pr-watch room: ${watchKey}`);
      ctx.leavePrWatch(watchKey);
    };
  }, [watchKey, ctx]);

  useEffect(() => {
    const handler = (e: Event) => {
      console.log("[DEBUG usePrUpdates] ws:pr window event received:", (e as CustomEvent<PrUpdate>).detail);
      callback((e as CustomEvent<PrUpdate>).detail);
    };
    window.addEventListener("ws:pr", handler);
    return () => window.removeEventListener("ws:pr", handler);
  }, [callback]);
}
