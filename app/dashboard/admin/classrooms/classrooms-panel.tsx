"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

interface AcademyOption {
  id: string;
  code: string;
  name: string;
}

interface TeacherItem {
  id: string;
  academyId: string;
  academyName: string;
  academyCode: string;
  teacherCode: string;
  fullName: string;
  username: string;
  email: string | null;
  status: string;
}

interface ClassroomItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  teachers: Array<{
    teacherId: string;
    teacherCode: string;
    fullName: string;
    username: string;
  }>;
}

interface ClassroomForm {
  academyId: string;
  code: string;
  name: string;
  capacity: string;
  teacherIds: string[];
}

const initialForm: ClassroomForm = {
  academyId: "",
  code: "",
  name: "",
  capacity: "",
  teacherIds: [],
};

/**
 * Manages classrooms and teacher-classroom links.
 */
export default function ClassroomsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [form, setForm] = useState<ClassroomForm>(initialForm);
  const [classroomsPage, setClassroomsPage] = useState(1);
  const [teachersPage, setTeachersPage] = useState(1);

  const classroomColumns = useMemo<Column<ClassroomItem>[]>(
    () => {
      const columns: Column<ClassroomItem>[] = [
        { header: "Code", accessor: "code" },
        { header: "Name", accessor: "name" },
        {
          header: "Capacity",
          accessor: (item) => item.capacity ?? "-",
        },
        {
          header: "Teachers",
          accessor: (item) =>
            item.teachers.length > 0
              ? item.teachers.map((teacher) => teacher.fullName).join("، ")
              : "-",
        },
        {
          header: "Status",
          accessor: (item) => (item.isActive ? "ACTIVE" : "INACTIVE"),
        },
      ];

      if (isSuperAdmin) {
        columns.unshift({
          header: "Academy",
          accessor: (item) => `${item.academyName} (${item.academyCode})`,
        });
      }

      return columns;
    },
    [isSuperAdmin],
  );

  const teacherColumns = useMemo<Column<TeacherItem>[]>(
    () => {
      const columns: Column<TeacherItem>[] = [
        { header: "Teacher Code", accessor: "teacherCode" },
        { header: "Full Name", accessor: "fullName" },
        { header: "Username", accessor: "username" },
        { header: "Status", accessor: "status" },
      ];

      if (isSuperAdmin) {
        columns.unshift({
          header: "Academy",
          accessor: (item) => `${item.academyName} (${item.academyCode})`,
        });
      }

      return columns;
    },
    [isSuperAdmin],
  );

  const classroomActions = useMemo<TableAction<ClassroomItem>[]>(
    () => [
      {
        label: "Edit",
        onClick: (item) => startEdit(item),
      },
      {
        label: "Delete",
        onClick: (item) => {
          void deleteClassroom(item.id);
        },
        variant: "danger",
      },
    ],
    [],
  );

  /**
   * Loads academy options for super admin target selection.
   */
  async function loadAcademies(): Promise<void> {
    if (!isSuperAdmin) {
      return;
    }

    const response = await fetch("/api/admin/academies", { method: "GET" });
    const payload = (await response.json()) as {
      academies?: Array<{ id: string; code: string; name: string }>;
    };

    if (response.ok && payload.academies) {
      setAcademies(payload.academies);

      if (!selectedAcademyId && payload.academies.length > 0) {
        setSelectedAcademyId(payload.academies[0].id);
      }
    }
  }

  /**
   * Loads teachers by scope (academy-only for normal admin, selectable for super admin).
   */
  async function loadTeachers(): Promise<void> {
    setLoadingTeachers(true);

    try {
      const query = isSuperAdmin && selectedAcademyId
        ? `?academyId=${selectedAcademyId}`
        : "";
      const response = await fetch(`/api/admin/classrooms/teachers${query}`);
      const payload = (await response.json()) as { teachers?: TeacherItem[]; message?: string };

      if (!response.ok || !payload.teachers) {
        setStatusMessage(payload.message ?? "Failed to load teachers.");
        return;
      }

      setTeachers(payload.teachers);
      setTeachersPage(1);
    } catch {
      setStatusMessage("Could not fetch teachers.");
    } finally {
      setLoadingTeachers(false);
    }
  }

  /**
   * Loads classrooms by scope.
   */
  async function loadClassrooms(): Promise<void> {
    setLoadingClassrooms(true);

    try {
      const query = isSuperAdmin && selectedAcademyId
        ? `?academyId=${selectedAcademyId}`
        : "";
      const response = await fetch(`/api/admin/classrooms${query}`);
      const payload = (await response.json()) as {
        classrooms?: ClassroomItem[];
        message?: string;
      };

      if (!response.ok || !payload.classrooms) {
        setStatusMessage(payload.message ?? "Failed to load classrooms.");
        return;
      }

      setClassrooms(payload.classrooms);
      setClassroomsPage(1);
    } catch {
      setStatusMessage("Could not fetch classrooms.");
    } finally {
      setLoadingClassrooms(false);
    }
  }

  /**
   * Handles create or update classroom submit action.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingClassroomId);
      const endpoint = isEditing
        ? `/api/admin/classrooms/${editingClassroomId}`
        : "/api/admin/classrooms";
      const method = isEditing ? "PATCH" : "POST";

      const body = {
        academyId: isSuperAdmin ? selectedAcademyId : undefined,
        code: form.code,
        name: form.name,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        teacherIds: form.teacherIds,
      };

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatusMessage(payload.message ?? "Request failed.");
        return;
      }

      setStatusMessage(isEditing ? "Classroom updated." : "Classroom created.");
      setEditingClassroomId(null);
      setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
      await Promise.all([loadClassrooms(), loadTeachers()]);
    } catch {
      setStatusMessage("Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Starts classroom edit mode and loads current data into form.
   */
  function startEdit(classroom: ClassroomItem): void {
    setEditingClassroomId(classroom.id);

    if (isSuperAdmin && classroom.academyId !== selectedAcademyId) {
      setSelectedAcademyId(classroom.academyId);
    }

    setForm({
      academyId: classroom.academyId,
      code: classroom.code,
      name: classroom.name,
      capacity: classroom.capacity ? String(classroom.capacity) : "",
      teacherIds: classroom.teachers.map((teacher) => teacher.teacherId),
    });
  }

  /**
   * Exits edit mode and resets classroom form.
   */
  function cancelEdit(): void {
    setEditingClassroomId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setStatusMessage("");
  }

  /**
   * Deletes classroom and refreshes list.
   */
  async function deleteClassroom(classroomId: string): Promise<void> {
    const confirmed = window.confirm("Delete this classroom?");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/classrooms/${classroomId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setStatusMessage(payload.message ?? "Delete failed.");
      return;
    }

    setStatusMessage("Classroom deleted.");

    if (editingClassroomId === classroomId) {
      cancelEdit();
    }

    await loadClassrooms();
  }

  /**
   * Toggles teacher selection in classroom form.
   */
  function toggleTeacher(teacherId: string): void {
    setForm((prev) => {
      const isSelected = prev.teacherIds.includes(teacherId);
      return {
        ...prev,
        teacherIds: isSelected
          ? prev.teacherIds.filter((id) => id !== teacherId)
          : [...prev.teacherIds, teacherId],
      };
    });
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      return;
    }

    void Promise.all([loadClassrooms(), loadTeachers()]);
  }, [isSuperAdmin, selectedAcademyId]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      academyId: selectedAcademyId,
      teacherIds: [],
    }));
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">
          {editingClassroomId ? "تعديل القاعة / الصف" : "إضافة قاعة / صف"}
        </h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
              value={selectedAcademyId}
              onChange={(event) => setSelectedAcademyId(event.target.value)}
              required
            >
              {academies.length === 0 && <option value="">Select academy</option>}
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>
                  {academy.name} ({academy.code})
                </option>
              ))}
            </select>
          )}

          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Classroom Code"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Classroom Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
            placeholder="Capacity (optional)"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
          />

          <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Assign Teachers</p>
            {teachers.length === 0 ? (
              <p className="text-sm text-slate-500">No teachers available for selected academy.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {teachers.map((teacher) => (
                  <label key={teacher.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.teacherIds.includes(teacher.id)}
                      onChange={() => toggleTeacher(teacher.id)}
                    />
                    <span>
                      {teacher.fullName} ({teacher.teacherCode})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {submitting
                ? "Saving..."
                : editingClassroomId
                  ? "حفظ التعديلات"
                  : "إضافة القاعة"}
            </button>

            {editingClassroomId && (
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
        <h2 className="text-xl font-semibold text-slate-900">الصفوف / القاعات</h2>
        {statusMessage && (
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
            {statusMessage}
          </p>
        )}

        <div className="mt-4">
          <DataTable
            data={classrooms}
            columns={classroomColumns}
            actions={classroomActions}
            isLoading={loadingClassrooms}
            totalCount={classrooms.length}
            pageSize={8}
            currentPage={classroomsPage}
            onPageChange={setClassroomsPage}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">المدرسين</h2>

        <div className="mt-4">
          <DataTable
            data={teachers}
            columns={teacherColumns}
            isLoading={loadingTeachers}
            totalCount={teachers.length}
            pageSize={8}
            currentPage={teachersPage}
            onPageChange={setTeachersPage}
          />
        </div>
      </div>
    </section>
  );
}
