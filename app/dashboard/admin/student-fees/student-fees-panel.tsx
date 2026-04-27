"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgeDollarSign, CircleAlert } from "lucide-react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAcademyCode } from "@/lib/super-admin";

interface AcademyOption {
  id: string;
  code: string;
  name: string;
}

interface FeeStudentItem {
  id: string;
  userId: string;
  academyId: string;
  academyCode: string;
  academyName: string;
  studentCode: string;
  fullName: string;
  username: string;
  classroomName: string | null;
  classroomCode: string | null;
  feeCollectionAmount: string | null;
  accessActiveUntil: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  overdueDays: number | null;
}

function showStatus(message: string, type: "success" | "error" = "success"): void {
  if (type === "success") {
    toast.success(message);
    return;
  }

  toast.error(message);
}

export default function StudentFeesPanel() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminAcademyCode(user?.academyCode);

  const [academies, setAcademies] = useState<AcademyOption[]>([]);
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [students, setStudents] = useState<FeeStudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const columns = useMemo<Column<FeeStudentItem>[]>(() => {
    const base: Column<FeeStudentItem>[] = [
      { header: "الطالب", accessor: (item) => `${item.fullName} (${item.studentCode})` },
      { header: "الصف", accessor: (item) => item.classroomName ? `${item.classroomName} (${item.classroomCode})` : "-" },
      { header: "تحصيل الرسوم", accessor: (item) => item.feeCollectionAmount ?? "-" },
      {
        header: "تاريخ الاستحقاق",
        accessor: (item) => item.accessActiveUntil ? new Date(item.accessActiveUntil).toLocaleDateString("ar-EG") : "-",
      },
      {
        header: "أيام التأخير",
        accessor: (item) => item.overdueDays ?? "-",
      },
      { header: "الحالة", accessor: (item) => item.status === "ACTIVE" ? "نشط" : item.status === "SUSPENDED" ? "موقوف" : "قيد الانتظار" },
    ];

    if (isSuperAdmin) {
      base.unshift({
        header: "الأكاديمية",
        accessor: (item) => `${item.academyName} (${item.academyCode})`,
      });
    }

    return base;
  }, [isSuperAdmin]);

  const actions = useMemo<TableAction<FeeStudentItem>[]>(() => [
    {
      label: "تأكيد الدفع وتفعيل",
      onClick: (item) => {
        void markAsPaid(item);
      },
    },
  ], [selectedAcademyId, showAll]);

  const overdueCount = students.filter((student) => (student.overdueDays ?? 0) > 0 || student.status === "SUSPENDED").length;

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
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (isSuperAdmin && selectedAcademyId) {
        params.set("academyId", selectedAcademyId);
      }

      if (showAll) {
        params.set("showAll", "true");
      }

      const query = params.toString();
      const response = await fetch(`/api/admin/student-fees${query ? `?${query}` : ""}`);
      const payload = (await response.json()) as { students?: FeeStudentItem[]; message?: string };

      if (!response.ok || !payload.students) {
        setStatusMessage(payload.message ?? "Failed to load due student fees.");
        return;
      }

      setStudents(payload.students);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch due student fees.");
    } finally {
      setLoading(false);
    }
  }

  async function markAsPaid(student: FeeStudentItem): Promise<void> {
    const confirmed = window.confirm(`تأكيد استلام الرسوم وتفعيل الطالب ${student.fullName}؟`);

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/admin/students/${student.id}/activate`, { method: "POST" });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "Failed to activate student.";
      setStatusMessage(message);
      showStatus(message, "error");
      return;
    }

    const message = payload.message ?? "تم تفعيل الطالب بعد الدفع.";
    setStatusMessage(message);
    showStatus(message);
    await loadStudents();
  }

  useEffect(() => {
    void loadAcademies();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !selectedAcademyId) {
      setStudents([]);
      return;
    }

    void loadStudents();
  }, [isSuperAdmin, selectedAcademyId, showAll]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-l from-rose-700 via-rose-600 to-orange-500 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-rose-100">إدارة رسوم الطلاب</p>
            <h1 className="mt-2 text-2xl font-semibold">الطلاب المستحق عليهم الدفع</h1>
            <p className="mt-2 text-sm text-rose-50">
              تعرض هذه الصفحة الطلاب الذين انتهت مدة تفعيلهم الشهرية، ويمكن تأكيد الدفع يدوياً لإعادة تفعيل الحساب للشهر التالي.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
            <p className="text-xs text-rose-100">عدد الحالات المستحقة</p>
            <p className="mt-1 text-2xl font-bold">{overdueCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-4 flex items-center gap-2 text-slate-900">
          <BadgeDollarSign size={20} />
          <h2 className="text-lg font-semibold">متابعة التحصيل</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {isSuperAdmin && (
            <select className="rounded-xl border border-slate-300 px-3 py-3" value={selectedAcademyId} onChange={(event) => setSelectedAcademyId(event.target.value)}>
              <option value="">اختر الأكاديمية</option>
              {academies.map((academy) => (
                <option key={academy.id} value={academy.id}>{academy.name} ({academy.code})</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
            عرض كل الطلاب الذين لديهم رسوم معرفة
          </label>

          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <span>عند الضغط على تأكيد الدفع يتم تفعيل الطالب للشهر التالي مباشرة.</span>
          </div>
        </div>

        {statusMessage && <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{statusMessage}</p>}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-900">جدول الرسوم المستحقة</h2>
        <div className="mt-4">
          <DataTable data={students} columns={columns} actions={actions} isLoading={loading} totalCount={students.length} pageSize={10} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>
    </section>
  );
}