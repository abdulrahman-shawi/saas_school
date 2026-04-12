"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
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
  const [form, setForm] = useState<TeacherForm>(initialForm);

  const columns = useMemo<Column<TeacherItem>[]>(
    () => {
      const base: Column<TeacherItem>[] = [
        { header: "Teacher Code", accessor: "teacherCode" },
        { header: "Full Name", accessor: "fullName" },
        { header: "Username", accessor: "username" },
        { header: "Email", accessor: (item) => item.email ?? "-" },
        { header: "Mobile", accessor: (item) => item.mobileNumber ?? "-" },
        { header: "Gender", accessor: (item) => item.gender ?? "-" },
        { header: "Status", accessor: "status" },
      ];

      if (isSuperAdmin) {
        base.unshift({
          header: "Academy",
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
        label: "Edit",
        onClick: (item) => startEdit(item),
      },
      {
        label: "Delete",
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
        setStatusMessage("Please select an academy first.");
        return;
      }

      const body = {
        ...form,
        academyId: isSuperAdmin ? selectedAcademyId : undefined,
        gender: form.gender === "" ? null : form.gender,
        password: form.password,
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

      setStatusMessage(isEditing ? "Teacher updated." : "Teacher created.");
      setEditingTeacherId(null);
      setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
      await loadTeachers();
    } catch {
      setStatusMessage("Unexpected error.");
    } finally {
      setSubmitting(false);
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
  }

  /**
   * Exits edit mode and resets form.
   */
  function cancelEdit(): void {
    setEditingTeacherId(null);
    setForm((prev) => ({ ...initialForm, academyId: prev.academyId }));
    setStatusMessage("");
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
      setStatusMessage(payload.message ?? "Delete failed.");
      return;
    }

    setStatusMessage("Teacher deleted.");
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
        <h2 className="text-xl font-semibold text-slate-900">
          {editingTeacherId ? "تعديل المدرس" : "إضافة مدرس"}
        </h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          {isSuperAdmin && (
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
              value={selectedAcademyId}
              onChange={(event) => setSelectedAcademyId(event.target.value)}
            >
              <option value="">All academies (view)</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>
                  {academy.name} ({academy.code})
                </option>
              ))}
            </select>
          )}

          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="First Name" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Last Name" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Username" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder={editingTeacherId ? "Password (optional)" : "Password"} type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required={!editingTeacherId} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Mobile Number" value={form.mobileNumber} onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))} />

          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as TeacherForm["gender"] }))}>
            <option value="">Select Gender</option>
            <option value="MALE">MALE</option>
            <option value="FEMALE">FEMALE</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dateOfBirth} onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" type="date" value={form.dateOfJoining} onChange={(event) => setForm((prev) => ({ ...prev, dateOfJoining: event.target.value }))} />
          <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Marital Status" value={form.maritalStatus} onChange={(event) => setForm((prev) => ({ ...prev, maritalStatus: event.target.value }))} />

          <input className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Profile Pic URL" value={form.profilePicUrl} onChange={(event) => setForm((prev) => ({ ...prev, profilePicUrl: event.target.value }))} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Current Address" value={form.currentAddress} onChange={(event) => setForm((prev) => ({ ...prev, currentAddress: event.target.value }))} rows={3} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Permanent Address" value={form.permanentAddress} onChange={(event) => setForm((prev) => ({ ...prev, permanentAddress: event.target.value }))} rows={3} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Qualification" value={form.qualification} onChange={(event) => setForm((prev) => ({ ...prev, qualification: event.target.value }))} rows={3} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Work Experience" value={form.workExperience} onChange={(event) => setForm((prev) => ({ ...prev, workExperience: event.target.value }))} rows={3} />
          <textarea className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Note" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} rows={3} />

          <select className="rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Status }))}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="PENDING">PENDING</option>
          </select>

          <div className="flex items-center gap-2 md:col-span-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">
              {submitting ? "Saving..." : editingTeacherId ? "حفظ التعديلات" : "إضافة المدرس"}
            </button>
            {editingTeacherId && (
              <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

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
