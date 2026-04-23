"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChatModal } from "@/components/shared/chat-modal";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

type Gender = "MALE" | "FEMALE" | "OTHER";
type Status = "ACTIVE" | "SUSPENDED" | "PENDING";

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

interface StudentItem {
  id: string;
  userId: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  studentCode: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  admissionDate: string | null;
  classroomId: string | null;
  classroomCode: string | null;
  classroomName: string | null;
  rollNumber: string | null;
  caste: string | null;
  religion: string | null;
  profilePicUrl: string | null;
  bloodGroup: string | null;
  height: string | null;
  weight: string | null;
  note: string | null;
  status: Status;
  parents: Array<{ id: string; fullName: string }>;
}

interface StudentForm {
  firstName: string;
  lastName: string;
  classroomId: string;
  gender: "" | Gender;
  dateOfBirth: string;
  admissionDate: string;
  religion: string;
  mobileNumber: string;
  profilePicUrl: string;
  bloodGroup: string;
  height: string;
  weight: string;
  email: string;
  password: string;
  status: Status;
  note: string;
}

const initialForm: StudentForm = {
  firstName: "",
  lastName: "",
  classroomId: "",
  gender: "",
  dateOfBirth: "",
  admissionDate: "",
  religion: "",
  mobileNumber: "",
  profilePicUrl: "",
  bloodGroup: "",
  height: "",
  weight: "",
  email: "",
  password: "",
  status: "ACTIVE",
  note: "",
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

export default function StudentsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(initialForm);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatPeer, setChatPeer] = useState<{ id: string; name: string } | null>(null);

  const columns = useMemo<Column<StudentItem>[]>(() => {
    const base: Column<StudentItem>[] = [
      { header: "الاسم", accessor: "fullName" },
      { header: "الصف", accessor: (item) => item.classroomName ?? "-" },
      { header: "الهاتف", accessor: (item) => item.mobileNumber ?? "-" },
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

  const actions = useMemo<TableAction<StudentItem>[]>(() => [
    { label: "مراسلة", onClick: (item) => openChat(item) },
    { label: "تعديل", onClick: (item) => startEdit(item) },
    { label: "حذف", onClick: (item) => void deleteStudent(item.id), variant: "danger" },
  ], [user?.id]);

  /**
   * Opens chat modal for selected student.
   */
  function openChat(student: StudentItem): void {
    if (!user?.id) {
      showStatus("تعذر تحديد المستخدم الحالي.", "error");
      return;
    }

    setChatPeer({ id: student.userId, name: student.fullName });
    setIsChatModalOpen(true);
  }

  function openCreateModal(): void {
    setEditingStudentId(null);
    setForm(initialForm);
    setProfileImageFile(null);
    setProfileImagePreview("");
    setStatusMessage("");
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

  async function loadClassrooms(): Promise<void> {
    const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
    const response = await fetch(`/api/admin/classrooms${query}`);
    const payload = (await response.json()) as { classrooms?: ClassroomOption[] };

    if (response.ok && payload.classrooms) {
      setClassrooms(payload.classrooms.map((item) => ({ id: item.id, code: item.code, name: item.name })));
    }
  }

  async function loadStudents(): Promise<void> {
    setLoading(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/students${query}`);
      const payload = (await response.json()) as { students?: StudentItem[]; message?: string };

      if (!response.ok || !payload.students) {
        setStatusMessage(payload.message ?? "Failed to load students.");
        return;
      }

      setStudents(payload.students);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch students.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadProfileImage(): Promise<string | null> {
    if (!profileImageFile) {
      return form.profilePicUrl || null;
    }

    setUploadingImage(true);
    const imageFormData = new FormData();
    imageFormData.append("file", profileImageFile);
    imageFormData.append("entity", "students");

    const response = await fetch("/api/uploads/profiles", {
      method: "POST",
      body: imageFormData,
    });

    const payload = (await response.json()) as { url?: string; message?: string };

    if (!response.ok || !payload.url) {
      throw new Error(payload.message ?? "فشل رفع الصورة.");
    }

    showStatus("تم رفع صورة الطالب بنجاح.");
    return payload.url;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingStudentId);
      const endpoint = isEditing ? `/api/admin/students/${editingStudentId}` : "/api/admin/students";
      const method = isEditing ? "PATCH" : "POST";

      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy first.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const profilePicUrl = await uploadProfileImage();
      const body = {
        academyId: isSuperAdmin ? selectedAcademyId : undefined,
        ...form,
        classroomId: form.classroomId || "",
        gender: form.gender === "" ? null : form.gender,
        profilePicUrl: profilePicUrl ?? "",
      };

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

      const successMessage = isEditing ? "Student updated." : "Student created.";
      setStatusMessage(successMessage);
      showStatus(successMessage);
      setEditingStudentId(null);
      setForm(initialForm);
      setProfileImageFile(null);
      setProfileImagePreview("");
      setIsFormModalOpen(false);
      await loadStudents();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  }

  function startEdit(student: StudentItem): void {
    if (isSuperAdmin && student.academyId !== selectedAcademyId) {
      setSelectedAcademyId(student.academyId);
    }

    setEditingStudentId(student.id);
    setForm({
      firstName: student.firstName ?? "",
      lastName: student.lastName ?? "",
      classroomId: student.classroomId ?? "",
      gender: student.gender ?? "",
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "",
      admissionDate: student.admissionDate ? student.admissionDate.slice(0, 10) : "",
      religion: student.religion ?? "",
      mobileNumber: student.mobileNumber ?? "",
      profilePicUrl: student.profilePicUrl ?? "",
      bloodGroup: student.bloodGroup ?? "",
      height: student.height ?? "",
      weight: student.weight ?? "",
      email: student.email ?? "",
      password: "",
      status: student.status,
      note: student.note ?? "",
    });
    setProfileImageFile(null);
    setProfileImagePreview(student.profilePicUrl ?? "");
    setIsFormModalOpen(true);
  }

  function cancelEdit(): void {
    setEditingStudentId(null);
    setForm(initialForm);
    setProfileImageFile(null);
    setProfileImagePreview("");
    setIsFormModalOpen(false);
  }

  function onProfileImageChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    setProfileImageFile(file);

    if (file) {
      setProfileImagePreview(URL.createObjectURL(file));
      return;
    }

    setProfileImagePreview(form.profilePicUrl || "");
  }

  async function deleteStudent(studentId: string): Promise<void> {
    if (!window.confirm("Delete this student?")) {
      return;
    }

    const response = await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage("Student deleted.");
    showStatus("Student deleted.");
    await loadStudents();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      return;
    }

    void Promise.all([loadStudents(), loadClassrooms()]);
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">إدارة الطلاب</h2>
          <button type="button" onClick={openCreateModal} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
            إضافة طالب
          </button>
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={cancelEdit} title={editingStudentId ? "تعديل الطالب" : "إضافة طالب"} size="xl">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">اختر الأكاديمية</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>
              ))}
            </select>
          )}

          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الاسم الأول" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الاسم الأخير" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.classroomId} onChange={(event) => setForm((prev) => ({ ...prev, classroomId: event.target.value }))}>
            <option value="">اختر الصف</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.name} ({classroom.code})</option>
            ))}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as StudentForm["gender"] }))}>
            <option value="">اختر الجنس</option>
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
            <option value="OTHER">آخر</option>
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dateOfBirth} onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الديانة" value={form.religion} onChange={(event) => setForm((prev) => ({ ...prev, religion: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="رقم الهاتف" value={form.mobileNumber} onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.admissionDate} onChange={(event) => setForm((prev) => ({ ...prev, admissionDate: event.target.value }))} />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">الصورة الشخصية</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onProfileImageChange} />
            {profileImagePreview && <img src={profileImagePreview} alt="student preview" className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover" />}
          </div>
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="فصيلة الدم" value={form.bloodGroup} onChange={(event) => setForm((prev) => ({ ...prev, bloodGroup: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الطول" value={form.height} onChange={(event) => setForm((prev) => ({ ...prev, height: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الوزن" value={form.weight} onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))} />
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Status }))}>
            <option value="ACTIVE">نشط</option>
            <option value="SUSPENDED">موقوف</option>
            <option value="PENDING">قيد الانتظار</option>
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder={editingStudentId ? "كلمة المرور الجديدة (اختياري)" : "كلمة المرور"} type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required={!editingStudentId} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="ملاحظات" rows={3} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting || uploadingImage} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {uploadingImage ? "جاري رفع الصورة..." : submitting ? "جاري الحفظ..." : editingStudentId ? "حفظ التعديلات" : "إضافة الطالب"}
            </button>
            {editingStudentId && <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">إلغاء</button>}
          </div>
        </form>
      </AppModal>

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        currentUserId={user?.id ?? ""}
        peerUserId={chatPeer?.id ?? ""}
        peerName={chatPeer?.name ?? ""}
        academyId={isSuperAdmin ? selectedAcademyId || undefined : undefined}
      />

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">جدول الطلاب</h2>
        {statusMessage && <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
        <div className="mt-4">
          <DataTable data={students} columns={columns} actions={actions} isLoading={loading} totalCount={students.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>
    </section>
  );
}
