"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Weekday } from "@prisma/client";
import toast from "react-hot-toast";
import { CalendarClock, Plus } from "lucide-react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";
import { WEEKDAY_LABELS, WEEKDAY_OPTIONS } from "@/lib/timetable";

interface AcademyOption {
  id: string;
  code: string;
  name: string;
}

interface ClassroomOption {
  id: string;
  code: string;
  name: string;
}

interface TeacherOption {
  id: string;
  teacherCode: string;
  fullName: string;
}

interface SubjectLinkOption {
  classroomId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

interface TimetableSlotItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  classroomId: string;
  classroomCode: string;
  classroomName: string;
  courseId: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  teacherCode: string | null;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
  notes: string | null;
  isActive: boolean;
}

interface TimetableForm {
  classroomId: string;
  courseId: string;
  teacherId: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  roomLabel: string;
  notes: string;
  isActive: boolean;
}

const initialForm: TimetableForm = {
  classroomId: "",
  courseId: "",
  teacherId: "",
  dayOfWeek: Weekday.SUNDAY,
  startTime: "08:00",
  endTime: "09:00",
  roomLabel: "",
  notes: "",
  isActive: true,
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

export default function TimetablePanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjectLinks, setSubjectLinks] = useState<SubjectLinkOption[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [slots, setSlots] = useState<TimetableSlotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<TimetableForm>(initialForm);

  const filterSubjects = useMemo(() => {
    if (!selectedClassroomId) {
      return subjectLinks;
    }

    return subjectLinks.filter((link) => link.classroomId === selectedClassroomId);
  }, [selectedClassroomId, subjectLinks]);

  const formSubjects = useMemo(() => {
    if (!form.classroomId) {
      return [] as SubjectLinkOption[];
    }

    return subjectLinks.filter((link) => link.classroomId === form.classroomId);
  }, [form.classroomId, subjectLinks]);

  const groupedSlots = useMemo(() => {
    return WEEKDAY_OPTIONS.map((day) => ({
      ...day,
      slots: slots.filter((slot) => slot.dayOfWeek === day.value),
    }));
  }, [slots]);

  const columns = useMemo<Column<TimetableSlotItem>[]>(() => {
    const base: Column<TimetableSlotItem>[] = [
      { header: "اليوم", accessor: (item) => WEEKDAY_LABELS[item.dayOfWeek] },
      { header: "الوقت", accessor: (item) => `${item.startTime} - ${item.endTime}` },
      { header: "الصف", accessor: (item) => `${item.classroomName} (${item.classroomCode})` },
      { header: "المادة", accessor: (item) => `${item.subjectName} (${item.subjectCode})` },
      { header: "المدرس", accessor: (item) => item.teacherName ?? "-" },
      { header: "القاعة", accessor: (item) => item.roomLabel ?? "-" },
      { header: "الحالة", accessor: (item) => item.isActive ? "نشط" : "غير نشط" },
    ];

    if (isSuperAdmin) {
      base.unshift({
        header: "الأكاديمية",
        accessor: (item) => `${item.academyName} (${item.academyCode})`,
      });
    }

    return base;
  }, [isSuperAdmin]);

  const actions = useMemo<TableAction<TimetableSlotItem>[]>(() => [
    { label: "تعديل", onClick: (item) => startEdit(item) },
    { label: "حذف", onClick: (item) => void deleteSlot(item.id), variant: "danger" },
  ], [classrooms, subjectLinks, teachers]);

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

  async function loadClassrooms(): Promise<void> {
    const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
    const response = await fetch(`/api/admin/classrooms${query}`);
    const payload = (await response.json()) as { classrooms?: ClassroomOption[]; message?: string };

    if (!response.ok || !payload.classrooms) {
      setStatusMessage(payload.message ?? "Failed to load classrooms.");
      return;
    }

    setClassrooms(payload.classrooms);
  }

  async function loadTeachers(): Promise<void> {
    const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
    const response = await fetch(`/api/admin/classrooms/teachers${query}`);
    const payload = (await response.json()) as { teachers?: TeacherOption[]; message?: string };

    if (!response.ok || !payload.teachers) {
      setStatusMessage(payload.message ?? "Failed to load teachers.");
      return;
    }

    setTeachers(payload.teachers);
  }

  async function loadSubjectLinks(): Promise<void> {
    const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
    const response = await fetch(`/api/admin/classrooms/subject-links${query}`);
    const payload = (await response.json()) as { links?: SubjectLinkOption[]; message?: string };

    if (!response.ok || !payload.links) {
      setStatusMessage(payload.message ?? "Failed to load subject links.");
      return;
    }

    setSubjectLinks(payload.links);
  }

  async function loadTimetable(filters?: { classroomId?: string; courseId?: string }): Promise<void> {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (isSuperAdmin && selectedAcademyId) {
        params.set("academyId", selectedAcademyId);
      }

      if (filters?.classroomId) {
        params.set("classroomId", filters.classroomId);
      }

      if (filters?.courseId) {
        params.set("courseId", filters.courseId);
      }

      const query = params.toString();
      const response = await fetch(`/api/admin/timetable${query ? `?${query}` : ""}`);
      const payload = (await response.json()) as { slots?: TimetableSlotItem[]; message?: string };

      if (!response.ok || !payload.slots) {
        setStatusMessage(payload.message ?? "Failed to load timetable.");
        return;
      }

      setSlots(payload.slots);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch timetable.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(): Promise<void> {
    await loadTimetable({
      classroomId: selectedClassroomId || undefined,
      courseId: selectedCourseId || undefined,
    });
  }

  async function handleResetFilters(): Promise<void> {
    setSelectedClassroomId("");
    setSelectedCourseId("");
    await loadTimetable();
  }

  function openCreateModal(): void {
    setEditingSlotId(null);
    setForm(initialForm);
    setIsFormModalOpen(true);
  }

  function closeFormModal(): void {
    setEditingSlotId(null);
    setForm(initialForm);
    setIsFormModalOpen(false);
  }

  function startEdit(slot: TimetableSlotItem): void {
    setEditingSlotId(slot.id);
    setForm({
      classroomId: slot.classroomId,
      courseId: slot.courseId,
      teacherId: slot.teacherId ?? "",
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomLabel: slot.roomLabel ?? "",
      notes: slot.notes ?? "",
      isActive: slot.isActive,
    });
    setIsFormModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      if (isSuperAdmin && !selectedAcademyId) {
        const message = "اختر الأكاديمية أولاً.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const endpoint = editingSlotId ? `/api/admin/timetable/${editingSlotId}` : "/api/admin/timetable";
      const method = editingSlotId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyId: isSuperAdmin ? selectedAcademyId : undefined,
          ...form,
          teacherId: form.teacherId || "",
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Request failed.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const message = payload.message ?? (editingSlotId ? "تم تعديل الحصة." : "تمت إضافة الحصة.");
      setStatusMessage(message);
      showStatus(message);
      closeFormModal();
      await handleSearch();
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSlot(slotId: string): Promise<void> {
    if (!window.confirm("حذف هذه الحصة؟")) {
      return;
    }

    const response = await fetch(`/api/admin/timetable/${slotId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    const message = payload.message ?? "تم حذف الحصة.";
    setStatusMessage(message);
    showStatus(message);
    await handleSearch();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      setSlots([]);
      return;
    }

    void Promise.all([loadClassrooms(), loadTeachers(), loadSubjectLinks()]).then(() => loadTimetable());
  }, [isSuperAdmin, selectedAcademyId]);

  useEffect(() => {
    if (!selectedClassroomId) {
      return;
    }

    const subjectExists = filterSubjects.some((subject) => subject.subjectId === selectedCourseId);

    if (!subjectExists) {
      setSelectedCourseId("");
    }
  }, [selectedClassroomId, filterSubjects, selectedCourseId]);

  useEffect(() => {
    if (!form.classroomId) {
      setForm((prev) => ({ ...prev, courseId: "" }));
      return;
    }

    const subjectExists = formSubjects.some((subject) => subject.subjectId === form.courseId);

    if (!subjectExists) {
      setForm((prev) => ({ ...prev, courseId: "" }));
    }
  }, [form.classroomId, form.courseId, formSubjects]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-l from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">إدارة أكاديمية</p>
            <h2 className="mt-2 text-2xl font-semibold">جدول الحصص الأسبوعي</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              أنشئ حصص الصفوف، اربطها بالمواد والمدرسين، ثم صفِّ النتائج حسب الصف أو المادة مثل شاشة البحث التقليدية.
            </p>
          </div>

          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-medium text-slate-900">
            <Plus size={18} />
            إضافة حصة
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-2 text-slate-900">
          <CalendarClock size={20} />
          <h3 className="text-lg font-semibold">بحث جدول الحصص</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {isSuperAdmin && (
            <select className="rounded-xl border border-slate-300 px-3 py-3" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">اختر الأكاديمية</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>
              ))}
            </select>
          )}

          <select className="rounded-xl border border-slate-300 px-3 py-3" value={selectedClassroomId} onChange={(event) => setSelectedClassroomId(event.target.value)}>
            <option value="">كل الصفوف</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.name} ({classroom.code})</option>
            ))}
          </select>

          <select className="rounded-xl border border-slate-300 px-3 py-3" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
            <option value="">كل المواد</option>
            {filterSubjects.map((subject) => (
              <option key={`${subject.classroomId}-${subject.subjectId}`} value={subject.subjectId}>{subject.subjectName} ({subject.subjectCode})</option>
            ))}
          </select>

          <div className="flex gap-3">
            <button type="button" onClick={() => void handleSearch()} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white">
              بحث
            </button>
            <button type="button" onClick={() => void handleResetFilters()} className="rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700">
              إعادة ضبط
            </button>
          </div>
        </div>

        {statusMessage && <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {groupedSlots.map((day) => (
          <div key={day.value} className="rounded-2xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{day.label}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{day.slots.length}</span>
            </div>

            <div className="space-y-3">
              {day.slots.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد حصص</p>
              ) : (
                day.slots.map((slot) => (
                  <div key={slot.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{slot.subjectName}</p>
                      <span className={`rounded-full px-2 py-1 text-xs ${slot.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {slot.isActive ? "نشط" : "موقوف"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{slot.classroomName} • {slot.startTime} - {slot.endTime}</p>
                    <p className="mt-1 text-xs text-slate-500">{slot.teacherName ?? "بدون مدرس محدد"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold text-slate-900">كل الحصص</h3>
        <div className="mt-4">
          <DataTable data={slots} columns={columns} actions={actions} isLoading={loading} totalCount={slots.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={closeFormModal} title={editingSlotId ? "تعديل الحصة" : "إضافة حصة جديدة"} size="xl">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الصف</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form.classroomId} onChange={(event) => setForm((prev) => ({ ...prev, classroomId: event.target.value }))} required>
              <option value="">اختر الصف</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>{classroom.name} ({classroom.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المادة</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form.courseId} onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))} required>
              <option value="">اختر المادة</option>
              {formSubjects.map((subject) => (
                <option key={`${subject.classroomId}-${subject.subjectId}`} value={subject.subjectId}>{subject.subjectName} ({subject.subjectCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المدرس</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form.teacherId} onChange={(event) => setForm((prev) => ({ ...prev, teacherId: event.target.value }))}>
              <option value="">بدون مدرس محدد</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.fullName} ({teacher.teacherCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">اليوم</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form.dayOfWeek} onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value as Weekday }))}>
              {WEEKDAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">وقت البداية</label>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">وقت النهاية</label>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">القاعة</label>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={form.roomLabel} onChange={(event) => setForm((prev) => ({ ...prev, roomLabel: event.target.value }))} placeholder="مثال: Lab 2" />
          </div>

          <div className="flex items-center gap-2 pt-7">
            <input id="slot-is-active" type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            <label htmlFor="slot-is-active" className="text-sm font-medium text-slate-700">الحصة مفعلة</label>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
            <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2" rows={3} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="تفاصيل إضافية للحصة" />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {submitting ? "جاري الحفظ..." : editingSlotId ? "حفظ التعديلات" : "إضافة الحصة"}
            </button>
            <button type="button" onClick={closeFormModal} className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700">
              إلغاء
            </button>
          </div>
        </form>
      </AppModal>
    </section>
  );
}