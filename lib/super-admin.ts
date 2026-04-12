export const SUPER_ADMIN_ACADEMY_CODE = "admin-academy";

/**
 * Compares academy code against super admin code using case-insensitive normalization.
 */
export function isSuperAdminAcademyCode(code: string | null | undefined): boolean {
  return (code ?? "").trim().toLowerCase() === SUPER_ADMIN_ACADEMY_CODE;
}
