# Dashboard with Global Board State (Supabase)

## Overview

Add a dashboard page for authenticated users to manage whiteboards. Boards have **global state** - changes made by any user sync to all users who have accessed that board. When a user returns to the dashboard, they see boards they've accessed with the latest state (including changes made by others while they were away).

## Key Concepts

### Global Board State

- Boards are **shared/global** - not user-owned
- Multiple users can work on the same board simultaneously
- Real-time changes sync via Socket.io AND persist to Supabase
- When a user accesses a board, it appears in their dashboard
- Dashboard shows latest state from database (includes changes from others)

### Data Model

- **Boards Table**: Global board state (one per roomId)
- **UserBoardAccess Table**: Tracks which users have accessed which boards (for dashboard visibility)

## Architecture Changes

### Database Setup (Supabase)

**Tables**:

1. **boards** (global board state):

   - `id` (UUID, primary key)
   - `roomId` (TEXT, unique, permanent code)
   - `name` (TEXT, user-friendly name, nullable)
   - `state` (JSONB, full WhiteboardState)
   - `createdAt` (TIMESTAMP)
   - `updatedAt` (TIMESTAMP)
   - `lastActivityAt` (TIMESTAMP)

2. **user_board_access** (dashboard visibility):

   - `id` (UUID, primary key)
   - `clerkUserId` (TEXT, Clerk user ID)
   - `roomId` (TEXT, foreign key to boards.roomId)
   - `lastAccessedAt` (TIMESTAMP)
   - `customName` (TEXT, user's custom name for this board, nullable)
   - Unique constraint on (clerkUserId, roomId)

**Indexes**:

- `boards(roomId)` - unique index
- `user_board_access(clerkUserId, lastAccessedAt DESC)` - for dashboard queries
- `user_board_access(roomId)` - for board access lookups

### Backend Changes

1. **Supabase Client** (`backend/src/db/supabase.ts`):

   - Initialize Supabase client with environment variables
   - Type-safe database operations

2. **Board Database Operations** (`backend/src/db/boards.ts`):

   - `getBoardByRoomId(roomId)` - Get board state from DB
   - `saveBoardState(roomId, state, name?)` - Save/update board state
   - `createBoard(roomId, name?, clerkUserId?)` - Create new board
   - `getUserBoards(clerkUserId)` - Get boards user has accessed (for dashboard)
   - `recordUserAccess(clerkUserId, roomId, customName?)` - Record user accessed board
   - `updateUserBoardName(clerkUserId, roomId, customName)` - Update user's custom name
   - `deleteUserBoardAccess(clerkUserId, roomId)` - Remove from user's dashboard
   - `deleteBoard(roomId)` - Delete board (and all access records)

3. **REST API Endpoints** (`backend/src/index.ts`):

   - `GET /api/boards` - List user's boards (from user_board_access, sorted by lastAccessedAt)
   - `POST /api/boards` - Create new board (with roomId)
   - `GET /api/boards/:roomId` - Get board details
   - `PATCH /api/boards/:roomId` - Update board name or user's custom name
   - `DELETE /api/boards/:roomId` - Remove from user's dashboard (or delete if owner)
   - `GET /api/boards/:roomId/state` - Get current board state

4. **Socket Handler Updates** (`backend/src/socket/handlers.ts`):

   - **On room join**:
     - Load board state from Supabase if exists
     - Merge with in-memory state (DB takes precedence)
     - Record user access in `user_board_access`
   - **On state changes** (debounced, every 2-3 seconds):
     - Save board state to Supabase
     - Update `lastActivityAt` timestamp
   - **On disconnect**:
     - Final save of board state to Supabase

5. **Room Manager Updates** (`backend/src/rooms/manager.ts`):

   - Add `loadBoardFromDatabase(roomId)` - Load state from Supabase
   - Add `saveBoardToDatabase(roomId, state)` - Save state to Supabase (debounced)
   - Update `touchRoom()` to update `lastActivityAt` in Supabase
   - Modify `createRoom()` to check/create in Supabase

### Frontend Changes

1. **New Dashboard Page** (`frontend/src/app/dashboard/page.tsx`):

   - Protected route (redirect to landing if not signed in)
   - Fetches user's boards from API (sorted by lastAccessedAt)
   - Grid/list view of boards
   - Create new board button
   - Board cards showing:
     - Board name (user's custom name or default)
     - Last accessed time
     - Last activity time (when board was last modified)
     - Actions: Open, Rename, Delete, Copy Link
   - Empty state for new users
   - Real-time updates (poll or WebSocket for state changes)

2. **Navigation Flow Updates**:

   - `frontend/src/app/page.tsx`: 
     - Signed-in users see "Go to Dashboard" button
     - Guest users continue with current flow
   - `frontend/src/app/dashboard/page.tsx`: New dashboard page
   - `frontend/src/app/room/[roomId]/page.tsx`: 
     - On mount: Load state from Supabase if available
     - Merge with in-memory state
     - Record user access

3. **New Components**:

   - `frontend/src/components/BoardCard.tsx` - Individual board card with actions
   - `frontend/src/components/CreateBoardModal.tsx` - Create board dialog
   - `frontend/src/components/DeleteBoardModal.tsx` - Delete/remove confirmation
   - `frontend/src/components/RenameBoardModal.tsx` - Rename dialog (user's custom name)

4. **API Client** (`frontend/src/lib/api.ts`):

   - `getUserBoards()` - Fetch user's boards
   - `createBoard(name?)` - Create new board
   - `getBoardState(roomId)` - Get board state
   - `updateBoardName(roomId, customName)` - Update user's custom name
   - `removeBoardFromDashboard(roomId)` - Remove from dashboard
   - `deleteBoard(roomId)` - Delete board permanently

## Implementation Steps

1. **Supabase Setup**:

   - Create Supabase project
   - Create tables and indexes
   - Set up Row Level Security (RLS) policies
   - Add environment variables

2. **Backend Database Integration**:

   - Install `@supabase/supabase-js`
   - Create Supabase client
   - Implement board database operations
   - Add authentication middleware (verify Clerk token)

3. **Backend API Endpoints**:

   - Implement board CRUD endpoints
   - Add Clerk token verification
   - Handle user_board_access operations

4. **Socket Integration**:

   - Load board state from Supabase on room join
   - Debounced auto-save to Supabase (every 2-3 seconds)
   - Final save on disconnect
   - Record user access on join

5. **Frontend Dashboard**:

   - Create dashboard page with board list
   - Implement board management UI
   - Add create/rename/delete flows
   - Add real-time state polling

6. **Navigation Updates**:

   - Update landing page for signed-in users
   - Add dashboard link in header
   - Update room page to load from Supabase

## Files to Create/Modify

**New Files**:

- `backend/src/db/supabase.ts`
- `backend/src/db/boards.ts`
- `backend/src/middleware/auth.ts` (Clerk token verification)
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/BoardCard.tsx`
- `frontend/src/components/CreateBoardModal.tsx`
- `frontend/src/components/DeleteBoardModal.tsx`
- `frontend/src/components/RenameBoardModal.tsx`
- `frontend/src/lib/api.ts`
- `supabase/migrations/001_initial.sql` (SQL migration file)

**Modified Files**:

- `backend/package.json` (add @supabase/supabase-js)
- `backend/src/index.ts` (add board API routes)
- `backend/src/socket/handlers.ts` (Supabase load/save integration)
- `backend/src/rooms/manager.ts` (Supabase save/load functions)
- `frontend/src/app/page.tsx` (dashboard link for signed-in users)
- `frontend/src/app/room/[roomId]/page.tsx` (load from Supabase)
- `frontend/src/app/layout.tsx` (add dashboard link if signed in)

## Supabase Schema (SQL)

```sql
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
CREATE POLICY "Boards are readable by all" ON boards FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create boards" ON boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update boards" ON boards FOR UPDATE USING (true);

-- User board access: Users can only see/modify their own records
CREATE POLICY "Users can view their own board access" ON user_board_access FOR SELECT USING (auth.jwt() ->> 'sub' = clerkUserId);
CREATE POLICY "Users can create their own board access" ON user_board_access FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = clerkUserId);
CREATE POLICY "Users can update their own board access" ON user_board_access FOR UPDATE USING (auth.jwt() ->> 'sub' = clerkUserId);
CREATE POLICY "Users can delete their own board access" ON user_board_access FOR DELETE USING (auth.jwt() ->> 'sub' = clerkUserId);
```

## Real-time Sync Flow

```
User A joins room → Load state from Supabase → Merge with in-memory
User A draws → Socket.io broadcasts → Other users see change
                     ↓
              Debounced save (2-3s) → Save to Supabase
                     ↓
User B joins later → Load from Supabase → Sees User A's changes
```

## Notes

- Board codes (`roomId`) are permanent and unique
- Full board state is saved as JSONB in Supabase
- State is auto-saved every 2-3 seconds during active sessions
- Final save on user disconnect
- Dashboard shows boards user has accessed, with latest state
- User's custom name is stored in `user_board_access`, not in `boards`
- Multiple users can have different custom names for the same board
- Guest users continue to work as before (no dashboard, no persistence)