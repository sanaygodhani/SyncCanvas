# SyncCanvas — Discord/Telegram-Inspired Collaboration Platform

## Implementation Plan

Based on architectural research of **Discord** (guilds, channels, permissions, real-time Gateway, voice/video) and **Telegram** (MTProto encryption, chat hierarchy, user relationships, cloud sync, secret chats).

---

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Client Application                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │
│  │ Auth UI   │  │ Community│  │ Whiteboard    │           │
│  │ Login/Reg │  │ Sidebar  │  │ Canvas + Chat │          │
│  └──────────┘  └──────────┘  └──────────────┘            │
│  ┌──────────────────────────────────────────────────┐     │
│  │           WebSocket Client (sync layer)           │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS REST + WSS
┌──────────────────────────▼───────────────────────────────┐
│                    API Gateway (Render)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │
│  │ Auth API  │  │ Community│  │ Real-time WS  │           │
│  │ BetterAuth│  │  REST API │  │ Gateway       │          │
│  └──────────┘  └──────────┘  └──────────────┘            │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│               Service Layer (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │
│  │ User Svc  │  │ Community│  │ Whiteboard    │           │
│  │           │  │  Svc     │  │ Sync Engine   │           │
│  └──────────┘  └──────────┘  └──────────────┘            │
└──────────────────────────┬───────────────────────────────┘
                           │
┌─────────────┬────────────┼────────────┬──────────────────┐
│             │            │            │                   │
│  Redis      │  Supabase  │  S3/R2     │  Sentry          │
│  (Pub/Sub   │  (Postgres)│  (Assets)  │  (Monitoring)    │
│   + Cache)  │            │            │                   │
└─────────────┴────────────┴────────────┴──────────────────┘
```

---

## 2. Data Models (Supabase/PostgreSQL)

### 2.1 Users & Authentication (Better Auth)
```sql
-- Better Auth handles: sessions, accounts, verification
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  status VARCHAR(20) DEFAULT 'offline', -- online, idle, dnd, offline
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- friend, blocked, follower, following
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id)
);
```

### 2.2 Communities (Discord Guilds / Telegram Groups)
```sql
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  invite_code VARCHAR(20) UNIQUE,
  max_members INTEGER DEFAULT 100,
  encryption_mode VARCHAR(20) DEFAULT 'none', -- none, e2ee, mtproto
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, moderator, member
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

CREATE TABLE community_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  max_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Channels & Categories (Discord-style)
```sql
CREATE TABLE channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL, -- lowercased, hyphenated (like Discord)
  topic TEXT,
  type VARCHAR(20) DEFAULT 'text', -- text, whiteboard, announcement, forum
  position INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  encryption_mode VARCHAR(20) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Messages & Canvas State
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  pinned BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Whiteboard canvas elements (persisted version of current in-memory state)
CREATE TABLE whiteboard_elements (
  id UUID PRIMARY KEY,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  x DOUBLE PRECISION, y DOUBLE PRECISION,
  width DOUBLE PRECISION, height DOUBLE PRECISION,
  rotation DOUBLE PRECISION DEFAULT 0,
  props JSONB DEFAULT '{}',
  points JSONB DEFAULT '[]',
  content TEXT,
  created_by UUID REFERENCES users(id),
  version INTEGER DEFAULT 1,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complete canvas snapshots for version history
CREATE TABLE whiteboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.5 Permissions (Role-based, Discord-inspired)
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),
  position INTEGER DEFAULT 0,
  permissions BIGINT DEFAULT 0, -- Bitfield (see below)
  is_mentionable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(role_id, user_id)
);

CREATE TABLE channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  allow BIGINT DEFAULT 0,
  deny BIGINT DEFAULT 0,
  UNIQUE(channel_id, role_id)
);
```

### Permission Bitfield (Discord-style)
```
Bit 0:  CREATE_INVITE
Bit 1:  KICK_MEMBERS
Bit 2:  BAN_MEMBERS
Bit 3:  MANAGE_ROLES
Bit 4:  MANAGE_CHANNELS
Bit 5:  MANAGE_COMMUNITY
Bit 6:  VIEW_CHANNELS
Bit 7:  SEND_MESSAGES
Bit 8:  READ_MESSAGE_HISTORY
Bit 9:  MENTION_EVERYONE
Bit 10: WHITEBOARD_DRAW
Bit 11: WHITEBOARD_ERASE
Bit 12: WHITEBOARD_MANAGE
Bit 13: PIN_MESSAGES
Bit 14: ATTACH_FILES
Bit 15: MANAGE_INVITES
```

---

## 3. API Structure (REST + WebSocket)

### 3.1 REST API Endpoints
```
POST   /api/auth/register          # Better Auth registration
POST   /api/auth/login              # Email/magic link/OAuth
POST   /api/auth/logout             # Session invalidation
GET    /api/auth/me                 # Current user profile

GET    /api/users/:id               # User profile
PUT    /api/users/:id               # Update profile
POST   /api/users/:id/follow        # Follow user
DELETE /api/users/:id/follow        # Unfollow
GET    /api/users/:id/friends       # Friend list
POST   /api/users/:id/friend-request # Send friend request

GET    /api/communities             # List joined communities
POST   /api/communities             # Create community
GET    /api/communities/:id         # Community details
PUT    /api/communities/:id         # Update community
DELETE /api/communities/:id         # Delete community (owner only)
POST   /api/communities/:id/join    # Join via invite code
POST   /api/communities/:id/leave   # Leave community

GET    /api/communities/:id/channels         # List channels
POST   /api/communities/:id/channels         # Create channel
PUT    /api/channels/:id                     # Update channel
DELETE /api/channels/:id                     # Delete channel

GET    /api/channels/:id/messages            # Message history (cursor pagination)
POST   /api/channels/:id/messages            # Send message
DELETE /api/messages/:id                     # Delete message
PUT    /api/messages/:id                     # Edit message

GET    /api/channels/:id/whiteboard/elements # Get all elements
POST   /api/channels/:id/whiteboard/snapshot # Save snapshot
GET    /api/channels/:id/whiteboard/snapshots# List snapshots

GET    /api/communities/:id/roles            # List roles
POST   /api/communities/:id/roles            # Create role
PUT    /api/roles/:id                        # Update role
DELETE /api/roles/:id                        # Delete role
POST   /api/roles/:id/assign                 # Assign role to user
DELETE /api/roles/:id/assign/:userId         # Remove role
GET    /api/communities/:id/invites          # List invites
POST   /api/communities/:id/invites          # Create invite
DELETE /api/invites/:id                      # Revoke invite
GET    /api/invites/:code                    # Resolve invite code
```

### 3.2 WebSocket Gateway Protocol
```
Connection: wss://synccanvas.app/gateway

=== Authentication ===
Client → Server:  { type: "identify", token: "session_token" }
Server → Client:  { type: "ready", user: {...}, guilds: [...], dm_channels: [...] }

=== Event Subscription (Discord-style Gateway) ===
Server → Client (push events):
  { type: "MESSAGE_CREATE", channel_id, message }
  { type: "MESSAGE_UPDATE", channel_id, message }
  { type: "MESSAGE_DELETE", channel_id, message_id }
  { type: "CHANNEL_CREATE", channel }
  { type: "CHANNEL_UPDATE", channel }
  { type: "CHANNEL_DELETE", channel_id }
  { type: "WHITEBOARD_OP", channel_id, op }     # Canvas operation
  { type: "WHITEBOARD_SYNC", channel_id, elements }
  { type: "PRESENCE_UPDATE", user_id, status }
  { type: "TYPING_START", channel_id, user_id }
  { type: "VOICE_STATE_UPDATE", channel_id, user_id, state }

=== Client Commands ===
Client → Server:
  { type: "subscribe", channel_id }           # Join a channel's real-time feed
  { type: "unsubscribe", channel_id }
  { type: "whiteboard_op", channel_id, op }   # Canvas operation
  { type: "typing", channel_id }              # Typing indicator
  { type: "presence", status: "online" }      # Update presence
  { type: "cursor", channel_id, x, y }        # Cursor position
```

---

## 4. Frontend UI Architecture

### 4.1 UI Layout (Discord-inspired)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────┐  ┌────────────┐  ┌────────────────────────────────────┐  │
│  │Communi│  │ Community  │  │       Channel Content Area          │  │
│  │ty List│  │ Channel    │  │                                    │  │
│  │       │  │ Sidebar    │  │  ┌──────────────────────────────┐  │  │
│  │ Icon1 │  │ ┌────────┐ │  │  │  Channel Header              │  │  │
│  │ Icon2 │  │ │Category │ │  │  ├──────────────────────────────┤  │  │
│  │ Icon3 │  │ │ #general│ │  │  │  Messages / Canvas           │  │  │
│  │       │  │ │ #random │ │  │  │  (content area)              │  │  │
│  │       │  │ │ 🖊 draw │ │  │  │                              │  │  │
│  │       │  │ │         │ │  │  │                              │  │  │
│  │       │  │ │Voice    │ │  │  │                              │  │  │
│  │       │  │ │ vc-1    │ │  │  │                              │  │  │
│  │       │  │ └────────┘ │  │  │                              │  │  │
│  │       │  │            │  │  ├──────────────────────────────┤  │  │
│  │       │  │ [+ Add    │  │  │  Message Input / Canvas Tools │  │  │
│  │       │  │  Channel]  │  │  └──────────────────────────────┘  │  │
│  └──────┘  └────────────┘  └────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ User Panel: [Avatar] Username | Status | Settings | Logout  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Tree
```
App
├── AuthView (login/register)
│   ├── MagicLinkForm
│   ├── OAuthButtons (Google, GitHub)
│   └── TwoFactorForm
├── MainLayout (authenticated)
│   ├── CommunityList (leftmost skinny bar)
│   │   ├── CommunityIcon (avatar, unread badge, selected state)
│   │   ├── DMIcon (Direct Messages)
│   │   └── AddCommunityButton
│   ├── ChannelSidebar
│   │   ├── CommunityHeader (name, dropdown, invite button)
│   │   ├── CategoryGroup (collapsible)
│   │   │   ├── CategoryHeader
│   │   │   └── ChannelItem (icon, name, unread count, active state)
│   │   ├── VoiceChannelList
│   │   └── AddChannelButton (permission-gated)
│   ├── ContentArea
│   │   ├── ChannelHeader (name, topic, member count, tabs)
│   │   ├── MessageList (text channels)
│   │   │   ├── MessageGroup (user avatar, name, timestamp)
│   │   │   ├── Message (content, reactions, attachments)
│   │   │   └── ReplyThread
│   │   ├── WhiteboardCanvas (whiteboard channels)
│   │   │   ├── Toolbar (pen, shapes, text, colors)
│   │   │   ├── Canvas (HTML5 Canvas drawing area)
│   │   │   ├── RemoteCursors
│   │   │   └── TextLayer (contenteditable overlays)
│   │   └── MemberList (right sidebar)
│   │       ├── MemberGroupHeader (role name)
│   │       └── MemberItem (avatar, status, name, role badge)
│   ├── MessageInput (text channels)
│   │   ├── RichTextEditor (slash commands, emoji picker, @mentions)
│   │   ├── AttachmentButton
│   │   └── SendButton
│   └── UserPanel (bottom bar)
│       ├── UserAvatar (status indicator: online/idle/dnd/offline)
│       ├── Username & Discriminator
│       ├── SettingsButton
│       └── LogoutButton
├── SettingsModal
│   ├── MyAccount
│   ├── Privacy & Safety
│   ├── Notifications
│   └── Connections
├── CreateCommunityModal
│   ├── CommunityNameInput
│   ├── IconUpload
│   ├── PrivacyToggle (public/private)
│   └── CreateButton
├── InviteModal
│   ├── InviteLinkDisplay
│   ├── ExpirySettings
│   └── MaxUsesSettings
└── UserProfileModal
    ├── UserInfo
    ├── MutualCommunities
    ├── FriendActions (add friend, message, block)
    └── UserStatus
```

---

## 5. Security Architecture

### 5.1 Authentication & Session Security (Better Auth)
- **Passwordless magic links** as primary auth (Telegram-inspired simplicity)
- **OAuth providers**: Google, GitHub, Discord
- **Session tokens** stored in HTTP-only secure cookies
- **CSRF protection** via SameSite=Strict cookies
- **2FA (TOTP)** for high-value actions (community ownership, account deletion)
- **Rate limiting**: 5 auth attempts per minute per IP

### 5.2 WebSocket Security (Discord Gateway-inspired)
- **Authenticated upgrade**: WebSocket connections verified via session cookie before upgrade
- **Connection-per-user**: Single active WS connection per user; duplicate connections terminate the old one
- **Heartbeat/ping**: Client sends ping every 30s; server disconnects after 3 missed pings
- **Rate limiting per connection**: 50 ops/sec max; auto-disconnect after 3 violations

### 5.3 Data Protection
- **Input validation**: All inputs validated via Zod schemas on both client and server
- **SQL injection protection**: Parameterized queries via Supabase/PostgREST
- **XSS prevention**: Content Security Policy via Helmet.js; all user content sanitized
- **Canvas operation validation**: Zod schema for every operation type
- **File upload validation**: MIME type checking, file size limits (5MB), virus scanning

### 5.4 End-to-End Encryption (Optional, for E2EE channels)
```
Room Key Derivation:
  URL: https://synccanvas.app/join/#community-key-base64
  The key is in the URL fragment (never sent to server)
  AES-GCM-256 encrypts all canvas operations and messages

Key Exchange (for DM E2EE):
  1. Alice generates X25519 keypair
  2. Alice signs her public key with her auth key
  3. Bob verifies signature, generates his own keypair
  4. Both derive shared secret via X25519 + HKDF
  5. Messages encrypted with AES-GCM-256 using derived key
```

### 5.5 Compliance & Privacy
- **GDPR compliance**: Data export, account deletion, consent records
- **Audit logging**: All admin actions logged (who deleted a message, changed permissions)
- **Data retention**: Configurable message retention (30 days auto-delete option)
- **No data leakage**: Server never logs message content; only metadata

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Core team: 2 engineers (backend + frontend)**

Tasks:
1. **Set up Supabase project** — Database schema, migrations, Row Level Security (RLS)
2. **Better Auth integration** — Magic link auth, OAuth, session management
3. **User model + profile API** — CRUD for users, avatar upload
4. **Community CRUD** — Create, join, leave communities (invite codes)
5. **Channel CRUD** — Create channels within communities (text + whiteboard types)
6. **Frontend layout shell** — Three-panel Discord-style layout, community sidebar, channel list
7. **Auth UI** — Login/register screens with magic link and OAuth
8. **Deploy to Render** — Backend service + PostgreSQL + Redis

**Deliverables**: Users can register, create communities, add channels, and see the UI layout

### Phase 2: Real-Time Collaboration (Week 3-4)
Tasks:
1. **WebSocket Gateway** — Authenticated WebSocket server (session-based upgrade)
2. **Gateway event system** — Discord-style event dispatch (MESSAGE_CREATE, PRESENCE_UPDATE, etc.)
3. **Redis Pub/Sub** — Horizontal scaling across multiple server instances
4. **Message system** — Send, edit, delete messages with real-time broadcast
5. **Whiteboard in channels** — Current SyncCanvas whiteboard integrated into channel content area
6. **Remote cursors in channels** — Show where other users are drawing/typing
7. **Typing indicators** — "User is typing..." in channel header
8. **Presence system** — Online/idle/dnd/offline with real-time updates

**Deliverables**: Real-time messaging and whiteboarding in channels

### Phase 3: Social Features (Week 5-6)
Tasks:
1. **User relationships** — Follow/unfollow, friend requests, block
2. **Direct Messages** — Private 1-on-1 channels created on friend accept
3. **User search** — Search users by username
4. **Invite system** — Shareable invite links with expiry and usage limits
5. **Notifications** — In-app notification center (mentions, friend requests, invites)
6. **User profiles** — Public profile page with bio, mutual communities

**Deliverables**: Users can find friends, DM each other, and share community invites

### Phase 4: Permissions & Moderation (Week 7-8)
Tasks:
1. **Role system** — Create roles with permission bitfield
2. **Role assignments** — Assign roles to members
3. **Channel permissions** — Override permissions per channel
4. **Moderation tools** — Kick, ban, mute members, message deletion
5. **Audit log** — Track moderation actions
6. **Community settings** — Verification level, explicit content filter, slow mode

**Deliverables**: Community owners can manage permissions, moderate content, and audit actions

### Phase 5: Enhanced Whiteboard (Week 9-10)
Tasks:
1. **Multi-layer canvas** — Layers with visibility toggle and reordering (like Photoshop/FigJam)
2. **Canvas version history** — Time-travel through whiteboard states
3. **Export** — PNG, SVG, PDF export of canvas
4. **Sticky notes** — Digital sticky notes (like Miro)
5. **Templates** — Pre-built canvas templates (mind map, flowchart, wireframe)
6. **Reactions on canvas elements** — Emoji reactions on specific elements

**Deliverables**: Feature-rich whiteboard experience with history and export

### Phase 6: Security Hardening & E2EE (Week 11-12)
Tasks:
1. **E2EE for DMs** — X25519 + AES-GCM-256 for direct messages
2. **E2EE for whiteboard channels** — Shared room key via URL fragment
3. **Helmet.js integration** — CSP, X-Frame-Options, COOP headers
4. **Rate limiting** — express-rate-limit for all HTTP routes
5. **Input sanitization** — Zod schemas for every endpoint
6. **Penetration testing** — OWASP top 10 security audit
7. **CSP reporting** — Report violations to Sentry

**Deliverables**: Production-ready security posture

### Phase 7: Testing & QA (Week 13)
Tasks:
1. **Unit tests** — All services, permissions engine, CRDT logic
2. **Integration tests** — API endpoints, Gateway events, whiteboard sync
3. **E2E UI tests** — Playwright/Cypress for Discord-like UI flows
4. **Security tests** — Auth bypass, XSS, CSRF, rate limit bypass
5. **Load tests** — k6 for 10K concurrent users
6. **E2E encryption tests** — Verify no plaintext leaks over network

---

## 7. E2E Test Plan

### 7.1 UI Structure Tests (Playwright)
```javascript
// Tests the Discord-like 3-panel layout
test('renders community list on left', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="community-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="channel-sidebar"]')).toBeVisible();
  await expect(page.locator('[data-testid="content-area"]')).toBeVisible();
});

test('channel types display correctly', async ({ page }) => {
  const textChannel = page.locator('[data-testid="channel-item"]').first();
  await expect(textChannel.locator('[data-testid="channel-icon-text"]')).toBeVisible();
  
  const whiteboardChannel = page.locator('[data-testid="channel-item"]').nth(1);
  await whiteboardChannel.click();
  await expect(page.locator('[data-testid="whiteboard-canvas"]')).toBeVisible();
});

test('community creation flow', async ({ page }) => {
  await page.click('[data-testid="add-community"]');
  await page.fill('[data-testid="community-name-input"]', 'Design Team');
  await page.click('[data-testid="create-community-btn"]');
  await expect(page.locator('text=Design Team')).toBeVisible();
});
```

### 7.2 User Behavior Tests
```javascript
test('3 users collaborate on same whiteboard', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const ctx3 = await browser.newContext();
  
  const alice = await ctx1.newPage();
  const bob = await ctx2.newPage();
  const charlie = await ctx3.newPage();
  
  // All join same whiteboard channel
  await alice.goto('/community/1/channel/whiteboard-1');
  await bob.goto('/community/1/channel/whiteboard-1');
  await charlie.goto('/community/1/channel/whiteboard-1');
  
  // Alice draws a shape
  await alice.click('[data-testid="tool-rect"]');
  await alice.mouse.down(100, 100);
  await alice.mouse.move(300, 300);
  await alice.mouse.up();
  
  // Bob and Charlie see Alice's shape
  await expect(bob.locator('canvas')).toMatchScreenshot();
  await expect(charlie.locator('canvas')).toMatchScreenshot();
});

test('user follows another user', async ({ page }) => {
  await page.goto('/users/another-user');
  await page.click('[data-testid="follow-btn"]');
  await expect(page.locator('[data-testid="following-badge"]')).toBeVisible();
});

test('message flow: send, edit, delete', async ({ page }) => {
  await page.fill('[data-testid="message-input"]', 'Hello team!');
  await page.click('[data-testid="send-btn"]');
  await expect(page.locator('text=Hello team!')).toBeVisible();
  
  // Edit
  await page.click('[data-testid="message-actions"]');
  await page.click('[data-testid="edit-message"]');
  await page.fill('[data-testid="message-input"]', 'Hello team! Edited');
  await page.press('[data-testid="message-input"]', 'Enter');
  
  // Delete
  await page.click('[data-testid="message-actions"]');
  await page.click('[data-testid="delete-message"]');
  await expect(page.locator('text=Hello team!')).not.toBeVisible();
});
```

### 7.3 Data Security Tests
```javascript
test('cannot access restricted channel without permission', async ({ page }) => {
  // Log in as a regular member
  await page.goto('/api/auth/login');
  await page.fill('[data-testid="email-input"]', 'member@test.com');
  // ...
  await page.goto('/community/1/channel/admin-only');
  await expect(page.locator('[data-testid="no-permission"]')).toBeVisible();
  await expect(page.locator('[data-testid="channel-content"]')).not.toBeVisible();
});

test('message content not leaked in HTML source', async ({ page }) => {
  await page.goto('/community/1/channel/general');
  // Verify that message content is not in raw HTML
  const html = await page.content();
  expect(html).not.toContain('secret-message-content');
});

test('WebSocket cannot receive other channel data', async ({ ws }) => {
  const socket = new WebSocket('wss://synccanvas.app/gateway');
  socket.send(JSON.stringify({ type: 'subscribe', channel_id: 'restricted-channel' }));
  const response = await socket.waitForMessage();
  expect(response.type).toBe('error');
  expect(response.code).toBe(40003); // No permission
});

test('rate limiting blocks abuse', async ({ request }) => {
  for (let i = 0; i < 150; i++) {
    await request.post('/api/auth/login', { data: { email: 'test@test.com' } });
  }
  const lastResponse = await request.post('/api/auth/login', { data: { email: 'test@test.com' } });
  expect(lastResponse.status()).toBe(429); // Too Many Requests
});

test('E2EE messages not visible to server', async () => {
  // Verify that encryption happens client-side
  // by intercepting network traffic
  const networkLogs = [];
  page.on('websocket', ws => {
    ws.on('framesent', frame => {
      networkLogs.push(frame.payload);
    });
  });
  
  await page.fill('[data-testid="message-input"]', 'This is a secret');
  await page.click('[data-testid="send-btn"]');
  
  // If E2EE is enabled, the network payload should not contain plaintext
  for (const log of networkLogs) {
    expect(log).not.toContain('This is a secret');
  }
});
```

### 7.4 Permission & Role Tests
```javascript
test('admin can kick members, regular cannot', async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: 'admin.json' });
  const memberCtx = await browser.newContext({ storageState: 'member.json' });
  
  const adminPage = await adminCtx.newPage();
  const memberPage = await memberCtx.newPage();
  
  await adminPage.goto('/community/1/settings/members');
  await expect(adminPage.locator('[data-testid="kick-btn"]').first()).toBeEnabled();
  
  await memberPage.goto('/community/1/settings/members');
  await expect(memberPage.locator('[data-testid="kick-btn"]')).not.toBeVisible();
});

test('role with WHITEBOARD_DRAW can draw, others cannot', async ({ page }) => {
  // ... test permission enforcement on whiteboard operations
});
```

---

## 8. Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Runtime** | Node.js 22+ | Existing codebase, async I/O for WebSocket |
| **HTTP Framework** | Hono or Fastify | Lightweight, fast, TypeScript-native |
| **Database** | Supabase (PostgreSQL) | RLS, real-time subscriptions, managed |
| **Cache/PubSub** | Redis (Render Managed) | Horizontal scaling for WebSocket |
| **Auth** | Better Auth | Built for session-based auth, OAuth, magic links |
| **Frontend** | React 19 + Vite | Component-based UI, hot reload, tree-shaking |
| **State Management** | Zustand + React Query | Lightweight, server-state caching, optimistic updates |
| **UI Framework** | Tailwind CSS + Radix UI | Utility-first, accessible components |
| **WebSocket Client** | useWebSocket (react-use-websocket) | React hook for WebSocket lifecycle |
| **Testing** | Playwright (E2E), Vitest (unit) | Fast, reliable, browser-native testing |
| **Security** | Zod (validation), Helmet (headers) | Runtime type safety, secure headers |
| **Monitoring** | Sentry | Error tracking, performance monitoring |
| **Deployment** | Render | WebSockets support, managed Postgres/Redis |

---

## 9. Key Metrics to Track

| Metric | Target | How |
|--------|--------|-----|
| P95 sync latency | < 100ms | WebSocket round-trip timing |
| Concurrent WS connections | 10,000 | k6 load test |
| Auth request latency P95 | < 500ms | Better Auth timing |
| Message delivery latency | < 50ms | Time from send to broadcast |
| E2E encryption overhead | < 5ms | AES-GCM timing per op |
| API uptime | 99.9% | Render health checks + Sentry |
| DAU per community | TBD | PostHog analytics |