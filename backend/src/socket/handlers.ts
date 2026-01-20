import { Server, Socket } from 'socket.io';
import {
  addUserToRoom,
  removeUserFromRoom,
  getRoom,
  addStroke,
  removeStrokes,
  addText,
  updateText,
  removeText,
  addShape,
  updateShape,
  removeShape,
  addChatMessage,
  clearBoard,
  getNewHostId,
  getRoomExpiryInfo,
  touchRoom,
  loadBoardFromDatabase,
  saveBoardToDatabase,
  forceSaveBoardToDatabase
} from '../rooms/manager';
import { Stroke, TextItem, ShapeItem, JoinRoomPayload, CursorUpdate, Point, ChatMessage } from '../types';

interface SocketData {
  userId: string;
  roomId: string;
  userName: string;
  clerkUserId: string | null;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    let socketData: SocketData | null = null;

    // Join room
    socket.on('room:join', async (payload: JoinRoomPayload & { clerkUserId?: string }) => {
      const { roomId, userName, isCreating = false, clerkUserId } = payload;
      const userId = socket.id;

      // Validate room ID format (basic check)
      if (!roomId || roomId.length < 4 || roomId.length > 20) {
        socket.emit('room:error', {
          code: 'INVALID_ROOM_ID',
          message: 'Invalid room ID format'
        });
        return;
      }

      socketData = { userId, roomId, userName, clerkUserId: clerkUserId || null };

      // Join the socket room
      socket.join(roomId);
      
      // Load board state from Supabase if it exists
      const dbState = await loadBoardFromDatabase(roomId);

      // Add user to room state (pass Clerk user ID for ownership tracking)
      // This will create the room if it doesn't exist (via getOrCreateRoom)
      const { user } = addUserToRoom(roomId, userId, userName, clerkUserId || null);

      // Get current room state
      const room = getRoom(roomId);
      if (!room) {
        socket.emit('room:error', {
          code: 'ROOM_CREATION_FAILED',
          message: 'Failed to create or access room'
        });
        return;
      }

      // Merge database state with in-memory state (DB takes precedence)
      if (dbState) {
        // Database state takes precedence - overwrite in-memory state
        room.state.strokes = { ...dbState.strokes };
        room.state.texts = { ...dbState.texts };
        // Keep current users (don't overwrite with DB users - they're session-specific)
        // Merge messages: DB messages + any new in-memory messages
        if (dbState.messages && dbState.messages.length > 0) {
          // Start with DB messages, add any new in-memory messages
          const existingMessageIds = new Set(dbState.messages.map(m => m.id));
          const newMessages = room.state.messages.filter(m => !existingMessageIds.has(m.id));
          room.state.messages = [...dbState.messages, ...newMessages].slice(-200); // Keep last 200
        }
        console.log(`Loaded board state from database for room ${roomId}`);
      }

      // Record user access in database if authenticated
      if (clerkUserId) {
        try {
          const { recordUserAccess } = await import('../db/boards');
          await recordUserAccess(clerkUserId, roomId);
        } catch (error) {
          console.error(`Error recording user access for ${roomId}:`, error);
        }
      }

      // Get room expiry info
      const expiryInfo = getRoomExpiryInfo(roomId);

      // Send full state to the joining user
      socket.emit('room:state', {
        state: room.state,
        userId,
        role: user.role,
        userColor: user.color,
        expiresAt: expiryInfo?.expiresAt || null,
        isGuest: expiryInfo?.isGuest || false
      });

      // Broadcast to others that a new user joined
      socket.to(roomId).emit('user:joined', user);

      const authStatus = clerkUserId ? 'authenticated' : 'guest';
      console.log(`User ${userName} (${userId}) joined room ${roomId} as ${user.role} [${authStatus}]`);
    });

    // New stroke added
    socket.on('stroke:add', (stroke: Stroke) => {
      if (!socketData) return;
      const { roomId, clerkUserId } = socketData;

      if (addStroke(roomId, stroke)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('stroke:added', stroke);
        
        // Auto-save to database (debounced)
        const room = getRoom(roomId);
        if (room) {
          saveBoardToDatabase(roomId, room.state, clerkUserId || null).catch((error) => {
            console.error(`Error saving board ${roomId} after stroke:`, error);
          });
        }
      }
    });

    // Strokes erased
    socket.on('erase:strokes', (strokeIds: string[]) => {
      if (!socketData) return;
      const { roomId, clerkUserId } = socketData;

      if (removeStrokes(roomId, strokeIds)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('strokes:erased', strokeIds);
        
        // Auto-save to database (debounced)
        const room = getRoom(roomId);
        if (room) {
          saveBoardToDatabase(roomId, room.state, clerkUserId || null).catch((error) => {
            console.error(`Error saving board ${roomId} after erase:`, error);
          });
        }
      }
    });

    // Text added
    socket.on('text:add', (text: TextItem) => {
      if (!socketData) return;
      const { roomId, clerkUserId } = socketData;

      if (addText(roomId, text)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('text:added', text);
        
        // Auto-save to database (debounced)
        const room = getRoom(roomId);
        if (room) {
          saveBoardToDatabase(roomId, room.state, clerkUserId || null).catch((error) => {
            console.error(`Error saving board ${roomId} after text add:`, error);
          });
        }
      }
    });

    socket.on('text:update', (text: TextItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (updateText(roomId, text)) {
        socket.to(roomId).emit('text:updated', text);
      }
    });

    socket.on('text:remove', (textId: string) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (removeText(roomId, textId)) {
        socket.to(roomId).emit('text:removed', textId);
      }
    });

    // Shape added
    socket.on('shape:add', (shape: ShapeItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (addShape(roomId, shape)) {
        socket.to(roomId).emit('shape:added', shape);
      }
    });

    // Shape updated
    socket.on('shape:update', (shape: ShapeItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (updateShape(roomId, shape)) {
        socket.to(roomId).emit('shape:updated', shape);
      }
    });

    // Shape removed
    socket.on('shape:remove', (shapeId: string) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (removeShape(roomId, shapeId)) {
        socket.to(roomId).emit('shape:removed', shapeId);
      }
    });

    // Chat message sent
    socket.on('chat:send', (payload: { content: string }) => {
      if (!socketData) return;
      const { roomId, userId } = socketData;

      const room = getRoom(roomId);
      if (!room) return;

      const user = room.state.users[userId];
      if (!user) return;

      const trimmed = (payload?.content || '').trim();
      if (!trimmed) return;

      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        userName: user.name,
        userColor: user.color,
        content: trimmed.slice(0, 500),
        timestamp: Date.now(),
      };

      if (addChatMessage(roomId, message)) {
        io.to(roomId).emit('chat:new', message);
      }
    });

    // Clear board (host only)
    socket.on('board:clear', () => {
      if (!socketData) return;
      const { roomId, userId, clerkUserId } = socketData;

      if (clearBoard(roomId, userId)) {
        io.to(roomId).emit('board:cleared');
        
        // Auto-save to database (debounced)
        const room = getRoom(roomId);
        if (room) {
          saveBoardToDatabase(roomId, room.state, clerkUserId || null).catch((error) => {
            console.error(`Error saving board ${roomId} after clear:`, error);
          });
        }
      }
    });

    // Cursor position update
    socket.on('cursor:move', (data: { position: Point; isActive: boolean }) => {
      if (!socketData) return;
      const { roomId, userId, userName } = socketData;

      const room = getRoom(roomId);
      if (!room) return;

      const user = room.state.users[userId];
      if (!user) return;

      const cursorUpdate: CursorUpdate = {
        userId,
        userName,
        userColor: user.color,
        position: data.position,
        isActive: data.isActive,
      };

      // Broadcast to others (not back to sender)
      socket.to(roomId).emit('cursor:update', cursorUpdate);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (!socketData) return;
      const { roomId, userId, clerkUserId } = socketData;

      const user = removeUserFromRoom(roomId, userId);
      if (user) {
        socket.to(roomId).emit('user:left', userId);

        // If host left, notify about new host
        const newHostId = getNewHostId(roomId);
        if (newHostId && newHostId !== userId) {
          io.to(roomId).emit('host:changed', newHostId);
        }
      }
      
      // Force save board state to database on disconnect
      const room = getRoom(roomId);
      if (room) {
        try {
          await forceSaveBoardToDatabase(roomId, room.state, clerkUserId || null);
          console.log(`Force saved board ${roomId} on disconnect`);
        } catch (error) {
          console.error(`Error force saving board ${roomId} on disconnect:`, error);
        }
      }

      console.log('Client disconnected:', socket.id);
    });
  });
}
