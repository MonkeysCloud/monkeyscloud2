import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";

// ─── Config ───
const PORT = parseInt(process.env.WS_PORT || "3002", 10);
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN || "";

// ─── HTTP Server ───
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "monkeyscloud-ws", time: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ─── Socket.IO ───
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN.split(","),
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 10000,
  transports: ["websocket", "polling"],
});

// ─── Redis Adapter (enables horizontal scaling) ───
const pubClient = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
const subClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("[Redis Pub]", err.message));
subClient.on("error", (err) => console.error("[Redis Sub]", err.message));

Promise.all([pubClient.ping(), subClient.ping()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✓ Redis adapter connected");
  })
  .catch((err) => {
    console.warn("⚠ Redis not available, running without adapter:", err.message);
  });

// ─── Redis Subscriber for API-triggered events ───
const eventSubscriber = pubClient.duplicate();
eventSubscriber.subscribe(
  "ws:notification",
  "ws:message",
  "ws:build",
  "ws:deploy",
  "ws:task",
  "ws:pr",
  (err) => {
    if (err) console.error("[Redis Subscribe]", err.message);
    else console.log("✓ Subscribed to ws:* channels");
  }
);

eventSubscriber.on("message", (channel, data) => {
  try {
    const payload = JSON.parse(data);
    const { userId, orgId, projectId, ...event } = payload;

    switch (channel) {
      case "ws:notification":
        if (userId) {
          io.to(`user:${userId}`).emit("notification", event);
        } else if (orgId) {
          io.to(`org:${orgId}`).emit("notification", event);
        }
        break;

      case "ws:message":
        if (payload.channelId) {
          io.to(`channel:${payload.channelId}`).emit("message", event);
        } else if (userId) {
          io.to(`user:${userId}`).emit("message", event);
        }
        break;

      case "ws:build":
        if (projectId) {
          io.to(`project:${projectId}`).emit("build:update", event);
        }
        if (orgId) {
          io.to(`org:${orgId}`).emit("build:update", event);
        }
        break;

      case "ws:deploy":
        if (projectId) {
          io.to(`project:${projectId}`).emit("deploy:update", event);
        }
        if (orgId) {
          io.to(`org:${orgId}`).emit("deploy:update", event);
        }
        break;

      case "ws:task":
        if (projectId) {
          io.to(`project:${projectId}`).emit("task:update", event);
        }
        break;

      case "ws:pr":
        // PR events: push, merge, close, comment
        console.log(`[DEBUG ws:pr] Raw event from Redis:`, JSON.stringify(event));
        if (event.project) {
          console.log(`[DEBUG ws:pr] Broadcasting to project:${event.project}`);
          io.to(`project:${event.project}`).emit("pr:update", event);
        }
        if (event.org && event.project) {
          const slugRoom = `pr-watch:${event.org}/${event.project}`;
          console.log(`[DEBUG ws:pr] Broadcasting to ${slugRoom}`);
          io.to(slugRoom).emit("pr:update", event);
        }
        if (event.prId) {
          console.log(`[DEBUG ws:pr] Broadcasting to pr:${event.prId}`);
          io.to(`pr:${event.prId}`).emit("pr:update", event);
        }
        break;

      default:
        break;
    }
  } catch (err) {
    console.error("[Event Handler]", err.message);
  }
});

// ─── Auth Middleware ───
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");

  // Internal API connections (server-to-server)
  if (API_INTERNAL_TOKEN && token === API_INTERNAL_TOKEN) {
    socket.data.user = { id: "system", role: "system" };
    return next();
  }

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    // Allow expired tokens for WebSocket — user is already authenticated via the API
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    socket.data.user = decoded;
    console.log(`[Auth] Token verified for user:`, decoded.sub || decoded.id || "unknown");
    next();
  } catch (err) {
    console.error(`[Auth] JWT verify failed:`, err.name, err.message);
    next(new Error("Invalid token"));
  }
});

// ─── Connection Handler ───
io.on("connection", (socket) => {
  const user = socket.data.user;
  console.log(`⚡ Connected: ${user.id} (${socket.id})`);

  // Auto-join user's personal room
  socket.join(`user:${user.id}`);

  // ── Join Rooms ──
  socket.on("join:org", (orgId) => {
    socket.join(`org:${orgId}`);
    console.log(`  → ${user.id} joined org:${orgId}`);
  });

  socket.on("join:project", (projectId) => {
    socket.join(`project:${projectId}`);
    console.log(`  → ${user.id} joined project:${projectId}`);
  });

  socket.on("join:channel", (channelId) => {
    socket.join(`channel:${channelId}`);
    console.log(`  → ${user.id} joined channel:${channelId}`);
  });

  // ── Leave Rooms ──
  socket.on("leave:org", (orgId) => socket.leave(`org:${orgId}`));
  socket.on("leave:project", (projectId) => socket.leave(`project:${projectId}`));
  socket.on("leave:channel", (channelId) => socket.leave(`channel:${channelId}`));

  // Pull Request rooms
  socket.on("join:pr", (prId) => {
    socket.join(`pr:${prId}`);
    console.log(`  → ${user.id} joined pr:${prId}`);
  });
  socket.on("leave:pr", (prId) => socket.leave(`pr:${prId}`));

  // PR watch rooms (slug-based: "org/project")
  socket.on("join:pr-watch", (key) => {
    socket.join(`pr-watch:${key}`);
    console.log(`  → ${user.id} joined pr-watch:${key}`);
  });
  socket.on("leave:pr-watch", (key) => socket.leave(`pr-watch:${key}`));

  // ── Direct Message ──
  socket.on("message:send", (data) => {
    const { channelId, content, type = "text" } = data;
    if (!channelId || !content) return;

    const message = {
      id: crypto.randomUUID(),
      channelId,
      senderId: user.id,
      senderName: user.name || user.email || "Unknown",
      content,
      type,
      createdAt: new Date().toISOString(),
    };

    // Broadcast to channel
    io.to(`channel:${channelId}`).emit("message", message);

    // Persist via Redis → API will pick it up
    pubClient.publish("api:message:save", JSON.stringify(message));
  });

  // ── Typing Indicators ──
  socket.on("typing:start", ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit("typing", {
      userId: user.id,
      userName: user.name || user.email,
      channelId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", ({ channelId }) => {
    socket.to(`channel:${channelId}`).emit("typing", {
      userId: user.id,
      channelId,
      isTyping: false,
    });
  });

  // ── Presence ──
  socket.on("disconnect", (reason) => {
    console.log(`⚡ Disconnected: ${user.id} (${reason})`);
    // Broadcast offline status to all org rooms
    for (const room of socket.rooms) {
      if (room.startsWith("org:")) {
        socket.to(room).emit("presence", { userId: user.id, status: "offline" });
      }
    }
  });

  // Broadcast online status
  for (const room of socket.rooms) {
    if (room.startsWith("org:")) {
      socket.to(room).emit("presence", { userId: user.id, status: "online" });
    }
  }
});

// ─── Start ───
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════╗
║  MonkeysCloud WebSocket Server           ║
║  Port: ${PORT}                              ║
║  Redis: ${REDIS_HOST}:${REDIS_PORT}                    ║
╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down WebSocket server...");
  io.close(() => {
    pubClient.quit();
    subClient.quit();
    eventSubscriber.quit();
    process.exit(0);
  });
});
