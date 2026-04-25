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

interface SubjectOption {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
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
  name: string;
  capacity: string;
}

interface ClassroomTeacherLink {
  id: string;
  classroomId: string;
  classroomCode: string;
  classroomName: string;
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  academyId: string;
  academyCode: string;
  academyName: string;
}

interface ClassroomSubjectLink {
  id: string;
  classroomId: string;
  classroomCode: string;
  classroomName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectStatus: "ACTIVE" | "INACTIVE";
  academyId: string;
  academyCode: string;
  academyName: string;
}

const initialForm: ClassroomForm = {
  academyId: "",
  name: "",
  capacity: "",
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

/**
 * Manages classrooms, teacher assignments, and subject assignments.
 */
export default function ClassroomsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<ClassroomForm>(initialForm);
  const [classroomsPage, setClassroomsPage] = useState(1);
  const [classroomTeacherLinks, setClassroomTeacherLinks] = useState<ClassroomTeacherLink[]>([]);
  const [classroomSubjectLinks, setClassroomSubjectLinks] = useState<ClassroomSubjectLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingSubjectLinks, setLoadingSubjectLinks] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [subjectLinksPage, setSubjectLinksPage] = useState(1);
  const [isAssignSubjectsModalOpen, setIsAssignSubjectsModalOpen] = useState(false);
  const [selectedSubjectClassroomId, setSelectedSubjectClassroomId] = useState<string>("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assigningSubjects, setAssigningSubjects] = useState(false);

  const classroomColumns = useMemo<Column<ClassroomItem>[]>(
    () => {
      const columns: Column<ClassroomItem>[] = [
        { header: "Code", accessor: "code" },
        { header: "Name", accessor: "name" },
        { header: "Capacity", accessor: (item) => item.capacity ?? "-" },
        {
          header: "Teachers",
          accessor: (item) => item.teachers.length > 0 ? item.teachers.map((teacher) => teacher.fullName).join("، ") : "-",
        },
        { header: "Status", accessor: (item) => (item.isActive ? "ACTIVE" : "INACTIVE") },
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

  const linkColumns = useMemo<Column<ClassroomTeacherLink>[]>(
    () => {
      const columns: Column<ClassroomTeacherLink>[] = [
        { header: "كود الصف", accessor: "classroomCode" },
        { header: "اسم الصف", accessor: "classroomName" },
        { header: "كود المدرس", accessor: "teacherCode" },
        { header: "اسم المدرس", accessor: "teacherName" },
      ];

      if (isSuperAdmin) {
        columns.unshift({
          header: "الأكاديمية",
          accessor: (item) => `${item.academyName} (${item.academyCode})`,
        });
      }

      return columns;
    },
    [isSuperAdmin],
  );

  const subjectLinkColumns = useMemo<Column<ClassroomSubjectLink>[]>(
    () => {
      const columns: Column<ClassroomSubjectLink>[] = [
        { header: "كود الصف", accessor: "classroomCode" },
        { header: "اسم الصف", accessor: "classroomName" },
        { header: "كود المادة", accessor: "subjectCode" },
        { header: "اسم المادة", accessor: "subjectName" },
        { header: "الحالة", accessor: "subjectStatus" },
      ];

      if (isSuperAdmin) {
        columns.unshift({
          header: "الأكاديمية",
          accessor: (item) => `${item.academyName} (${item.academyCode})`,
        });
      }

      return columns;
    },
    [isSuperAdmin],
  );

  const classroomActions = useMemo<TableAction<ClassroomItem>[]>(
    () => [
      { label: "Edit", onClick: (item) => startEdit(item) },
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

  function openCreateModal(): void {
    setEditingClassroomId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setStatusMessage("");
    setIsFormModalOpen(true);
  }

  async function loadAcademies(): Promise<void> {
    if (!isSuperAdmin) {
      return;
    }

    const response = await fetch("/api/admin/academies", { method: "GET" });
    const payload = (await response.json()) as { academies?: AcademyOption[] };

    if (response.ok && payload.academies) {
      setAcademies(payload.academies);
    }
  }

  async function loadClassroomTeacherLinks(): Promise<void> {
    setLoadingLinks(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/classrooms/links${query}`);
      const payload = (await response.json()) as { links?: ClassroomTeacherLink[]; message?: string };

      if (!response.ok || !payload.links) {
        setStatusMessage(payload.message ?? "Failed to load links.");
        return;
      }

      setClassroomTeacherLinks(payload.links);
    } catch {
      setStatusMessage("Could not fetch links.");
    } finally {
      setLoadingLinks(false);
    }
  }

  async function loadClassroomSubjectLinks(): Promise<void> {
    setLoadingSubjectLinks(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/classrooms/subject-links${query}`);
      const payload = (await response.json()) as { links?: ClassroomSubjectLink[]; message?: string };

      if (!response.ok || !payload.links) {
        setStatusMessage(payload.message ?? "Failed to load subject links.");
        return;
      }

      setClassroomSubjectLinks(payload.links);
      setSubjectLinksPage(1);
    } catch {
      setStatusMessage("Could not fetch classroom subject links.");
    } finally {
      setLoadingSubjectLinks(false);
    }
  }

  async function loadTeachers(): Promise<void> {
    setLoadingTeachers(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/classrooms/teachers${query}`);
      const payload = (await response.json()) as { teachers?: TeacherItem[]; message?: string };

      if (!response.ok || !payload.teachers) {
        setStatusMessage(payload.message ?? "Failed to load teachers.");
        return;
      }

      setTeachers(payload.teachers);
    } catch {
      setStatusMessage("Could not fetch teachers.");
    } finally {
      setLoadingTeachers(false);
    }
  }

  async function loadSubjects(): Promise<void> {
    setLoadingSubjects(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/subjects${query}`);
      const payload = (await response.json()) as { subjects?: SubjectOption[]; message?: string };

      if (!response.ok || !payload.subjects) {
        setStatusMessage(payload.message ?? "Failed to load subjects.");
        return;
      }

      setSubjects(payload.subjects);
    } catch {
      setStatusMessage("Could not fetch subjects.");
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function loadClassrooms(): Promise<void> {
    setLoadingClassrooms(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/classrooms${query}`);
      const payload = (await response.json()) as { classrooms?: ClassroomItem[]; message?: string };

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingClassroomId);
      const endpoint = isEditing ? `/api/admin/classrooms/${editingClassroomId}` : "/api/admin/classrooms";
      const method = isEditing ? "PATCH" : "POST";

      const body = {
        academyId: isSuperAdmin ? selectedAcademyId : undefined,
        name: form.name,
        capacity: form.capacity === "" ? null : Number(form.capacity),
        teacherIds: [],
      };

      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy before saving.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Request failed.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const successMessage = isEditing ? "Classroom updated." : "Classroom created.";
      setStatusMessage(successMessage);
      showStatus(successMessage);
      setEditingClassroomId(null);
      setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
      setIsFormModalOpen(false);
      await Promise.all([loadClassrooms(), loadClassroomTeacherLinks(), loadClassroomSubjectLinks()]);
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(classroom: ClassroomItem): void {
    setEditingClassroomId(classroom.id);

    if (isSuperAdmin && classroom.academyId !== selectedAcademyId) {
      setSelectedAcademyId(classroom.academyId);
    }

    setForm({
      academyId: classroom.academyId,
      name: classroom.name,
      capacity: classroom.capacity ? String(classroom.capacity) : "",
    });
    setIsFormModalOpen(true);
  }

  function cancelEdit(): void {
    setEditingClassroomId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setIsFormModalOpen(false);
  }

  async function deleteClassroom(classroomId: string): Promise<void> {
    const confirmed = window.confirm("Delete this classroom?");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/classrooms/${classroomId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage("Classroom deleted.");
    showStatus("Classroom deleted.");

    if (editingClassroomId === classroomId) {
      cancelEdit();
    }

    await Promise.all([loadClassrooms(), loadClassroomTeacherLinks(), loadClassroomSubjectLinks()]);
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  function openAssignModal(): void {
    setSelectedClassroomId("");
    setSelectedTeacherIds([]);
    setStatusMessage("");
    setIsAssignModalOpen(true);
  }

  function closeAssignModal(): void {
    setSelectedClassroomId("");
    setSelectedTeacherIds([]);
    setIsAssignModalOpen(false);
  }

  function openAssignSubjectsModal(): void {
    setSelectedSubjectClassroomId("");
    setSelectedSubjectIds([]);
    setStatusMessage("");
    setIsAssignSubjectsModalOpen(true);
  }

  function closeAssignSubjectsModal(): void {
    setSelectedSubjectClassroomId("");
    setSelectedSubjectIds([]);
    setIsAssignSubjectsModalOpen(false);
  }

  async function handleAssignTeacher(): Promise<void> {
    if (!selectedClassroomId || selectedTeacherIds.length === 0) {
      const message = "Please select one classroom and at least one teacher.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setAssigningTeacher(true);

    try {
      const responses = await Promise.all(
        selectedTeacherIds.map(async (teacherId) => {
          const response = await fetch("/api/admin/classrooms/assign-teacher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacherId, classroomIds: [selectedClassroomId] }),
          });

          const payload = (await response.json()) as { message?: string; count?: number };
          return { ok: response.ok, payload };
        }),
      );

      const failed = responses.find((item) => !item.ok);

      if (failed) {
        const message = failed.payload.message ?? "Failed to assign classroom.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const linkedCount = responses.reduce((sum, item) => sum + (item.payload.count ?? 0), 0);
      const successMessage = `Classroom assigned to ${selectedTeacherIds.length} teacher(s). New links: ${linkedCount}.`;
      setStatusMessage(successMessage);
      showStatus(successMessage);
      closeAssignModal();
      await loadClassroomTeacherLinks();
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setAssigningTeacher(false);
    }
  }

  async function handleAssignSubjects(): Promise<void> {
    if (!selectedSubjectClassroomId) {
      const message = "Please select one classroom first.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setAssigningSubjects(true);

    try {
      const response = await fetch("/api/admin/classrooms/assign-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroomId: selectedSubjectClassroomId,
          subjectIds: selectedSubjectIds,
        }),
      });

      const payload = (await response.json()) as { message?: string; count?: number };

      if (!response.ok) {
        const message = payload.message ?? "Failed to assign subjects.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const successMessage = `تم تحديث مواد الصف. عدد المواد الحالية: ${payload.count ?? selectedSubjectIds.length}.`;
      setStatusMessage(successMessage);
      showStatus(successMessage);
      closeAssignSubjectsModal();
      await loadClassroomSubjectLinks();
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setAssigningSubjects(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      return;
    }

    void Promise.all([loadClassrooms(), loadTeachers(), loadSubjects(), loadClassroomTeacherLinks(), loadClassroomSubjectLinks()]);
  }, [isSuperAdmin, selectedAcademyId]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      academyId: selectedAcademyId,
    }));
  }, [isSuperAdmin, selectedAcademyId]);

  useEffect(() => {
    if (!selectedSubjectClassroomId) {
      setSelectedSubjectIds([]);
      return;
    }

    const currentSubjectIds = classroomSubjectLinks
      .filter((link) => link.classroomId === selectedSubjectClassroomId)
      .map((link) => link.subjectId);

    setSelectedSubjectIds(currentSubjectIds);
  }, [selectedSubjectClassroomId, classroomSubjectLinks]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">إدارة الصفوف / القاعات</h2>
          <button type="button" onClick={openCreateModal} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
            إضافة قاعة / صف
          </button>
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={cancelEdit} title={editingClassroomId ? "تعديل القاعة / الصف" : "إضافة قاعة / صف"} size="xl">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">All academies (view only)</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>
                  {academy.name} ({academy.code})
                </option>
              ))}
            </select>
          )}

          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Classroom Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Capacity (optional)" type="number" min={1} value={form.capacity} onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))} />

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {submitting ? "Saving..." : editingClassroomId ? "حفظ التعديلات" : "إضافة القاعة"}
            </button>

            {editingClassroomId && (
              <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </AppModal>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">الصفوف / القاعات</h2>
        {statusMessage && <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}

        <div className="mt-4">
          <DataTable data={classrooms} columns={classroomColumns} actions={classroomActions} isLoading={loadingClassrooms} totalCount={classrooms.length} pageSize={8} currentPage={classroomsPage} onPageChange={setClassroomsPage} />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">ربط الصفوف مع المدرسين</h2>
          <button type="button" onClick={openAssignModal} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
            ربط صف بمدرسين
          </button>
        </div>

        <div className="mt-4">
          <DataTable data={classroomTeacherLinks} columns={linkColumns} isLoading={loadingLinks} totalCount={classroomTeacherLinks.length} pageSize={10} currentPage={1} onPageChange={() => {}} />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">ربط الصفوف مع مجموعة مواد</h2>
          <button type="button" onClick={openAssignSubjectsModal} className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white">
            ربط صف بمواد
          </button>
        </div>

        <div className="mt-4">
          <DataTable data={classroomSubjectLinks} columns={subjectLinkColumns} isLoading={loadingSubjectLinks} totalCount={classroomSubjectLinks.length} pageSize={10} currentPage={subjectLinksPage} onPageChange={setSubjectLinksPage} />
        </div>
      </div>

      <AppModal isOpen={isAssignModalOpen} onClose={closeAssignModal} title="ربط الصف بالمدرسين" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اختر الصف</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={selectedClassroomId} onChange={(event) => setSelectedClassroomId(event.target.value)}>
              <option value="">-- اختر صف --</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} ({classroom.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اختر المدرسين</label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
              {teachers.length === 0 ? (
                <p className="text-sm text-slate-500">لا يوجد مدرسون متاحون</p>
              ) : (
                teachers.map((teacher) => (
                  <label key={teacher.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.includes(teacher.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedTeacherIds((prev) => [...prev, teacher.id]);
                        } else {
                          setSelectedTeacherIds((prev) => prev.filter((id) => id !== teacher.id));
                        }
                      }}
                    />
                    <span>{teacher.fullName} ({teacher.teacherCode})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAssignTeacher} disabled={assigningTeacher} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {assigningTeacher ? "جاري الربط..." : "ربط"}
            </button>
            <button onClick={closeAssignModal} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">
              إلغاء
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal isOpen={isAssignSubjectsModalOpen} onClose={closeAssignSubjectsModal} title="ربط الصف بمجموعة مواد" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اختر الصف</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={selectedSubjectClassroomId} onChange={(event) => setSelectedSubjectClassroomId(event.target.value)}>
              <option value="">-- اختر صف --</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} ({classroom.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">اختر المواد</label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
              {loadingSubjects ? (
                <p className="text-sm text-slate-500">جاري تحميل المواد...</p>
              ) : subjects.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد مواد متاحة</p>
              ) : (
                subjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(subject.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedSubjectIds((prev) => [...prev, subject.id]);
                        } else {
                          setSelectedSubjectIds((prev) => prev.filter((id) => id !== subject.id));
                        }
                      }}
                    />
                    <span>{subject.name} ({subject.code})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAssignSubjects} disabled={assigningSubjects} className="flex-1 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {assigningSubjects ? "جاري الربط..." : "حفظ مجموعة المواد"}
            </button>
            <button onClick={closeAssignSubjectsModal} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">
              إلغاء
            </button>
          </div>
        </div>
      </AppModal>
    </section>
  );
}

