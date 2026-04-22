"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AppModal } from "@/components/ui/app-modal";

type UserRole = "ACADEMY_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

interface MessageItem {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: UserRole;
  receiverUserId: string;
  receiverName: string;
  receiverRole: UserRole;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  peerUserId: string;
  peerName: string;
  academyId?: string;
}

/**
 * Reusable chat modal for one-to-one conversation.
 */
export function ChatModal({
  isOpen,
  onClose,
  currentUserId,
  peerUserId,
  peerName,
  academyId,
}: ChatModalProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const canLoadConversation = Boolean(currentUserId && peerUserId);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  /**
   * Auto-scrolls to bottom after message list updates.
   */
  function scrollToBottom(): void {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  /**
   * Loads current conversation messages with selected peer.
   */
  async function loadConversation(): Promise<void> {
    if (!canLoadConversation) {
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ peerUserId });

      if (academyId) {
        params.set("academyId", academyId);
      }

      const response = await fetch(`/api/admin/messages?${params.toString()}`);
      const payload = (await response.json()) as { messages?: MessageItem[]; message?: string };

      if (!response.ok || !payload.messages) {
        toast.error(payload.message ?? "Failed to load conversation.");
        return;
      }

      setMessages(payload.messages);
    } catch {
      toast.error("Could not fetch conversation.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sends a new message to current peer and refreshes thread.
   */
  async function handleSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    if (!canLoadConversation) {
      toast.error("Invalid conversation participants.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyId,
          senderUserId: currentUserId,
          receiverUserId: peerUserId,
          body: text,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        toast.error(payload.message ?? "Failed to send message.");
        return;
      }

      setDraft("");
      await loadConversation();
    } catch {
      toast.error("Unexpected error while sending.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadConversation();
  }, [isOpen, peerUserId, academyId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollToBottom();
  }, [orderedMessages, isOpen]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={peerName ? `المحادثة مع ${peerName}` : "المحادثة"}
      size="lg"
    >
      <div className="flex h-[60vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {loading ? (
            <p className="text-sm text-slate-500">جاري تحميل المحادثة...</p>
          ) : orderedMessages.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد رسائل بعد. ابدأ المحادثة الآن.</p>
          ) : (
            orderedMessages.map((message) => {
              const isMine = message.senderUserId === currentUserId;

              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isMine
                      ? "mr-auto bg-emerald-600 text-white"
                      : "ml-auto bg-white text-slate-800 border border-slate-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className={`mt-1 text-[11px] ${isMine ? "text-emerald-100" : "text-slate-500"}`}>
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
        </div>

        <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            placeholder="اكتب رسالتك هنا..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {sending ? "جاري الإرسال..." : "إرسال"}
          </button>
        </form>
      </div>
    </AppModal>
  );
}