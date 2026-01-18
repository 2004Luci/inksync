"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface RenameBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  currentName: string;
}

export function RenameBoardModal({ isOpen, onClose, onConfirm, currentName }: RenameBoardModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(name.trim());
    setName("");
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
              <h2 className="text-xl font-bold text-white">Rename Board</h2>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white font-medium mb-2">
                  Board Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter board name"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl bg-(--surface) border border-(--border) focus:outline-none focus:border-(--primary) transition-colors text-white"
                  autoFocus
                />
                <p className="mt-2 text-xs text-(--text-muted)">
                  This is your personal name for this board
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer flex-1 px-4 py-2.5 bg-(--surface-hover) hover:bg-(--surface) border border-(--border) rounded-lg font-medium transition-colors text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="cursor-pointer flex-1 px-4 py-2.5 bg-(--primary) hover:bg-(--primary-hover) disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors shadow-lg shadow-(--primary)/20"
                >
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
