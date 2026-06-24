# SyncCanvas — WebSocket Protocol Specification

## Connection
`ws://localhost:3001`

## Message Types

### 1. Join Room
**Client → Server:**
```json
{
  "type": "join",
  "roomId": "default"
}
```

**Server → Client:**
```json
{
  "type": "room_state",
  "sessionId": "sess_abc123",
  "elements": [
    {
      "id": "elem_001",
      "type": "stroke",
      "x": 0, "y": 0,
      "props": { "stroke": "#000000", "strokeWidth": 3 },
      "points": [[10,10], [15,20], [30,40]],
      "createdBy": "sess_xyz789",
      "createdAt": 1740000000000,
      "updatedAt": 1740000000000
    }
  ]
}
```

### 2. Operations (Draw / Edit / Delete)
**Client → Server:**
```json
{
  "type": "op",
  "op": {
    "type": "add",
    "elementId": "elem_002",
    "sessionId": "sess_abc123",
    "sequence": 1,
    "timestamp": 1740000001000,
    "data": {
      "type": "stroke",
      "x": 0, "y": 0,
      "props": { "stroke": "#ff0000", "strokeWidth": 2 },
      "points": [[0,0],[5,10],[20,25]],
      "createdBy": "sess_abc123",
      "createdAt": 1740000001000,
      "updatedAt": 1740000001000
    }
  }
}
```

**Client → Server (Update):**
```json
{
  "type": "op",
  "op": {
    "type": "update",
    "elementId": "elem_002",
    "sessionId": "sess_abc123",
    "sequence": 2,
    "timestamp": 1740000002000,
    "data": {
      "x": 50, "y": 60,
      "props": { "stroke": "#00ff00" },
      "updatedAt": 1740000002000
    }
  }
}
```

**Client → Server (Delete):**
```json
{
  "type": "op",
  "op": {
    "type": "delete",
    "elementId": "elem_002",
    "sessionId": "sess_abc123",
    "sequence": 3,
    "timestamp": 1740000003000,
    "data": {}
  }
}
```

**Server → All OTHER Clients:**
Same format as above — the server broadcasts the operation to all peers except the sender.

### 3. Cursor Position
**Client → Server:**
```json
{
  "type": "cursor",
  "x": 150,
  "y": 200,
  "sessionId": "sess_abc123",
  "color": "#ff6600"
}
```

**Server → All OTHER Clients:**
Same format, forwarded as-is.

### 4. Disconnect
When a client disconnects, server broadcasts:
```json
{
  "type": "peer_left",
  "sessionId": "sess_abc123"
}
```

## CRDT Rules
1. **Timestamp-based**: Higher `timestamp` wins for same field
2. **Sequence**: Per-session monotonically increasing sequence number
3. **Append-only strokes**: `points` are appended, never replaced
4. **Full-text text**: Text is replaced wholesale (not character-level OT)
5. **Delete wins**: If an element is deleted, subsequent updates to it are ignored
