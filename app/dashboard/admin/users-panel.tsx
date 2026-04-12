"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";

type Role = "ACADEMY_ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "STAFF";
type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING";

interface ManagedUser {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  studentProfile: { studentCode: string } | null;
  teacherProfile: { teacherCode: string } | null;
  staffProfile: { staffCode: string } | null;
}

interface CreateUserForm {
  username: string;
  fullName: string;
  password: string;
  email: string;
  phone: string;
  role: Role;
}

const roleOptions: Role[] = [
  "ACADEMY_ADMIN",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
];

/**
 * Admin panel for creating and managing users in the active academy.
 */
export default function AdminUsersPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [form, setForm] = useState<CreateUserForm>({
    username: "",
    fullName: "",
    password: "",
    email: "",
    phone: "",
    role: "STUDENT",
  });

  const filteredUsers = useMemo(() => {
    if (roleFilter === "ALL") {
      return users;
    }

    return users.filter((user) => user.role === roleFilter);
  }, [roleFilter, users]);

  const columns = useMemo<Column<ManagedUser>[]>(
    () => [
      { header: "Name", accessor: "fullName" },
      { header: "Username", accessor: "username" },
      { header: "Role", accessor: "role" },
      { header: "Status", accessor: "status" },
      {
        header: "Code",
        accessor: (item) =>
          item.studentProfile?.studentCode ??
          item.teacherProfile?.teacherCode ??
          item.staffProfile?.staffCode ??
          "-",
      },
    ],
    [],
  );

  const actions = useMemo<TableAction<ManagedUser>[]>(
    () => [
      {
        label: "Toggle Status",
        onClick: (item) => {
          void toggleUserStatus(item);
        },
      },
      {
        label: "Delete",
        onClick: (item) => {
          void deleteUser(item.id);
        },
        variant: "danger",
      },
    ],
    [],
  );

  /**
   * Loads tenant users from admin API.
   */
  async function loadUsers(): Promise<void> {
    setLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/users", { method: "GET" });
      const payload = (await response.json()) as {
        users?: ManagedUser[];
        message?: string;
      };

      if (!response.ok || !payload.users) {
        setStatusMessage(payload.message ?? "Failed to load users.");
        return;
      }

      setUsers(payload.users);
      setCurrentPage(1);
    } catch {
      setStatusMessage("Could not fetch users.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Creates a new user and refreshes the list.
   */
  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatusMessage(payload.message ?? "Failed to create user.");
        return;
      }

      setForm({
        username: "",
        fullName: "",
        password: "",
        email: "",
        phone: "",
        role: "STUDENT",
      });
      setStatusMessage("User created successfully.");
      await loadUsers();
    } catch {
      setStatusMessage("Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Updates user status between active and suspended.
   */
  async function toggleUserStatus(user: ManagedUser): Promise<void> {
    const nextStatus: UserStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setStatusMessage(payload.message ?? "Status update failed.");
      return;
    }

    setStatusMessage("User status updated.");
    await loadUsers();
  }

  /**
   * Deletes a user from the academy.
   */
  async function deleteUser(userId: string): Promise<void> {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setStatusMessage(payload.message ?? "Delete failed.");
      return;
    }

    setStatusMessage("User deleted.");
    await loadUsers();
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">Create User</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreateUser}>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Full name"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Username"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Phone"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, role: event.target.value as Role }))
            }
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Manage Users</h2>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "ALL" | Role)}
          >
            <option value="ALL">ALL</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {statusMessage && (
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
            {statusMessage}
          </p>
        )}

        <div className="mt-4">
          <DataTable
            data={filteredUsers}
            columns={columns}
            actions={actions}
            isLoading={loading}
            totalCount={filteredUsers.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </section>
  );
}
