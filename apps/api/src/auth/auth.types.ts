import type { StaffHubRole } from "@staffhub/shared";

export interface AccessTokenPayload {
  sub: string;
  role: StaffHubRole;
  employeeId: string | null;
  authzVersion: number;
  jti: string;
  scope?: "PASSWORD_RESET_ONLY";
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: StaffHubRole;
  employeeId: string | null;
  authzVersion: number;
  mustChangePassword: boolean;
}
