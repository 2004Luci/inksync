-- Boards table (global state)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roomId TEXT UNIQUE NOT NULL,
  name TEXT,
  state JSONB NOT NULL DEFAULT '{}',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lastActivityAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_boards_room_id ON boards(roomId);
CREATE INDEX idx_boards_last_activity ON boards(lastActivityAt DESC);

-- User board access (dashboard visibility)
CREATE TABLE user_board_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerkUserId TEXT NOT NULL,
  roomId TEXT NOT NULL REFERENCES boards(roomId) ON DELETE CASCADE,
  lastAccessedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customName TEXT,
  UNIQUE(clerkUserId, roomId)
);

CREATE INDEX idx_user_board_access_user ON user_board_access(clerkUserId, lastAccessedAt DESC);
CREATE INDEX idx_user_board_access_room ON user_board_access(roomId);

-- RLS Policies
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_board_access ENABLE ROW LEVEL SECURITY;

-- Boards: Anyone can read, authenticated users can create/update
-- Note: We'll handle authentication in the backend, so we allow all operations
CREATE POLICY "Boards are readable by all" ON boards FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create boards" ON boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update boards" ON boards FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete boards" ON boards FOR DELETE USING (true);

-- User board access: Users can only see/modify their own records
-- Note: We'll verify Clerk user ID in the backend, so we allow all operations here
CREATE POLICY "Users can view their own board access" ON user_board_access FOR SELECT USING (true);
CREATE POLICY "Users can create their own board access" ON user_board_access FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own board access" ON user_board_access FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own board access" ON user_board_access FOR DELETE USING (true);
