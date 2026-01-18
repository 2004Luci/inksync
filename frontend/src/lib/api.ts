const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

import { WhiteboardState } from './types';

export interface Board {
  id: string;
  roomId: string;
  name: string | null;
  state: WhiteboardState;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  customName?: string | null;
  lastAccessedAt?: string;
}

/**
 * Get user's boards (for dashboard)
 */
export async function getUserBoards(token: string): Promise<Board[]> {
  try {
    const response = await fetch(`${API_URL}/api/boards`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      const errorMessage = errorData.error || errorData.details || `Failed to fetch boards (${response.status})`;
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Return empty array if no boards (this is normal for new users)
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Failed to fetch boards');
  }
}

/**
 * Create a new board
 */
export async function createBoard(token: string, name?: string, roomId?: string): Promise<Board> {
  const response = await fetch(`${API_URL}/api/boards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, roomId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create board');
  }

  return response.json();
}

/**
 * Get board by roomId
 */
export async function getBoard(roomId: string): Promise<Board> {
  const response = await fetch(`${API_URL}/api/boards/${roomId}`);

  if (!response.ok) {
    throw new Error('Board not found');
  }

  return response.json();
}

/**
 * Get board state
 */
export async function getBoardState(roomId: string): Promise<{ state: WhiteboardState }> {
  const response = await fetch(`${API_URL}/api/boards/${roomId}/state`);

  if (!response.ok) {
    throw new Error('Board not found');
  }

  return response.json();
}

/**
 * Update user's custom name for a board
 */
export async function updateBoardName(token: string, roomId: string, customName: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/boards/${roomId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customName }),
  });

  if (!response.ok) {
    throw new Error('Failed to update board name');
  }
}

/**
 * Remove board from user's dashboard
 */
export async function removeBoardFromDashboard(token: string, roomId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/boards/${roomId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to remove board');
  }
}

/**
 * Delete board permanently
 */
export async function deleteBoard(token: string, roomId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/boards/${roomId}?permanent=true`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete board');
  }
}
