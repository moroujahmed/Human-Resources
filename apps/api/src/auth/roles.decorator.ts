import { SetMetadata } from "@nestjs/common";
import type { StaffHubRole } from "@staffhub/shared";
import { ROLES_KEY } from "./roles.guard";

export const Roles = (...roles: StaffHubRole[]) => SetMetadata(ROLES_KEY, roles);
