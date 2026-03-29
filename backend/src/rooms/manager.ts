import { Room, WhiteboardState, Stroke, TextItem, ShapeItem, User, ChatMessage } from '../types';
import { getBoardByRoomId, saveBoardState, recordUserAccess } from '../db/boards';

// In-memory room storage
const rooms = new Map<string, Room>();

// Room metadata for expiration
interface RoomMeta {
  createdAt: number;
  ownerId: string | null; // Clerk user ID if authenticated, null for guests
  lastActivity: number;
}
const roomMeta = new Map<string, RoomMeta>();

// Expiration time: 24 hours for guest rooms
const GUEST_ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Generate random color for users
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];
const MAX_CHAT_MESSAGES = 200;

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function createEmptyState(): WhiteboardState {
  return {
    strokes: {},
    texts: {},
    shapes: {},
    users: {},
    messages: []
  };
}

export function createRoom(roomId: string, ownerId: string | null = null): Room {
  const room: Room = {
    id: roomId,
    state: createEmptyState(),
    hostId: null
  };
  rooms.set(roomId, room);

  // Store room metadata
  const now = Date.now();
  roomMeta.set(roomId, {
    createdAt: now,
    ownerId,
    lastActivity: now
  });

  return room;
}

// Update room activity timestamp
export function touchRoom(roomId: string): void {
  const meta = roomMeta.get(roomId);
  if (meta) {
    meta.lastActivity = Date.now();
  }
}

// Debounced save timers for each room
const saveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Load board state from Supabase database
 */
export async function loadBoardFromDatabase(roomId: string): Promise<WhiteboardState | null> {
  try {
    const board = await getBoardByRoomId(roomId);
    if (board && board.state) {
      return board.state as WhiteboardState;
    }
    return null;
  } catch (error) {
    console.error(`Error loading board ${roomId} from database:`, error);
    return null;
  }
}

/**
 * Save board state to Supabase database (debounced)
 */
export async function saveBoardToDatabase(
  roomId: string,
  state: WhiteboardState,
  clerkUserId?: string | null
): Promise<void> {
  try {
    // Clear existing timer for this room
    const existingTimer = saveTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced save (2 seconds)
    const timer = setTimeout(async () => {
      try {
        await saveBoardState(roomId, state);
        console.log(`Saved board ${roomId} to database`);
      } catch (error) {
        console.error(`Error saving board ${roomId} to database:`, error);
      }
      saveTimers.delete(roomId);
    }, 2000);

    saveTimers.set(roomId, timer);

    // Record user access if clerkUserId provided
    if (clerkUserId) {
      recordUserAccess(clerkUserId, roomId).catch((error) => {
        console.error(`Error recording user access for ${roomId}:`, error);
      });
    }
  } catch (error) {
    console.error(`Error scheduling save for board ${roomId}:`, error);
  }
}

/**
 * Force immediate save (no debounce) - used on disconnect
 */
export async function forceSaveBoardToDatabase(
  roomId: string,
  state: WhiteboardState,
  clerkUserId?: string | null
): Promise<void> {
  try {
    // Clear any pending debounced save
    const existingTimer = saveTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      saveTimers.delete(roomId);
    }

    // Save immediately
    await saveBoardState(roomId, state);
    console.log(`Force saved board ${roomId} to database`);

    // Record user access if clerkUserId provided
    if (clerkUserId) {
      await recordUserAccess(clerkUserId, roomId);
    }
  } catch (error) {
    console.error(`Error force saving board ${roomId} to database:`, error);
  }
}

// Check if room is expired (only guest rooms expire)
export function isRoomExpired(roomId: string): boolean {
  const meta = roomMeta.get(roomId);
  if (!meta) return false;

  // Authenticated user rooms never expire
  if (meta.ownerId) return false;

  // Guest rooms expire after 24 hours
  return Date.now() - meta.createdAt > GUEST_ROOM_EXPIRY_MS;
}

// Get room expiry info
export function getRoomExpiryInfo(roomId: string): { expiresAt: number | null; isGuest: boolean } | null {
  const meta = roomMeta.get(roomId);
  if (!meta) return null;

  if (meta.ownerId) {
    return { expiresAt: null, isGuest: false };
  }

  return {
    expiresAt: meta.createdAt + GUEST_ROOM_EXPIRY_MS,
    isGuest: true
  };
}

// Cleanup expired rooms periodically
export function cleanupExpiredRooms(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [roomId, meta] of roomMeta.entries()) {
    // Only cleanup guest rooms
    if (!meta.ownerId && now - meta.createdAt > GUEST_ROOM_EXPIRY_MS) {
      rooms.delete(roomId);
      roomMeta.delete(roomId);
      cleaned++;
      console.log(`Cleaned up expired guest room: ${roomId}`);
    }
  }

  return cleaned;
}

// Start cleanup interval (run every hour)
setInterval(() => {
  const cleaned = cleanupExpiredRooms();
  if (cleaned > 0) {
    console.log(`Cleanup: removed ${cleaned} expired guest rooms`);
  }
}, 60 * 60 * 1000);

export function getRoom(roomId: string): Room | undefined {
  // Check if room is expired before returning
  if (isRoomExpired(roomId)) {
    rooms.delete(roomId);
    roomMeta.delete(roomId);
    return undefined;
  }
  return rooms.get(roomId);
}

export function getOrCreateRoom(roomId: string, ownerId: string | null = null): Room {
  // Check for expired room first
  if (isRoomExpired(roomId)) {
    rooms.delete(roomId);
    roomMeta.delete(roomId);
  }

  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId, ownerId);
  }
  return room;
}

export function addUserToRoom(
  roomId: string,
  userId: string,
  userName: string,
  clerkUserId: string | null = null
): { user: User; isHost: boolean } {
  const room = getOrCreateRoom(roomId, clerkUserId);
  const isHost = room.hostId === null;

  if (isHost) {
    room.hostId = userId;
  }

  const user: User = {
    userId,
    role: isHost ? 'host' : 'participant',
    color: getRandomColor(),
    name: userName
  };

  room.state.users[userId] = user;

  // Update room activity
  touchRoom(roomId);

  return { user, isHost };
}

export function removeUserFromRoom(roomId: string, userId: string): User | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const user = room.state.users[userId];
  if (!user) return null;

  delete room.state.users[userId];

  // Transfer host to next user if host left
  if (room.hostId === userId) {
    const remainingUsers = Object.keys(room.state.users);
    if (remainingUsers.length > 0) {
      room.hostId = remainingUsers[0];
      room.state.users[remainingUsers[0]].role = 'host';
    } else {
      room.hostId = null;
      // Clean up empty room after a delay
      setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (currentRoom && Object.keys(currentRoom.state.users).length === 0) {
          rooms.delete(roomId);
        }
      }, 60000); // 1 minute
    }
  }

  return user;
}

export function addStroke(roomId: string, stroke: Stroke): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.strokes[stroke.id] = stroke;
  return true;
}

export function removeStrokes(roomId: string, strokeIds: string[]): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  for (const id of strokeIds) {
    delete room.state.strokes[id];
  }
  return true;
}

export function addText(roomId: string, text: TextItem): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.texts[text.id] = text;
  return true;
}

export function updateText(roomId: string, text: TextItem): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (!room.state.texts[text.id]) return false;
  room.state.texts[text.id] = text;
  return true;
}

export function removeText(roomId: string, textId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (!room.state.texts[textId]) return false;
  delete room.state.texts[textId];
  return true;
}

export function clearBoard(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  // Only host can clear the board
  if (room.hostId !== userId) return false;

  room.state.strokes = {};
  room.state.texts = {};
  room.state.shapes = {};
  return true;
}

// Shape management functions
export function addShape(roomId: string, shape: ShapeItem): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.shapes[shape.id] = shape;
  return true;
}

export function updateShape(roomId: string, shape: ShapeItem): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (!room.state.shapes[shape.id]) return false;
  room.state.shapes[shape.id] = shape;
  return true;
}

export function removeShape(roomId: string, shapeId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (!room.state.shapes[shapeId]) return false;
  delete room.state.shapes[shapeId];
  return true;
}

export function addChatMessage(roomId: string, message: ChatMessage): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.messages.push(message);
  if (room.state.messages.length > MAX_CHAT_MESSAGES) {
    room.state.messages = room.state.messages.slice(-MAX_CHAT_MESSAGES);
  }
  return true;
}

export function isHost(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  return room?.hostId === userId;
}

export function getNewHostId(roomId: string): string | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  return room.hostId;
}
