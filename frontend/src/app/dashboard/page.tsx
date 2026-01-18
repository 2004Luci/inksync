"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { getUserBoards, createBoard, removeBoardFromDashboard, deleteBoard, updateBoardName, type Board } from "@/lib/api";
import { BoardCard } from "@/components/BoardCard";
import { CreateBoardModal } from "@/components/CreateBoardModal";
import { DeleteBoardModal } from "@/components/DeleteBoardModal";
import { RenameBoardModal } from "@/components/RenameBoardModal";

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);
  const [renameTarget, setRenameTarget] = useState<Board | null>(null);

  // Redirect if not signed in
  useEffect(() => {
    if (!isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  // Load boards
  useEffect(() => {
    if (!isSignedIn) return;

    const loadBoards = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        if (!token) {
          setError("Authentication required - no token");
          setIsLoading(false);
          return;
        }
        console.log("Fetching boards with token (first 20 chars):", token.substring(0, 20) + "...");
        const userBoards = await getUserBoards(token);
        console.log("Received boards:", userBoards);
        setBoards(userBoards);
      } catch (err) {
        console.error("Error loading boards:", err);
        setError(err instanceof Error ? err.message : "Failed to load boards");
      } finally {
        setIsLoading(false);
      }
    };

    loadBoards();
  }, [isSignedIn, getToken]);

  const handleCreateBoard = async (name?: string) => {
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }
      const newBoard = await createBoard(token, name);
      setBoards((prev) => [newBoard, ...prev]);
      setShowCreateModal(false);
      // Navigate to the new board
      router.push(`/room/${newBoard.roomId}`);
    } catch (err) {
      console.error("Error creating board:", err);
      setError(err instanceof Error ? err.message : "Failed to create board");
    }
  };

  const handleDeleteBoard = async (board: Board, permanent: boolean = false) => {
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }
      if (permanent) {
        await deleteBoard(token, board.roomId);
      } else {
        await removeBoardFromDashboard(token, board.roomId);
      }
      setBoards((prev) => prev.filter((b) => b.roomId !== board.roomId));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting board:", err);
      setError(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  const handleRenameBoard = async (board: Board, customName: string) => {
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }
      await updateBoardName(token, board.roomId, customName);
      setBoards((prev) =>
        prev.map((b) => (b.roomId === board.roomId ? { ...b, customName } : b))
      );
      setRenameTarget(null);
    } catch (err) {
      console.error("Error renaming board:", err);
      setError(err instanceof Error ? err.message : "Failed to rename board");
    }
  };

  const handleOpenBoard = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const handleCopyLink = (roomId: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).catch((err) => {
      console.error('Failed to copy link:', err);
    });
    // You could add a toast notification here
  };

  if (!isSignedIn) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-(--background) flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-(--border) bg-(--surface) flex items-center justify-between px-4 shrink-0"
      >
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-(--primary) to-(--accent) flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-sm">InkSync</h1>
            <div className="text-xs text-(--text-muted)">Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1.5 text-sm bg-(--surface-hover) hover:bg-(--primary) hover:text-black border border-(--border) rounded-lg transition-colors"
          >
            Home
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm bg-(--primary) hover:bg-(--primary-hover) text-black font-medium rounded-lg transition-colors"
          >
            Create Board
          </button>
          <div className="flex items-center gap-2 text-sm text-(--text-muted) border-l border-(--border) pl-3">
            <span>{user?.firstName || user?.username || "User"}</span>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-(--text-muted)">Loading boards...</div>
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-(--surface-hover) flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-(--text-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No boards yet</h2>
              <p className="text-(--text-muted) mb-6">Create your first whiteboard to get started</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-(--primary) hover:bg-(--primary-hover) text-black font-medium rounded-lg transition-colors"
              >
                Create Board
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {boards.map((board) => (
                <BoardCard
                  key={board.roomId}
                  board={board}
                  onOpen={() => handleOpenBoard(board.roomId)}
                  onRename={() => setRenameTarget(board)}
                  onDelete={() => setDeleteTarget(board)}
                  onCopyLink={() => handleCopyLink(board.roomId)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateBoardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateBoard}
      />

      {deleteTarget && (
        <DeleteBoardModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={(permanent) => handleDeleteBoard(deleteTarget, permanent)}
          boardName={deleteTarget.customName || deleteTarget.name || deleteTarget.roomId}
        />
      )}

      {renameTarget && (
        <RenameBoardModal
          isOpen={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          onConfirm={(name) => handleRenameBoard(renameTarget, name)}
          currentName={renameTarget.customName || renameTarget.name || ""}
        />
      )}
    </div>
  );
}
