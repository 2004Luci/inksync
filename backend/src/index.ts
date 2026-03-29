// Load environment variables from .env file
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
import { getRoom } from './rooms/manager';
import { verifyClerkAuth, AuthenticatedRequest } from './middleware/auth';
import {
  getUserBoards,
  createBoard,
  getBoardByRoomId,
  updateUserBoardName,
  deleteUserBoardAccess,
  deleteBoard
} from './db/boards';

const app = express();
const httpServer = createServer(app);

// Configure CORS
const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Allow requests with no origin (health checks, server-to-server, same-origin)
  if (!origin) return true;
  
  // Allow localhost for development
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  
  // Allow Vercel preview and production URLs
  if (origin.includes('.vercel.app') || origin.includes('vercel.app')) {
    return true;
  }
  
  // Allow explicitly configured frontend URL
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }
  
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

type NanoidModule = { nanoid: (size?: number) => string };

let nanoidPromise: Promise<NanoidModule> | null = null;

function loadNanoid(): Promise<NanoidModule> {
  if (!nanoidPromise) {
    // Dynamic import keeps nanoid (ESM) working with our CJS build output.
    const importer = new Function("return import('nanoid')") as () => Promise<NanoidModule>;
    nanoidPromise = importer();
  }
  return nanoidPromise;
}

async function createRoomId(): Promise<string> {
  const { nanoid } = await loadNanoid();
  return nanoid(8);
}

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Setup socket handlers
setupSocketHandlers(io);

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const roomId = await createRoomId();
    res.json({ roomId });
  } catch (error) {
    console.error('Failed to create room ID', error);
    res.status(500).json({ error: 'ROOM_ID_FAILED' });
  }
});

// Check if room exists
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  res.json({ roomId, exists: !!room });
});

// Board API endpoints (require authentication)
// Get user's boards (dashboard)
app.get('/api/boards', verifyClerkAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkUserId = req.clerkUserId!;
    console.log('Fetching boards for user:', clerkUserId);
    const boards = await getUserBoards(clerkUserId);
    console.log('Found boards:', boards.length);
    // Return empty array if no boards (this is normal for new users)
    res.json(boards || []);
  } catch (error) {
    console.error('Error fetching user boards:', error);
    // Check if it's a table not found error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST205') {
      res.status(500).json({ 
        error: 'Database tables not found. Please run the Supabase migration SQL.',
        details: 'message' in error ? String(error.message) : 'Tables missing'
      });
    } else {
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? String(error.message) 
        : 'Unknown error';
      const errorCode = error && typeof error === 'object' && 'code' in error 
        ? String(error.code) 
        : undefined;
      res.status(500).json({ 
        error: 'Failed to fetch boards', 
        details: errorMessage,
        code: errorCode
      });
    }
  }
});

// Create a new board
app.post('/api/boards', verifyClerkAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkUserId = req.clerkUserId!;
    const { name, roomId } = req.body;

    // Generate roomId if not provided
    let finalRoomId = roomId;
    if (!finalRoomId) {
      finalRoomId = await createRoomId();
    }

    const board = await createBoard(finalRoomId, name || null, clerkUserId);
    res.json(board);
  } catch (error) {
    console.error('Error creating board:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      // Unique constraint violation
      res.status(409).json({ error: 'Board with this room ID already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create board' });
    }
  }
});

// Get board by roomId
app.get('/api/boards/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const board = await getBoardByRoomId(roomId);
    
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// Get board state
app.get('/api/boards/:roomId/state', async (req, res) => {
  try {
    const { roomId } = req.params;
    const board = await getBoardByRoomId(roomId);
    
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    res.json({ state: board.state });
  } catch (error) {
    console.error('Error fetching board state:', error);
    res.status(500).json({ error: 'Failed to fetch board state' });
  }
});

// Update board (rename user's custom name)
app.patch('/api/boards/:roomId', verifyClerkAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkUserId = req.clerkUserId!;
    const { roomId } = req.params;
    const { customName } = req.body;

    if (customName !== undefined) {
      await updateUserBoardName(clerkUserId, roomId, customName);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'customName is required' });
    }
  } catch (error) {
    console.error('Error updating board:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
      res.status(404).json({ error: 'Board access not found' });
    } else {
      res.status(500).json({ error: 'Failed to update board' });
    }
  }
});

// Delete board from user's dashboard or delete board entirely
app.delete('/api/boards/:roomId', verifyClerkAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkUserId = req.clerkUserId!;
    const { roomId } = req.params;
    const { permanent } = req.query; // If permanent=true, delete the board entirely

    if (permanent === 'true') {
      // Delete board entirely (and all access records via CASCADE)
      await deleteBoard(roomId);
      res.json({ success: true, message: 'Board deleted permanently' });
    } else {
      // Just remove from user's dashboard
      await deleteUserBoardAccess(clerkUserId, roomId);
      res.json({ success: true, message: 'Board removed from dashboard' });
    }
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 CORS configured for:`);
  console.log(`   - Localhost (development)`);
  console.log(`   - All Vercel preview URLs (*.vercel.app)`);
  if (process.env.FRONTEND_URL) {
    console.log(`   - Frontend URL: ${process.env.FRONTEND_URL}`);
  }
});
