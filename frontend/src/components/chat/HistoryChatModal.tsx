import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Sparkles,
  X,
  User,
  Flame,
  Moon,
  Compass,
  TrendingUp,
  Brain,
  Trash2,
} from "lucide-react";
import { chatWithHistory, type ChatResponse } from "@/services/analytics";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  topics?: string[];
  suggestedQueries?: string[];
  timestamp: string;
}

interface HistoryChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  source?: string;
}

const QUICK_PROMPTS = [
  { icon: <Flame size={12} className="text-amber-400" />, text: "What was my biggest obsession?" },
  { icon: <Moon size={12} className="text-purple-400" />, text: "Show my late-night rabbit holes" },
  { icon: <Compass size={12} className="text-emerald-400" />, text: "What topics are rising right now?" },
  { icon: <TrendingUp size={12} className="text-cyan-400" />, text: "How did my interests change over time?" },
  { icon: <Brain size={12} className="text-rose-400" />, text: "Predict what I'll explore next" },
];

export default function HistoryChatModal({
  isOpen,
  onClose,
  source,
}: HistoryChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm **Drifter AI** — your personal interest archaeologist. Ask me anything about your obsessions, late-night rabbit holes, or how your attention has shifted over time.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestedQueries: [
        "What was my biggest obsession?",
        "Show my late-night rabbit holes",
        "What topics are rising right now?",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Animated typing dots
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setDotCount((d) => (d % 3) + 1), 400);
    return () => clearInterval(interval);
  }, [loading]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: "welcome-" + Date.now(),
        role: "assistant",
        content: "Chat cleared. What would you like to explore?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedQueries: ["What was my biggest obsession?", "Show my late-night rabbit holes"],
      },
    ]);
  }, []);

  if (!isOpen) return null;

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const historyContext = messages.map((m) => ({ role: m.role, content: m.content }));
      const res: ChatResponse = await chatWithHistory(query, historyContext, source);

      const aiMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        topics: res.referenced_topics,
        suggestedQueries: res.suggested_queries,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Something went wrong reaching your history engine. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderContent(content: string) {
    return content.split("\n").map((line, idx) => {
      let html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded text-amber-200 font-mono text-[10px]">$1</code>');
      return (
        <span key={idx} className="block" dangerouslySetInnerHTML={{ __html: html }} />
      );
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl h-[88vh] max-h-[800px] bg-[#09090c] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-white/[0.015]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 via-rose-500/15 to-purple-500/20 border border-white/10 text-amber-300">
              <Bot size={17} />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#09090c]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white">Ask Drifter</h2>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-white/35">AI over your personal interest universe</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              title="Clear chat"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-rose-400 hover:bg-white/[0.04] transition"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 hover:text-white hover:bg-white/[0.06] transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* CHAT LOG */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {messages.map((m, mIdx) => (
            <div
              key={m.id}
              className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${mIdx * 20}ms` }}
            >
              {m.role === "assistant" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-amber-300 mt-0.5">
                  <Bot size={12} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-amber-500/12 border border-amber-500/25 text-amber-50 rounded-tr-sm"
                    : "bg-white/[0.04] border border-white/[0.07] text-white/85 rounded-tl-sm"
                }`}
              >
                <div className="space-y-0.5">{renderContent(m.content)}</div>

                {m.topics && m.topics.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/[0.07] flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-white/25 font-mono uppercase tracking-wider">refs:</span>
                    {m.topics.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-medium truncate max-w-[120px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {m.suggestedQueries && m.suggestedQueries.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.07] space-y-1.5">
                    <p className="text-[10px] text-white/25 font-mono uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={9} /> Suggested
                    </p>
                    <div className="flex flex-col gap-1">
                      {m.suggestedQueries.slice(0, 3).map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSend(q)}
                          disabled={loading}
                          className="rounded-lg bg-white/[0.04] hover:bg-amber-500/10 border border-white/[0.08] hover:border-amber-500/30 px-2.5 py-1.5 text-[10px] text-white/55 hover:text-amber-200 transition text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-1.5 text-[9px] text-white/20 text-right font-mono">{m.timestamp}</div>
              </div>

              {m.role === "user" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300 mt-0.5">
                  <User size={12} />
                </div>
              )}
            </div>
          ))}

          {/* TYPING INDICATOR */}
          {loading && (
            <div className="flex gap-2.5 justify-start animate-in fade-in duration-200">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-amber-300">
                <Bot size={12} />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-amber-400"
                    style={{
                      opacity: dotCount > i ? 1 : 0.2,
                      transform: dotCount > i ? "scale(1.2)" : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK PROMPTS */}
        {messages.length <= 2 && !loading && (
          <div className="px-4 py-2 border-t border-white/[0.05] bg-black/20 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[9px] uppercase tracking-wider text-white/20 shrink-0 font-mono">Try:</span>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.text}
                onClick={() => handleSend(p.text)}
                className="flex items-center gap-1.5 shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] px-3 py-1 text-[10px] text-white/55 hover:text-white transition"
              >
                {p.icon}
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div className="p-3 sm:p-4 border-t border-white/[0.07] bg-[#09090c]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.025] px-4 py-2.5 focus-within:border-amber-400/50 focus-within:ring-1 focus-within:ring-amber-400/20 transition"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your obsessions, rabbit holes, or interest shifts..."
              disabled={loading}
              className="flex-1 bg-transparent text-xs text-white placeholder-white/25 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-black transition shrink-0"
              title="Send"
            >
              <Send size={13} />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[9px] text-white/15 font-mono">
            Responses are generated from your personal activity data · No external AI required
          </p>
        </div>
      </div>
    </div>
  );
}
