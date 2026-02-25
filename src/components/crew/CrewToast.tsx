// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: Toast["type"], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useCrewToast() {
  return useContext(ToastContext);
}

export function CrewToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast["type"] = "success", duration = 2500) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 12px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "calc(100% - 32px)",
        maxWidth: 400,
        pointerEvents: "none",
        paddingTop: 12,
      }}>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 2500);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const config = {
    success: { bg: "#16A34A", icon: "✅" },
    error: { bg: "#DC2626", icon: "❌" },
    warning: { bg: "#EA580C", icon: "⚠️" },
    info: { bg: "#1428A0", icon: "ℹ️" },
  }[toast.type];

  return (
    <div style={{
      background: config.bg,
      color: "#fff",
      padding: "14px 18px",
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      pointerEvents: "auto",
      opacity: visible && !exiting ? 1 : 0,
      transform: visible && !exiting ? "translateY(0)" : "translateY(-20px)",
      transition: "all 0.3s ease",
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{config.icon}</span>
      <span style={{ lineHeight: 1.4 }}>{toast.message}</span>
    </div>
  );
}
