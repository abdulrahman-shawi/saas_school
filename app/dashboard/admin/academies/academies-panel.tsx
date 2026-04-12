"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";

interface AcademyItem {
  id: string;
  code: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AcademyForm {
  code: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

const initialForm: AcademyForm = {
  code: "",
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
};

/**
 * Renders academy CRUD panel for add/edit/delete and listing.
 */
export default function AcademiesPanel() {
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState<AcademyForm>(initialForm);
  const [editingAcademyId, setEditingAcademyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const columns = useMemo<Column<AcademyItem>[]>(
    () => [
      { header: "Code", accessor: "code" },
      { header: "Name", accessor: "name" },
      { header: "Username", accessor: "username" },
      { header: "Email", accessor: (item) => item.email ?? "-" },
      { header: "Phone", accessor: (item) => item.phone ?? "-" },
      {
        header: "Status",
        accessor: (item) => (item.isActive ? "ACTIVE" : "INACTIVE"),
      },
    ],
    [],
  );

  const actions = useMemo<TableAction<AcademyItem>[]>(
    () => [
      {
        label: "Edit",
        onClick: (item) => startEdit(item),
      },
      {
        label: "Delete",
        onClick: (item) => {
          void deleteAcademy(item.id);
        },
        variant: "danger",
      },
    ],
    [],
  );

  /**
   * Loads academies list from backend API.
   */
  async function loadAcademies(): Promise<void> {
    setLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/academies", { method: "GET" });
      const payload = (await response.json()) as {
        academies?: AcademyItem[];
        message?: string;
      };

      if (!response.ok || !payload.academies) {
        setStatusMessage(payload.message ?? "Failed to load academies.");
        return;
      }

      setAcademies(payload.academies);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch academies.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handles create or update action based on editing state.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingAcademyId);
      const url = isEditing
        ? `/api/admin/academies/${editingAcademyId}`
        : "/api/admin/academies";
      const method = isEditing ? "PATCH" : "POST";

      const body = isEditing
        ? {
            code: form.code,
            name: form.name,
            username: form.username,
            email: form.email,
            phone: form.phone,
            password: form.password,
          }
        : form;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatusMessage(payload.message ?? "Request failed.");
        return;
      }

      setStatusMessage(isEditing ? "Academy updated." : "Academy created.");
      setForm(initialForm);
      setEditingAcademyId(null);
      await loadAcademies();
    } catch {
      setStatusMessage("Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Loads selected academy data into form for editing.
   */
  function startEdit(academy: AcademyItem): void {
    setEditingAcademyId(academy.id);
    setForm({
      code: academy.code,
      name: academy.name,
      username: academy.username,
      email: academy.email ?? "",
      phone: academy.phone ?? "",
      password: "",
    });
    setStatusMessage("Editing academy. Leave password empty to keep current password.");
  }

  /**
   * Clears form and exits edit mode.
   */
  function cancelEdit(): void {
    setEditingAcademyId(null);
    setForm(initialForm);
    setStatusMessage("");
  }

  /**
   * Deletes academy by id and refreshes table.
   */
  async function deleteAcademy(academyId: string): Promise<void> {
    const confirmed = window.confirm("Delete this academy permanently?");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/academies/${academyId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setStatusMessage(payload.message ?? "Delete failed.");
      return;
    }

    setStatusMessage("Academy deleted.");

    if (editingAcademyId === academyId) {
      cancelEdit();
    }

    await loadAcademies();
  }

  useEffect(() => {
    void loadAcademies();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">
          {editingAcademyId ? "تعديل الأكاديمية" : "إضافة أكاديمية"}
        </h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="رمز الأكاديمية (مثال: demo-academy)"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="اسم الأكاديمية"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Username الأدمن"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="البريد الإلكتروني"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="رقم الهاتف"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
            placeholder={editingAcademyId ? "كلمة سر جديدة (اختياري)" : "كلمة السر"}
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required={!editingAcademyId}
          />

          <div className="flex items-center gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {submitting
                ? "Saving..."
                : editingAcademyId
                  ? "حفظ التعديلات"
                  : "إضافة الأكاديمية"}
            </button>

            {editingAcademyId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700"
              >
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">عرض الأكاديميات</h2>

        {statusMessage && (
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
            {statusMessage}
          </p>
        )}

        <div className="mt-4">
          <DataTable
            data={academies}
            columns={columns}
            actions={actions}
            isLoading={loading}
            totalCount={academies.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </section>
  );
}
