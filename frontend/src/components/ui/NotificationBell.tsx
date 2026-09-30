import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2, Sparkles, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "drift" | "sync" | "system" | "analysis";
}

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    title: "Interest Drift Detected",
    message: "Significant increase in Machine Learning & AI attention over the last 30 days.",
    timestamp: "10m ago",
    read: false,
    type: "drift",
  },
  {
    id: "notif-2",
    title: "Analysis Ready",
    message: "Semantic clusters and UMAP projection generated from your history.",
    timestamp: "1h ago",
    read: false,
    type: "analysis",
  },
  {
    id: "notif-3",
    title: "Spotify Synchronized",
    message: "Recent listening history integrated into your drift timeline.",
    timestamp: "1d ago",
    read: true,
    type: "sync",
  },
];

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem("drifter_notifications");
      return stored ? JSON.parse(stored) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("drifter_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const getIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "drift":
        return <TrendingUp size={14} className="text-amber-400" />;
      case "analysis":
        return <Sparkles size={14} className="text-purple-400" />;
      case "sync":
        return <RefreshCw size={14} className="text-emerald-400" />;
      default:
        return <AlertCircle size={14} className="text-blue-400" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-[#050505]">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-white text-[11px] flex items-center gap-1"
                  title="Mark all as read"
                >
                  <Check size={12} />
                  <span className="text-[10px]">Read all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="rounded-lg p-1 text-white/40 hover:bg-white/[0.06] hover:text-rose-400"
                  title="Clear all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-white/30">
                No notifications right now
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => toggleRead(n.id)}
                  className={`group flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-white/[0.03] ${
                    !n.read ? "bg-white/[0.02]" : "opacity-60"
                  }`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium text-white truncate">{n.title}</p>
                      <span className="text-[10px] text-white/30 shrink-0">{n.timestamp}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-white/50">{n.message}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
