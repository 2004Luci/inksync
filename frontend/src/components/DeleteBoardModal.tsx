"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface DeleteBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (permanent: boolean) => void;
  boardName: string;
}

export function DeleteBoardModal({ isOpen, onClose, onConfirm, boardName }: DeleteBoardModalProps) {
  const [permanent, setPermanent] = useState(false);

  const handleConfirm = () => {
    onConfirm(permanent);
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-(--background) border border-(--border) rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Delete Board</h2>
              </div>
              <button
                onClick={onClose}
                className="text-(--text-muted) hover:text-white transition-colors cursor-pointer p-1 hover:bg-(--surface-hover) rounded-lg"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-(--text-muted) mb-4 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-white">&ldquo;{boardName}&rdquo;</span> from your dashboard?
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-red-300 leading-relaxed">
                    This will remove the board from your dashboard. The board will still be accessible via its room code.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permanent}
                  onChange={(e) => setPermanent(e.target.checked)}
                  className="w-4 h-4 rounded border-(--border) bg-(--surface) text-(--primary) focus:ring-(--primary)"
                />
                <span className="text-sm text-(--text-muted)">
                  Permanently delete this board (cannot be undone)
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="cursor-pointer flex-1 px-4 py-2.5 bg-(--surface-hover) hover:bg-(--surface) border border-(--border) rounded-lg font-medium transition-colors text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="cursor-pointer flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-red-500/20"
              >
                {permanent ? "Delete Permanently" : "Remove from Dashboard"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
