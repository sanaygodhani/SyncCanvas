# SyncCanvas — System Architecture

## Overview
A real-time collaborative whiteboard where multiple users can draw freehand and write rich text on a shared canvas. Zero-lag sync via WebSocket with CRDT-inspired conflict resolution.

## High-Level Architecture

```
┌─────────────────┐        WebSocket         ┌─────────────────────────────┐
│   Browser A     │◄────────────────────────►│                             │
│  ┌───────────┐  │                          │     Sync Server             │
│  │ Canvas    │  │                          │  (Node.js + ws library)     │
│  │ Renderer  │  │                          │                             │
│  │           │  │                          │  ┌───────────────────────┐  │
│  │ Sync      │  │                          │  │  Room Manager         │  │
│  │ Client    │  │                          │  │  - Create/join rooms  │  │
│  └───────────┘  │                          │  │  - Broadcast ops      │  │
└─────────────────┘                          │  └───────────────────────┘  │
                                             │  ┌───────────────────────┐  │
┌─────────────────┐        WebSocket         │  │  Operation Store      │  │
│   Browser B     │◄────────────────────────►│  │  - CRDT operations    │  │
│  ┌───────────┐  │                          │  │  - State snapshots    │  │
│  │ Canvas    │  │                          │  └───────────────────────┘  │
│  │ Renderer  │  │                          │  ┌───────────────────────┐  │
│  │           │  │                          │  │  Cursor Manager       │  │
│  │ Sync      │  │                          │  │  (ephemeral, no DB)   │  │
│  │ Client    │  │                          │  └───────────────────────┘  │
│  └───────────┘  │                          └─────────────────────────────┘
└─────────────────┘
```

## Data Model

### Element (Persisted to board state)
```typescript
interface Element {
  id: string;          // UUID v4
  type: 'stroke' | 'text' | 'rect' | 'ellipse' | 'arrow' | 'image';
  x: number;           // x position on canvas
  y: number;           // y position on canvas
  width: number;       // bounding box width
  height: number;      // bounding box height
  rotation: number;    // degrees
  props: {
    fill?: string;       // hex color
    stroke?: string;     // hex color
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  // Stroke-specific
  points?: number[][];  // [[x1,y1], [x2,y2], ...]
  // Text-specific
  content?: string;
  // Image-specific
  src?: string;
  // Metadata
  createdBy: string;    // sessionId
  createdAt: number;    // timestamp
  updatedAt: number;    // timestamp
}
```

### Operation (What gets synced)
```typescript
interface Operation {
  type: 'add' | 'update' | 'delete';
  elementId: string;
  sessionId: string;
  sequence: number;      // monotonic per-session counter
  timestamp: number;
  data?: Partial<Element>;
  // For 'add' — full element data
  // For 'update' — only the changed fields
}
```

### Room State
```typescript
interface Room {
  id: string;
  elements: Map<string, Element>;
  sessions: Map<string, Session>;
  createdAt: number;
  lastActivity: number;
}
```

## Sync Protocol

### Connection
1. Client connects via WebSocket to `ws://host:port`
2. Client sends `{ type: "join", roomId: string, sessionId?: string }`
3. Server responds with `{ type: "room_state", elements: Element[], sessionId: string }`
4. Client renders initial state

### Operation Flow
1. User draws/writes → client creates Operation locally
2. Client optimistically applies to local state
3. Client sends Operation to server: `{ type: "op", op: Operation }`
4. Server:
   - Verifies operation
   - Applies to room state
   - Broadcasts to ALL OTHER clients in room (not sender)
5. Other clients apply operation to their local state
6. Render loop picks up state changes

### Cursor Sync (Ephemeral)
- Client sends cursor position: `{ type: "cursor", x, y, sessionId }`
- Server broadcasts to all other clients (throttled to 100ms)
- Not stored, purely in-flight

### Conflict Resolution (LWW-style CRDT)
- **Last-Writer-Wins** per element field
- Each operation has a `timestamp` (server wall clock)
- For elements: the latest `updatedAt` wins
- For strokes (point arrays): append-only — no conflict possible
- Text edits: full-text replace on save (not character-level)

## Scaling Strategy

### Single Server (MVP)
- Simple in-memory Map<roomId, Room>
- All clients on same process
- 10K+ concurrent connections per node (Node.js event loop)

### Horizontal Scale (Future)
```
                    ┌──────────┐
                    │  Redis   │
                    │ Pub/Sub  │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
    │ Server 1 │  │ Server 2 │  │ Server N │
    │ Room A-C │  │ Room D-F │  │ Room ... │
    └──────────┘  └──────────┘  └──────────┘
```
- Redis Pub/Sub to broadcast ops across nodes
- Redis for room metadata / session management
- Optional: PostgreSQL for persistence + history

## Project Structure
```
sync-canvas/
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js          — Entry point, HTTP + WS server
│   │   ├── room-manager.js   — Room creation, join/leave
│   │   ├── sync-engine.js    — Operation validation + CRDT logic
│   │   ├── cursor-manager.js — Ephemeral cursor broadcast
│   │   └── store.js          — In-memory element store
│   └── test/
│       └── sync.test.js
├── client/
│   ├── index.html            — Single-page app
│   ├── style.css             — Minimal styling
│   └── src/
│       ├── app.js            — Main app init
│       ├── canvas-renderer.js — Canvas drawing (freehand + shapes)
│       ├── text-editor.js    — Rich text elements
│       ├── sync-client.js    — WebSocket client + op management
│       ├── toolbar.js        — Tool selection UI
│       └── cursors.js        — Remote cursor rendering
└── README.md
```

## Tech Stack
- **Runtime**: Node.js 20+
- **WebSocket**: `ws` library (lightweight, no overhead)
- **Frontend**: Vanilla JS (no framework — keeps it lightweight)
- **Canvas**: HTML5 Canvas API 2D context
- **Text**: contenteditable divs with execCommand/inline styles
- **No bundler** — ES modules served directly (importmap or type=module)

## Key Design Decisions
1. **No framework** — keeps the bundle tiny and avoids overhead for a single-page canvas app
2. **ws over Socket.IO** — lighter weight, no fallback transport overhead, direct control
3. **LWW CRDT** — simple, predictable conflict resolution; "last save wins" is intuitive
4. **In-memory store first** — no external database dependency for MVP; can add persistence later
5. **Optimistic updates** — no waiting for server confirmation; instant feel for the local user
6. **No account required** — join a room via URL, get a random session ID