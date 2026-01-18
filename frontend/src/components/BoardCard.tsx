"use client";

import { motion } from "framer-motion";
import { Board } from "@/lib/api";

interface BoardCardProps {
  board: Board;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}

export function BoardCard({ board, onOpen, onRename, onDelete, onCopyLink }: BoardCardProps) {
  const displayName = board.customName || board.name || `Board ${board.roomId.slice(0, 6)}`;
  const lastAccessed = board.lastAccessedAt ? new Date(board.lastAccessedAt) : null;
  const lastActivity = board.lastActivityAt ? new Date(board.lastActivityAt) : null;

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-xl border border-(--border) bg-(--surface)/50 backdrop-blur-sm hover:bg-(--surface-hover)/70 transition-all cursor-pointer overflow-hidden"
      onClick={onOpen}
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-linear-to-br from-(--surface-hover) to-(--surface) flex items-center justify-center">
        <svg className="w-12 h-12 text-(--text-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white mb-1 truncate">{displayName}</h3>
        <div className="text-xs text-(--text-muted) space-y-1">
          {lastAccessed && <div>Opened {formatDate(lastAccessed)}</div>}
          {lastActivity && <div>Updated {formatDate(lastActivity)}</div>}
          <div className="font-mono text-[10px] opacity-70">{board.roomId}</div>
        </div>
      </div>

      {/* Actions (shown on hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyLink();
          }}
          className="w-7 h-7 rounded-lg bg-(--surface) hover:bg-(--primary) hover:text-black border border-(--border) flex items-center justify-center transition-colors"
          title="Copy link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="w-7 h-7 rounded-lg bg-(--surface) hover:bg-(--primary) hover:text-black border border-(--border) flex items-center justify-center transition-colors"
          title="Rename"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-7 h-7 rounded-lg bg-(--surface) hover:bg-red-500/20 hover:text-red-400 border border-(--border) flex items-center justify-center transition-colors"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
