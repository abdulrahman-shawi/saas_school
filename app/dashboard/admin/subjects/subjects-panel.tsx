"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

interface AcademyOption {
  id: string;
  code: string;
  name: string;
}

interface SubjectItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  code: string;
  name: string;
  description: string | null;
  durationHours: number | null;
  status: "ACTIVE" | "INACTIVE";
}

interface SubjectForm {
  name: string;
  description: string;
  durationHours: string;
  status: "ACTIVE" | "INACTIVE";
}

const initialForm: SubjectForm = {
  name: "",
  description: "",
  durationHours: "",
  status: "ACTIVE",
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

/**
 * Manages academic subjects backed by Course records.
 */
export default function SubjectsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<SubjectForm>(initialForm);

  const columns = useMemo<Column<SubjectItem>[]>(() => {
    const base: Column<SubjectItem>[] = [
      { header: "كود المادة", accessor: "code" },
      { header: "اسم المادة", accessor: "name" },
      { header: "عدد الساعات", accessor: (item) => item.durationHours ?? "-" },
      { header: "الحالة", accessor: "status" },
    ];

    if (isSuperAdmin) {
      base.unshift({
        header: "الأكاديمية",
        accessor: (item) => `${item.academyName} (${item.academyCode})`,
      });
    }

    return base;
  }, [isSuperAdmin]);

  const actions = useMemo<TableAction<SubjectItem>[]>(() => [
    { label: "تعديل", onClick: (item) => startEdit(item) },
    { label: "حذف", onClick: (item) => void deleteSubject(item.id), variant: "danger" },
  ], []);

  function openCreateModal(): void {
    setEditingSubjectId(null);
    setForm(initialForm);
    setStatusMessage("");
    setIsFormModalOpen(true);
  }

  function cancelEdit(): void {
    setEditingSubjectId(null);
    setForm(initialForm);
    setIsFormModalOpen(false);
  }

  function startEdit(subject: SubjectItem): void {
    if (isSuperAdmin && subject.academyId !== selectedAcademyId) {
      setSelectedAcademyId(subject.academyId);
    }

    setEditingSubjectId(subject.id);
    setForm({
      name: subject.name,
      description: subject.description ?? "",
      durationHours: subject.durationHours ? String(subject.durationHours) : "",
      status: subject.status,
    });
    setIsFormModalOpen(true);
  }

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

  async function loadSubjects(): Promise<void> {
    setLoading(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/subjects${query}`);
      const payload = (await response.json()) as { subjects?: SubjectItem[]; message?: string };

      if (!response.ok || !payload.subjects) {
        setStatusMessage(payload.message ?? "Failed to load subjects.");
        return;
      }

      setSubjects(payload.subjects);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch subjects.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingSubjectId);
      const endpoint = isEditing ? `/api/admin/subjects/${editingSubjectId}` : "/api/admin/subjects";
      const method = isEditing ? "PATCH" : "POST";

      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy first.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyId: isSuperAdmin ? selectedAcademyId : undefined,
          name: form.name,
          description: form.description,
          durationHours: form.durationHours === "" ? null : Number(form.durationHours),
          isActive: form.status === "ACTIVE",
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Request failed.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const successMessage = isEditing ? "تم تحديث المادة." : "تم إنشاء المادة.";
      setStatusMessage(successMessage);
      showStatus(successMessage);
      setEditingSubjectId(null);
      setForm(initialForm);
      setIsFormModalOpen(false);
      await loadSubjects();
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSubject(subjectId: string): Promise<void> {
    if (!window.confirm("حذف هذه المادة؟")) {
      return;
    }

    const response = await fetch(`/api/admin/subjects/${subjectId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage("تم حذف المادة.");
    showStatus("تم حذف المادة.");
    await loadSubjects();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      void loadSubjects();
      return;
    }

    void loadSubjects();
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">إدارة المواد</h2>
          <button type="button" onClick={openCreateModal} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
            إضافة مادة
          </button>
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={cancelEdit} title={editingSubjectId ? "تعديل المادة" : "إضافة مادة"} size="lg">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">الأكاديمية</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
                <option value="">اختر الأكاديمية</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">اسم المادة</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="اسم المادة" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">عدد الساعات</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="1" placeholder="عدد الساعات" value={form.durationHours} onChange={(event) => setForm((prev) => ({ ...prev, durationHours: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الحالة</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SubjectForm["status"] }))}>
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">الوصف</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={4} placeholder="وصف المادة" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {submitting ? "جاري الحفظ..." : editingSubjectId ? "حفظ التعديلات" : "إضافة المادة"}
            </button>
            {editingSubjectId && <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">إلغاء</button>}
          </div>
        </form>
      </AppModal>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">جدول المواد</h2>
        {statusMessage && <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
        <div className="mt-4">
          <DataTable data={subjects} columns={columns} actions={actions} isLoading={loading} totalCount={subjects.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>
    </section>
  );
}
