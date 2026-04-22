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

interface StudentOption {
  id: string;
  studentCode: string;
  fullName: string;
}

interface ParentItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  gender: Gender | null;
  occupation: string | null;
  address: string | null;
  profilePicUrl: string | null;
  status: Status;
  students: Array<{ id: string; fullName: string; studentCode: string }>;
}

interface ParentStudentLinkItem {
  id: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  relation: string;
  isPrimary: boolean;
  parentId: string;
  parentName: string;
  parentUsername: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  studentUsername: string;
  createdAt: string;
}

interface ParentForm {
  firstName: string;
  lastName: string;
  gender: "" | Gender;
  occupation: string;
  mobileNumber: string;
  address: string;
  profilePicUrl: string;
  email: string;
  password: string;
  status: Status;
}

const initialForm: ParentForm = {
  firstName: "",
  lastName: "",
  gender: "",
  occupation: "",
  mobileNumber: "",
  address: "",
  profilePicUrl: "",
  email: "",
  password: "",
  status: "ACTIVE",
};

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

export default function ParentsPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [linksPage, setLinksPage] = useState(1);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingParentId, setLinkingParentId] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [relation, setRelation] = useState("FATHER");
  const [form, setForm] = useState<ParentForm>(initialForm);
  const [parentStudentLinks, setParentStudentLinks] = useState<ParentStudentLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const columns = useMemo<Column<ParentItem>[]>(() => {
    const base: Column<ParentItem>[] = [
      { header: "الاسم", accessor: "fullName" },
      { header: "اسم المستخدم", accessor: "username" },
      { header: "الهاتف", accessor: (item) => item.mobileNumber ?? "-" },
      { header: "الوظيفة", accessor: (item) => item.occupation ?? "-" },
      { header: "الطلاب", accessor: (item) => item.students.length > 0 ? item.students.map((student) => student.fullName).join("، ") : "-" },
      { header: "الحالة", accessor: "status" },
    ];

    if (isSuperAdmin) {
      base.unshift({ header: "الأكاديمية", accessor: (item) => `${item.academyName} (${item.academyCode})` });
    }

    return base;
  }, [isSuperAdmin]);

  const linkColumns = useMemo<Column<ParentStudentLinkItem>[]>(() => {
    const base: Column<ParentStudentLinkItem>[] = [
      { header: "ولي الأمر", accessor: "parentName" },
      { header: "الطالب", accessor: "studentName" },
      { header: "رقم القبول", accessor: "studentCode" },
      { header: "نوع العلاقة", accessor: "relation" },
      { header: "الرابط الأساسي", accessor: (item) => item.isPrimary ? "نعم" : "لا" },
    ];

    if (isSuperAdmin) {
      base.unshift({ header: "الأكاديمية", accessor: (item) => `${item.academyName} (${item.academyCode})` });
    }

    return base;
  }, [isSuperAdmin]);

  const actions = useMemo<TableAction<ParentItem>[]>(() => [
    { label: "ربط الطلاب", onClick: (item) => openLinkModal(item) },
    { label: "تعديل", onClick: (item) => startEdit(item) },
    { label: "حذف", onClick: (item) => void deleteParent(item.id), variant: "danger" },
  ], []);

  function openCreateModal(): void {
    setEditingParentId(null);
    setForm(initialForm);
    setProfileImageFile(null);
    setProfileImagePreview("");
    setStatusMessage("");
    setIsFormModalOpen(true);
  }

  function openLinkModal(parent: ParentItem): void {
    if (isSuperAdmin && parent.academyId !== selectedAcademyId) {
      setSelectedAcademyId(parent.academyId);
    }

    setLinkingParentId(parent.id);
    setSelectedStudentIds(parent.students.map((student) => student.id));
    setRelation("FATHER");
    setIsLinkModalOpen(true);
  }

  function closeLinkModal(): void {
    setLinkingParentId("");
    setSelectedStudentIds([]);
    setRelation("FATHER");
    setIsLinkModalOpen(false);
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

  async function loadStudents(): Promise<void> {
    const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
    const response = await fetch(`/api/admin/students${query}`);
    const payload = (await response.json()) as { students?: Array<{ id: string; studentCode: string; fullName: string }> };

    if (response.ok && payload.students) {
      setStudents(payload.students);
    }
  }

  async function loadParentStudentLinks(): Promise<void> {
    setLoadingLinks(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/parents/links${query}`);
      const payload = (await response.json()) as { links?: ParentStudentLinkItem[]; message?: string };

      if (!response.ok || !payload.links) {
        setStatusMessage(payload.message ?? "Failed to load parent-student links.");
        return;
      }

      setParentStudentLinks(payload.links);
      setLinksPage(1);
    } catch {
      setStatusMessage("Could not fetch parent-student links.");
    } finally {
      setLoadingLinks(false);
    }
  }

  async function loadParents(): Promise<void> {
    setLoading(true);

    try {
      const query = isSuperAdmin && selectedAcademyId ? `?academyId=${selectedAcademyId}` : "";
      const response = await fetch(`/api/admin/parents${query}`);
      const payload = (await response.json()) as { parents?: ParentItem[]; message?: string };

      if (!response.ok || !payload.parents) {
        setStatusMessage(payload.message ?? "Failed to load parents.");
        return;
      }

      setParents(payload.parents);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch parents.");
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
    imageFormData.append("entity", "parents");

    const response = await fetch("/api/uploads/profiles", { method: "POST", body: imageFormData });
    const payload = (await response.json()) as { url?: string; message?: string };

    if (!response.ok || !payload.url) {
      throw new Error(payload.message ?? "فشل رفع الصورة.");
    }

    return payload.url;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const isEditing = Boolean(editingParentId);
      const endpoint = isEditing ? `/api/admin/parents/${editingParentId}` : "/api/admin/parents";
      const method = isEditing ? "PATCH" : "POST";

      if (isSuperAdmin && !selectedAcademyId) {
        const message = "Please select an academy first.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const profilePicUrl = await uploadProfileImage();
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyId: isSuperAdmin ? selectedAcademyId : undefined,
          ...form,
          gender: form.gender === "" ? null : form.gender,
          profilePicUrl: profilePicUrl ?? "",
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Request failed.";
        setStatusMessage(message);
        showStatus(message, "error");
        return;
      }

      const successMessage = isEditing ? "Parent updated." : "Parent created.";
      setStatusMessage(successMessage);
      showStatus(successMessage);
      setEditingParentId(null);
      setForm(initialForm);
      setProfileImageFile(null);
      setProfileImagePreview("");
      setIsFormModalOpen(false);
      await Promise.all([loadParents(), loadParentStudentLinks()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      setStatusMessage(message);
      showStatus(message, "error");
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  }

  async function handleLinkStudents(): Promise<void> {
    if (!linkingParentId || selectedStudentIds.length === 0) {
      const message = "Please select at least one student.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    const response = await fetch("/api/admin/parents/link-students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: linkingParentId, studentIds: selectedStudentIds, relation }),
    });
    const payload = (await response.json()) as { message?: string; count?: number };

    if (!response.ok) {
      const message = payload.message ?? "Failed to link students.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage(payload.message ?? "Students linked to parent.");
    showStatus(payload.message ?? "Students linked to parent.");
    closeLinkModal();
    await Promise.all([loadParents(), loadParentStudentLinks()]);
  }

  function startEdit(parent: ParentItem): void {
    if (isSuperAdmin && parent.academyId !== selectedAcademyId) {
      setSelectedAcademyId(parent.academyId);
    }

    setEditingParentId(parent.id);
    setForm({
      firstName: parent.firstName ?? "",
      lastName: parent.lastName ?? "",
      gender: parent.gender ?? "",
      occupation: parent.occupation ?? "",
      mobileNumber: parent.mobileNumber ?? "",
      address: parent.address ?? "",
      profilePicUrl: parent.profilePicUrl ?? "",
      email: parent.email ?? "",
      password: "",
      status: parent.status,
    });
    setProfileImageFile(null);
    setProfileImagePreview(parent.profilePicUrl ?? "");
    setIsFormModalOpen(true);
  }

  function cancelEdit(): void {
    setEditingParentId(null);
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

  async function deleteParent(parentId: string): Promise<void> {
    if (!window.confirm("Delete this parent?")) {
      return;
    }

    const response = await fetch(`/api/admin/parents/${parentId}`, { method: "DELETE" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Delete failed.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    setStatusMessage("Parent deleted.");
    showStatus("Parent deleted.");
    await Promise.all([loadParents(), loadParentStudentLinks()]);
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      return;
    }

    void Promise.all([loadParents(), loadStudents(), loadParentStudentLinks()]);
  }, [isSuperAdmin, selectedAcademyId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">إدارة الأبوين</h2>
          <button type="button" onClick={openCreateModal} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">إضافة ولي أمر</button>
        </div>
      </div>

      <AppModal isOpen={isFormModalOpen} onClose={cancelEdit} title={editingParentId ? "تعديل ولي الأمر" : "إضافة ولي أمر"} size="xl">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">اختر الأكاديمية</option>
              {academies.map((academy) => <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>)}
            </select>
          )}
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الاسم الأول" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الاسم الأخير" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as ParentForm["gender"] }))}>
            <option value="">اختر الجنس</option>
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
            <option value="OTHER">آخر</option>
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="الوظيفة" value={form.occupation} onChange={(event) => setForm((prev) => ({ ...prev, occupation: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="رقم الهاتف" value={form.mobileNumber} onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="العنوان" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">الصورة الشخصية</label>
            <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onProfileImageChange} />
            {profileImagePreview && <img src={profileImagePreview} alt="parent preview" className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover" />}
          </div>
          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Status }))}>
            <option value="ACTIVE">نشط</option>
            <option value="SUSPENDED">موقوف</option>
            <option value="PENDING">قيد الانتظار</option>
          </select>
          <div className="md:col-span-2" />
          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder={editingParentId ? "كلمة المرور الجديدة (اختياري)" : "كلمة المرور"} type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required={!editingParentId} />

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting || uploadingImage} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">{uploadingImage ? "جاري رفع الصورة..." : submitting ? "جاري الحفظ..." : editingParentId ? "حفظ التعديلات" : "إضافة ولي الأمر"}</button>
            {editingParentId && <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">إلغاء</button>}
          </div>
        </form>
      </AppModal>

      <AppModal isOpen={isLinkModalOpen} onClose={closeLinkModal} title="ربط الطلاب بولي الأمر" size="lg">
        <div className="space-y-4">
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={relation} onChange={(event) => setRelation(event.target.value)}>
            <option value="FATHER">أب</option>
            <option value="MOTHER">أم</option>
            <option value="GUARDIAN">وصي</option>
          </select>
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
            {students.length === 0 ? <p className="text-sm text-slate-500">لا يوجد طلاب متاحون</p> : students.map((student) => (
              <label key={student.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={(event) => setSelectedStudentIds((prev) => event.target.checked ? [...prev, student.id] : prev.filter((id) => id !== student.id))} />
                <span>{student.fullName} ({student.studentCode})</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void handleLinkStudents()} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">ربط الطلاب</button>
            <button type="button" onClick={closeLinkModal} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">إلغاء</button>
          </div>
        </div>
      </AppModal>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">جدول الأبوين</h2>
        {statusMessage && <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
        <div className="mt-4">
          <DataTable data={parents} columns={columns} actions={actions} isLoading={loading} totalCount={parents.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">روابط الأبوين مع الأبناء</h2>
        <div className="mt-4">
          <DataTable data={parentStudentLinks} columns={linkColumns} isLoading={loadingLinks} totalCount={parentStudentLinks.length} pageSize={10} currentPage={linksPage} onPageChange={setLinksPage} />
        </div>
      </div>
    </section>
  );
}
