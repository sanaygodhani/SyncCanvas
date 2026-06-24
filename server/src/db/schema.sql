-- Phase 1: Initial Schema for SyncCanvas

-- Users Table (Referenced by Better Auth)
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

-- User Relationships (Friends/Blocking)
CREATE TABLE user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- friend, blocked, follower, following
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_id)
);

-- Communities Table
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

-- Community Members Junction Table
CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, moderator, member
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- Channel Categories
CREATE TABLE channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels Table
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

-- Messages Table
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

-- Whiteboard Elements
CREATE TABLE whiteboard_elements (
  id UUID PRIMARY KEY, -- Element ID (often UUID or client-generated)
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

-- Roles Table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),
  position INTEGER DEFAULT 0,
  permissions BIGINT DEFAULT 0, -- Bitfield
  is_mentionable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Assignments
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(role_id, user_id)
);
