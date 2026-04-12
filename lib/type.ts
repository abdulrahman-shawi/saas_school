import { LucideIcon } from "lucide-react";

export type AccountType =
  | "PLATFORM_ADMIN"
  | "ACADEMY_ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "STAFF"
  | string;

export interface UserPermissionMap {
  [permissionKey: string]: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  avatar?: string | null;
  academyCode?: string;
  academyName?: string;
  accountType?: AccountType;
  permission?: UserPermissionMap;
}

export interface NavLink {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  icon?: LucideIcon;
  links: NavLink[];
}

export interface NavItem {
  title: string;
  href?: string;
  isMega?: boolean;
  sections?: NavSection[];
}
