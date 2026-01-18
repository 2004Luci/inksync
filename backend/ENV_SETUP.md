# Environment Variables Setup

## Required Environment Variables

The backend requires the following environment variables to be set:

### Supabase Keys

1. **SUPABASE_URL**
   - Where to get it: Supabase Dashboard → Settings → API → Project URL
   - Example: `https://abcdefghijklmnop.supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY**
   - Where to get it: Supabase Dashboard → Settings → API → Service Role Key (secret)
   - ⚠️ **Important**: This is a secret key that bypasses Row Level Security. Keep it secure!
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Clerk Keys

3. **CLERK_SECRET_KEY**
   - Where to get it: Clerk Dashboard → API Keys → Secret Keys
   - Example: `sk_test_...` or `sk_live_...`

### Optional Configuration

4. **PORT** (default: 3001)
   - Port for the backend server

5. **FRONTEND_URL** (optional)
   - Frontend URL for CORS configuration
   - Example: `http://localhost:3000` (development) or `https://yourdomain.com` (production)

## Local Development Setup

1. Create a `.env` file in the `backend/` directory:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and add your actual keys:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CLERK_SECRET_KEY=sk_test_your-clerk-secret-key
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

3. The `.env` file should be in `.gitignore` (never commit it!)

## Production Setup

### Railway (Backend)

1. Go to your Railway project dashboard
2. Navigate to **Variables** tab
3. Add each environment variable:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLERK_SECRET_KEY`
   - `FRONTEND_URL` (your production frontend URL)

### Vercel (Frontend)

The frontend doesn't need Supabase keys directly, but make sure:
- `NEXT_PUBLIC_API_URL` is set to your backend URL (e.g., `https://your-backend.railway.app`)

## Getting Your Supabase Keys

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
     - Example: `https://xrtldncayxumueswivfh.supabase.co`
   - **Service Role Key** (under "Project API keys", labeled as "service_role" secret) → `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ **Important**: This is NOT the publishable key (`sb_publishable_...`)
     - The Service Role Key starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (it's a JWT)
     - ⚠️ The Service Role Key is secret and has admin access. Never expose it in client-side code!

### ⚠️ Common Mistake

- ❌ **Wrong**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- ✅ **Correct**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

The `NEXT_PUBLIC_` prefix is only for frontend Next.js variables. Since Supabase is only used in the backend, you don't need the prefix. Also, you need the **Service Role Key** (secret), not the publishable key.

## Getting Your Clerk Secret Key

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to **API Keys** → **Secret Keys**
4. Copy the secret key → `CLERK_SECRET_KEY`
   - Use `sk_test_...` for development
   - Use `sk_live_...` for production

## Running the Supabase Migration

After setting up your Supabase project:

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial.sql`
3. Paste and run it in the SQL Editor
4. This will create the `boards` and `user_board_access` tables

## Verification

To verify your setup:

1. Start the backend: `cd backend && npm run dev`
2. Check the console - it should not show any Supabase connection errors
3. If you see "Missing Supabase environment variables", check that your `.env` file is in the `backend/` directory and has all required variables
