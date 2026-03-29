import { useState, useRef } from "react";
import { askStream } from "../api";
import type { Source } from "../api";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  searchEnabled?: boolean;
  modelId?: string;
}

export function useChat(sessionId: string, setError: (msg: string | null) => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = async (willSearch: boolean, effectiveTopK: number) => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    let assistantAdded = false;

    try {
      await askStream(sessionId, text, willSearch, effectiveTopK, {
        onToken: (token) => {
          setMessages((prev) => {
            if (!assistantAdded) {
              assistantAdded = true;
              return [...prev, { role: "assistant", content: token }];
            }
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + token };
            return next;
          });
        },
        onDone: ({ sources, search_enabled, model_id }) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              sources,
              searchEnabled: search_enabled,
              modelId: model_id,
            };
            return next;
          });
        },
      });
    } catch (e: any) {
      if (assistantAdded) {
        setMessages((prev) => prev.slice(0, -1));
      }
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (idx: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return { messages, input, setInput, loading, expandedSources, bottomRef, handleSend, toggleSources };
}
