"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

type UserRole = "ACADEMY_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

interface AcademyOption {
  id: string;
  code: string;
  name: string;
}

interface UserOption {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  status: string;
}

interface MessageItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
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

interface MessageForm {
  senderUserId: string;
  receiverUserId: string;
  subject: string;
  body: string;
}

const initialForm: MessageForm = {
  senderUserId: "",
  receiverUserId: "",
  subject: "",
  body: "",
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

export default function MessagesPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<MessageForm>(initialForm);

  const columns = useMemo<Column<MessageItem>[]>(() => {
    const base: Column<MessageItem>[] = [
      { header: "المرسل", accessor: (item) => `${item.senderName} (${item.senderRole})` },
      { header: "المستلم", accessor: (item) => `${item.receiverName} (${item.receiverRole})` },
      { header: "العنوان", accessor: (item) => item.subject ?? "-" },
      { header: "النص", accessor: (item) => item.body.length > 60 ? `${item.body.slice(0, 60)}...` : item.body },
      { header: "التاريخ", accessor: (item) => new Date(item.createdAt).toLocaleString() },
    ];

    if (isSuperAdmin) {
      base.unshift({ header: "الأكاديمية", accessor: (item) => `${item.academyName} (${item.academyCode})` });
    }

    return base;
  }, [isSuperAdmin]);

  const actions = useMemo<TableAction<MessageItem>[]>(() => [
    { label: "حذف", onClick: (item) => void deleteMessage(item.id), variant: "danger" },
  ], []);

  async function loadAcademies(): Promise<void> {
    if (!isSuperAdmin) {
      return;
    }

    const response = await fetch("/api/admin/academies");
    const payload = (await response.json()) as { academies?: AcademyOption[] };
    if (response.ok && payload.academies) {
      setAcademies(payload.academies);
    }
  }

  async function loadMessages(): Promise<void> {
    setLoading(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/messages${query}`);
      const payload = (await response.json()) as { messages?: MessageItem[]; users?: UserOption[]; message?: string };

      if (!response.ok || !payload.messages || !payload.users) {
        setStatusMessage(payload.message ?? "Failed to load messages.");
        return;
      }

      setMessages(payload.messages);
      setUsers(payload.users);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch messages.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy first.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academyId: isSuperAdmin ? selectedAcademyId : undefined, ...form }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Request failed.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      setStatusMessage("Message created.");
      showStatus("Message created.");
      setForm(initialForm);
      setIsFormModalOpen(false);
      await loadMessages();
    } catch {
      setStatusMessage("Unexpected error.");
      showStatus("Unexpected error.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteMessage(messageId: string): Promise<void> {
    if (!window.confirm("Delete this message?")) {
      return;
    }

    const response = await fetch(`/api/admin/messages/${messageId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage("Message deleted.");
    showStatus("Message deleted.");
    await loadMessages();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      return;
    }

    void loadMessages();
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">الرسائل</h2>
          <button type="button" onClick={() => setIsFormModalOpen(true)} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">إرسال رسالة</button>
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title="إرسال رسالة" size="lg">
        <form className="grid gap-3" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">اختر الأكاديمية</option>
              {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>)}
            </select>
          )}
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.senderUserId} onChange={(event) => setForm((prev) => ({ ...prev, senderUserId: event.target.value }))} required>
            <option value="">اختر المرسل</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.role})</option>)}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.receiverUserId} onChange={(event) => setForm((prev) => ({ ...prev, receiverUserId: event.target.value }))} required>
            <option value="">اختر المستلم</option>
            {users.filter((item) => item.id !== form.senderUserId).map((item) => <option key={item.id} value={item.id}>{item.fullName} ({item.role})</option>)}
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="العنوان" value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2" placeholder="نص الرسالة" rows={6} value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} required />
          <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">{submitting ? "جاري الإرسال..." : "إرسال"}</button>
        </form>
      </AppModal>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">جدول الرسائل</h2>
        {statusMessage && <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
        <div className="mt-4">
          <DataTable data={messages} columns={columns} actions={actions} isLoading={loading} totalCount={messages.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>
    </section>
  );
}
