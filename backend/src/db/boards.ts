import { supabase } from './supabase';
import { WhiteboardState } from '../types';

export interface Board {
  id: string;
  roomId: string;
  name: string | null;
  state: WhiteboardState;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface UserBoardAccess {
  id: string;
  clerkUserId: string;
  roomId: string;
  lastAccessedAt: string;
  customName: string | null;
}

export interface BoardWithAccess extends Board {
  customName: string | null;
  lastAccessedAt: string;
}

/**
 * Get board by roomId from database
 */
export async function getBoardByRoomId(roomId: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('roomId', roomId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching board:', error);
    throw error;
  }

  return data as Board;
}

/**
 * Save or update board state in database
 */
export async function saveBoardState(
  roomId: string,
  state: WhiteboardState,
  name?: string | null
): Promise<Board> {
  const now = new Date().toISOString();

  // Check if board exists
  const existing = await getBoardByRoomId(roomId);

  if (existing) {
    // Update existing board
    const { data, error } = await supabase
      .from('boards')
      .update({
        state: state as any, // JSONB
        updatedAt: now,
        lastActivityAt: now,
        ...(name !== undefined && { name })
      })
      .eq('roomId', roomId)
      .select()
      .single();

    if (error) {
      console.error('Error updating board:', error);
      throw error;
    }

    return data as Board;
  } else {
    // Create new board
    const { data, error } = await supabase
      .from('boards')
      .insert({
        roomId,
        state: state as any, // JSONB
        name: name || null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating board:', error);
      throw error;
    }

    return data as Board;
  }
}

/**
 * Create a new board
 */
export async function createBoard(
  roomId: string,
  name?: string | null,
  clerkUserId?: string | null
): Promise<Board> {
  const emptyState: WhiteboardState = {
    strokes: {},
    texts: {},
    users: {},
    messages: []
  };

  const board = await saveBoardState(roomId, emptyState, name);

  // Record user access if clerkUserId provided
  if (clerkUserId) {
    await recordUserAccess(clerkUserId, roomId, name);
  }

  return board;
}

/**
 * Get boards that a user has accessed (for dashboard)
 */
export async function getUserBoards(clerkUserId: string): Promise<BoardWithAccess[]> {
  const { data, error } = await supabase
    .from('user_board_access')
    .select(`
      *,
      boards (*)
    `)
    .eq('clerkUserId', clerkUserId)
    .order('lastAccessedAt', { ascending: false });

  if (error) {
    console.error('Error fetching user boards:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((access: { boards: Board; customName: string | null; lastAccessedAt: string }) => ({
    ...access.boards,
    customName: access.customName,
    lastAccessedAt: access.lastAccessedAt
  }));
}

/**
 * Record that a user accessed a board
 */
export async function recordUserAccess(
  clerkUserId: string,
  roomId: string,
  customName?: string | null
): Promise<UserBoardAccess> {
  const now = new Date().toISOString();

  // Check if access record exists
  const { data: existing } = await supabase
    .from('user_board_access')
    .select('*')
    .eq('clerkUserId', clerkUserId)
    .eq('roomId', roomId)
    .single();

  if (existing) {
    // Update lastAccessedAt
    const { data, error } = await supabase
      .from('user_board_access')
      .update({
        lastAccessedAt: now,
        ...(customName !== undefined && { customName })
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user board access:', error);
      throw error;
    }

    return data as UserBoardAccess;
  } else {
    // Create new access record
    const { data, error } = await supabase
      .from('user_board_access')
      .insert({
        clerkUserId,
        roomId,
        lastAccessedAt: now,
        customName: customName || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user board access:', error);
      throw error;
    }

    return data as UserBoardAccess;
  }
}

/**
 * Update user's custom name for a board
 */
export async function updateUserBoardName(
  clerkUserId: string,
  roomId: string,
  customName: string
): Promise<UserBoardAccess> {
  const { data, error } = await supabase
    .from('user_board_access')
    .update({ customName })
    .eq('clerkUserId', clerkUserId)
    .eq('roomId', roomId)
    .select()
    .single();

  if (error) {
    console.error('Error updating board name:', error);
    throw error;
  }

  return data as UserBoardAccess;
}

/**
 * Remove board from user's dashboard
 */
export async function deleteUserBoardAccess(
  clerkUserId: string,
  roomId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_board_access')
    .delete()
    .eq('clerkUserId', clerkUserId)
    .eq('roomId', roomId);

  if (error) {
    console.error('Error deleting user board access:', error);
    throw error;
  }
}

/**
 * Delete a board (and all access records via CASCADE)
 */
export async function deleteBoard(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('roomId', roomId);

  if (error) {
    console.error('Error deleting board:', error);
    throw error;
  }
}
