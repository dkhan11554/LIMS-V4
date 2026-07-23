/**
 * Floating AI Help Widget — visible to ALL authenticated users.
 * Appears as a pulsing button in the bottom-right corner of every page.
 * Opens a compact chat panel powered by the systemHelpQuery AI action.
 */
import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useRole } from "@/hooks/use-role.ts";
import {
  Bot, Send, X, Minimize2, MessageCircleQuestion,
  Sparkles, RotateCcw
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Msg = { role: "user" | "assistant"; content: string; ts: number };

// ─── Quick-help prompts tailored to common tasks ──────────────────────────────

const QUICK_PROMPTS = [
  "How do I register a sample?",
  "How do I enter test results?",
  "How do I create an invoice?",
  "What does each sample status mean?",
  "How do I assign tests to analysts?",
  "How do I generate a COA?",
  "How do I change a user's role?",
  "What can I do in my role?",
];

// ─── Single message bubble ────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2 text-sm", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-gradient-to-br from-teal-400 to-blue-500 text-white"
      )}>
        {isUser ? "U" : <Bot size={11} />}
      </div>
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-wrap text-xs",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted text-foreground rounded-tl-sm"
      )}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shrink-0">
        <Bot size={11} className="text-white" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.7, delay: i * 0.12, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function AiHelpWidget() {
  const { role } = useRole();
  const askAi = useAction(api.ai.systemHelpQuery);

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I'm your LIMS Help Assistant. Ask me anything about using the system — how to register samples, enter results, create invoices, manage quality, and more.",
      ts: Date.now(),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimised]);

  useEffect(() => {
    if (open && !minimised) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, minimised]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: q, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const historyForApi = updated.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const { answer } = await askAi({
        question: q,
        historyJson: JSON.stringify(historyForApi),
        userRole: role,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: answer, ts: Date.now() }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const friendly = msg.includes("insufficient") || msg.includes("403")
        ? "AI credits are insufficient. Please top up your Hercules Cloud balance in Settings → Billing."
        : "Sorry, I couldn't get a response right now. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: friendly, ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([{
      role: "assistant",
      content: "Hi! I'm your LIMS Help Assistant. Ask me anything about using the system.",
      ts: Date.now(),
    }]);
    setInput("");
  }

  const unread = !open && messages.length > 1 && messages[messages.length - 1].role === "assistant";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-[340px] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: minimised ? "auto" : "520px" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-teal-500 text-white shrink-0">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">LIMS Help Assistant</p>
                <p className="text-[10px] opacity-75 leading-tight flex items-center gap-1">
                  <Sparkles size={9} />Powered by AI
                </p>
              </div>
              <button onClick={reset} className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer" title="New conversation">
                <RotateCcw size={13} />
              </button>
              <button onClick={() => setMinimised(!minimised)} className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer" title={minimised ? "Expand" : "Minimise"}>
                <Minimize2 size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 transition-colors cursor-pointer" title="Close">
                <X size={14} />
              </button>
            </div>

            {/* Body — hidden when minimised */}
            {!minimised && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                  {messages.map((m, i) => <Bubble key={i} msg={m} />)}
                  {loading && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>

                {/* Quick prompts — only show when no conversation started */}
                {messages.length === 1 && !loading && (
                  <div className="px-3 pb-2">
                    <p className="text-[10px] text-muted-foreground mb-1.5">Quick questions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-[10px] px-2 py-1 rounded-full border bg-background hover:bg-muted hover:border-primary/40 transition-colors cursor-pointer leading-tight"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="border-t p-2 flex gap-2 shrink-0">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Ask how to use the system…"
                    rows={2}
                    disabled={loading}
                    className="flex-1 resize-none text-xs rounded-xl border bg-muted/40 px-3 py-2 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <Button
                    size="icon"
                    className="self-end h-8 w-8 shrink-0"
                    disabled={!input.trim() || loading}
                    onClick={() => void send()}
                  >
                    {loading ? <Spinner className="size-3" /> : <Send size={13} />}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <motion.button
        onClick={() => { setOpen(!open); setMinimised(false); }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-teal-500 text-white shadow-lg flex items-center justify-center cursor-pointer"
        title="Ask AI for help"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X size={22} />
              </motion.div>
            : <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <MessageCircleQuestion size={22} />
              </motion.div>
          }
        </AnimatePresence>
        {/* Pulse ring */}
        {!open && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/50"
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {/* Unread dot */}
        {unread && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
