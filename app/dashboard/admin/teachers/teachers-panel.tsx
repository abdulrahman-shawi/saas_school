"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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

interface TeacherItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  teacherCode: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  maritalStatus: string | null;
  profilePicUrl: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  qualification: string | null;
  workExperience: string | null;
  note: string | null;
  status: Status;
}

interface TeacherForm {
  academyId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  mobileNumber: string;
  gender: "" | Gender;
  dateOfBirth: string;
  dateOfJoining: string;
  maritalStatus: string;
  profilePicUrl: string;
  currentAddress: string;
  permanentAddress: string;
  qualification: string;
  workExperience: string;
  note: string;
  status: Status;
}

const initialForm: TeacherForm = {
  academyId: "",
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  mobileNumber: "",
  gender: "",
  dateOfBirth: "",
  dateOfJoining: "",
  maritalStatus: "",
  profilePicUrl: "",
  currentAddress: "",
  permanentAddress: "",
  qualification: "",
  workExperience: "",
  note: "",
  status: "ACTIVE",
};

/**
 * Stores a status message and shows it as an on-screen toast.
 */
function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

/**
 * Teachers CRUD panel with complete teacher profile fields.
 */
export default function TeachersPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [form, setForm] = useState<TeacherForm>(initialForm);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  function openCreateModal(): void {
    setEditingTeacherId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setProfileImageFile(null);
    setProfileImagePreview("");
    setStatusMessage("");
    setIsFormModalOpen(true);
  }

  const columns = useMemo<Column<TeacherItem>[]>(
    () => {
      const base: Column<TeacherItem>[] = [
        { header: "كود المدرس", accessor: "teacherCode" },
        { header: "الاسم الكامل", accessor: "fullName" },
        { header: "اسم المستخدم", accessor: "username" },
        { header: "البريد الإلكتروني", accessor: (item) => item.email ?? "-" },
        { header: "الهاتف", accessor: (item) => item.mobileNumber ?? "-" },
        { header: "الجنس", accessor: (item) => item.gender ?? "-" },
        { header: "الحالة", accessor: "status" },
      ];

      if (isSuperAdmin) {
        base.unshift({
          header: "الأكاديمية",
          accessor: (item) => `${item.academyName} (${item.academyCode})`,
        });
      }

      return base;
    },
    [isSuperAdmin],
  );

  const actions = useMemo<TableAction<TeacherItem>[]>(
    () => [
      {
        label: "تعديل",
        onClick: (item) => startEdit(item),
      },
      {
        label: "حذف",
        onClick: (item) => {
          void deleteTeacher(item.id);
        },
        variant: "danger",
      },
    ],
    [],
  );

  /**
   * Loads academies for super admin selector.
   */
  async function loadAcademies(): Promise<void> {
    if (!isSuperAdmin) {
      return;
    }

    const response = await fetch("/api/admin/academies");
    const payload = (await response.json()) as {
      academies?: AcademyOption[];
    };

    if (response.ok && payload.academies) {
      setAcademies(payload.academies);
    }
  }

  /**
   * Loads teachers by tenant scope.
   */
  async function loadTeachers(): Promise<void> {
    setLoading(true);

    try {
      const query = isSuperAdmin && selectedAcademyId
        ? `?academyId=${selectedAcademyId}`
        : "";
      const response = await fetch(`/api/admin/teachers${query}`);
      const payload = (await response.json()) as {
        teachers?: TeacherItem[];
        message?: string;
      };

      if (!response.ok || !payload.teachers) {
        setStatusMessage(payload.message ?? "Failed to load teachers.");
        return;
      }

      setTeachers(payload.teachers);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch teachers.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Creates or updates teacher.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingTeacherId);
      const endpoint = isEditing
        ? `/api/admin/teachers/${editingTeacherId}`
        : "/api/admin/teachers";
      const method = isEditing ? "PATCH" : "POST";

      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy first.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      let profilePicUrl = form.profilePicUrl;

      if (profileImageFile) {
        setUploadingImage(true);
        const imageFormData = new FormData();
        imageFormData.append("file", profileImageFile);

        const uploadResponse = await fetch("/api/uploads/teachers", {
          method: "POST",
          body: imageFormData,
        });

        const uploadPayload = (await uploadResponse.json()) as {
          url?: string;
          message?: string;
        };

        if (!uploadResponse.ok || !uploadPayload.url) {
          const message = uploadPayload.message ?? "فشل رفع الصورة.";
          setStatusMessage(message);
          showStatus(message, "error");
          return;
        }

        profilePicUrl = uploadPayload.url;
        showStatus("تم رفع الصورة بنجاح.");
      }

      const body = {
        ...form,
        academyId: isSuperAdmin ? selectedAcademyId : undefined,
        gender: form.gender === "" ? null : form.gender,
        profilePicUrl,
        password: form.password,
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

      const successMessage = isEditing ? "Teacher updated." : "Teacher created.";
      setStatusMessage(successMessage);
      showStatus(successMessage);
      setEditingTeacherId(null);
      setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
      setProfileImageFile(null);
      setProfileImagePreview("");
      setIsFormModalOpen(false);
      await loadTeachers();
    } catch {
      const message = "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  }

  /**
   * Moves selected teacher row to edit form.
   */
  function startEdit(teacher: TeacherItem): void {
    setEditingTeacherId(teacher.id);

    if (isSuperAdmin && teacher.academyId !== selectedAcademyId) {
      setSelectedAcademyId(teacher.academyId);
    }

    setForm({
      academyId: teacher.academyId,
      firstName: teacher.firstName ?? "",
      lastName: teacher.lastName ?? "",
      username: teacher.username,
      email: teacher.email ?? "",
      password: "",
      mobileNumber: teacher.mobileNumber ?? "",
      gender: teacher.gender ?? "",
      dateOfBirth: teacher.dateOfBirth ? teacher.dateOfBirth.slice(0, 10) : "",
      dateOfJoining: teacher.dateOfJoining ? teacher.dateOfJoining.slice(0, 10) : "",
      maritalStatus: teacher.maritalStatus ?? "",
      profilePicUrl: teacher.profilePicUrl ?? "",
      currentAddress: teacher.currentAddress ?? "",
      permanentAddress: teacher.permanentAddress ?? "",
      qualification: teacher.qualification ?? "",
      workExperience: teacher.workExperience ?? "",
      note: teacher.note ?? "",
      status: teacher.status,
    });
    setProfileImageFile(null);
    setProfileImagePreview(teacher.profilePicUrl ?? "");
    setIsFormModalOpen(true);
  }

  /**
   * Exits edit mode and resets form.
   */
  function cancelEdit(): void {
    setEditingTeacherId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setProfileImageFile(null);
    setProfileImagePreview("");
    setIsFormModalOpen(false);
  }

  /**
   * Handles teacher profile image selection and preview.
   */
  function onProfileImageChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    setProfileImageFile(file);

    if (file) {
      setProfileImagePreview(URL.createObjectURL(file));
      return;
    }

    setProfileImagePreview(form.profilePicUrl || "");
  }

  /**
   * Deletes teacher entry.
   */
  async function deleteTeacher(teacherId: string): Promise<void> {
    const confirmed = window.confirm("Delete this teacher?");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    const successMessage = "Teacher deleted.";
    setStatusMessage(successMessage);
    showStatus(successMessage);
    await loadTeachers();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      void loadTeachers();
      return;
    }

    void loadTeachers();
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">إدارة المدرسين</h2>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white"
          >
            إضافة مدرس
          </button>
        </div>
      </div>

      <AppModal
        isOpen={isFormModalOpen}
        onClose={cancelEdit}
        title={editingTeacherId ? "تعديل المدرس" : "إضافة مدرس"}
        size="xl"
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">الأكاديمية</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={selectedAcademyId}
                onChange={(event) => setSelectedAcademyId(event.target.value)}
              >
                <option value="">كل الأكاديميات (عرض)</option>
                {academies.map((academy) => (
                  <option key={academy.id} value={academy.id}>
                    {academy.name} ({academy.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الاسم الأول</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="First Name" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">اسم العائلة</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Last Name" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">اسم المستخدم</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Username" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={editingTeacherId ? "Password (optional)" : "Password"} type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required={!editingTeacherId} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">رقم الهاتف</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الجنس</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as TeacherForm["gender"] }))}>
              <option value="">اختر الجنس</option>
              <option value="MALE">ذكر</option>
              <option value="FEMALE">أنثى</option>
              <option value="OTHER">آخر</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ الميلاد</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dateOfBirth} onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ الانضمام</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dateOfJoining} onChange={(event) => setForm((prev) => ({ ...prev, dateOfJoining: event.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الحالة الاجتماعية</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Marital Status" value={form.maritalStatus} onChange={(event) => setForm((prev) => ({ ...prev, maritalStatus: event.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">الصورة الشخصية (من الكمبيوتر)</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onProfileImageChange}
            />
            {profileImagePreview && (
              <img
                src={profileImagePreview}
                alt="teacher profile preview"
                className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">العنوان الحالي</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Current Address" value={form.currentAddress} onChange={(event) => setForm((prev) => ({ ...prev, currentAddress: event.target.value }))} rows={3} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">العنوان الدائم</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Permanent Address" value={form.permanentAddress} onChange={(event) => setForm((prev) => ({ ...prev, permanentAddress: event.target.value }))} rows={3} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المؤهل</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Qualification" value={form.qualification} onChange={(event) => setForm((prev) => ({ ...prev, qualification: event.target.value }))} rows={3} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الخبرة العملية</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Work Experience" value={form.workExperience} onChange={(event) => setForm((prev) => ({ ...prev, workExperience: event.target.value }))} rows={3} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
            <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Note" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} rows={3} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الحالة</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Status }))}>
              <option value="ACTIVE">نشط</option>
              <option value="SUSPENDED">موقوف</option>
              <option value="PENDING">قيد الانتظار</option>
            </select>
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting || uploadingImage} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {uploadingImage ? "جاري رفع الصورة..." : submitting ? "جاري الحفظ..." : editingTeacherId ? "حفظ التعديلات" : "إضافة المدرس"}
            </button>
            {editingTeacherId && (
              <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </AppModal>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">عرض المدرسين</h2>
        {statusMessage && (
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>
        )}

        <div className="mt-4">
          <DataTable
            data={teachers}
            columns={columns}
            actions={actions}
            isLoading={loading}
            totalCount={teachers.length}
            pageSize={10}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </section>
  );
}
