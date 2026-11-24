import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { EmployeeContactUpdate } from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async directory(user: AuthenticatedUser, departmentId?: string): Promise<Record<string, unknown>[]> {
    const allowed = ["SYSTEM_ADMIN", "HR_MANAGER", "RECRUITER", "LINE_MANAGER", "PAYROLL_OFFICER", "ASSET_OFFICER", "EMPLOYEE"];
    if (!allowed.includes(user.role)) throw new ForbiddenException("FORBIDDEN");
    if (departmentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(departmentId)) {
      throw new BadRequestException("INVALID_DEPARTMENT_ID");
    }
    if (user.role === "LINE_MANAGER" && !user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    const employees = await this.prisma.employee.findMany({
      where: {
        status: { not: "EXITED" },
        ...(departmentId ? { departmentId } : {}),
        ...(user.role === "LINE_MANAGER" ? { managerId: user.employeeId! } : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        legalName: true,
        workEmail: true,
        jobTitle: true,
        status: true,
        department: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ legalName: "asc" }, { employeeCode: "asc" }],
      take: 500,
    });
    return employees;
  }

  async getById(user: AuthenticatedUser, employeeId: string): Promise<Record<string, unknown>> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    const self = user.employeeId === employee.id;
    const team = user.role === "LINE_MANAGER" && employee.managerId === user.employeeId;
    if (user.role === "EMPLOYEE" && !self) throw new ForbiddenException("FORBIDDEN_SCOPE");
    if (user.role === "LINE_MANAGER" && !self && !team) throw new ForbiddenException("FORBIDDEN_SCOPE");
    if (!self && !team && !["SYSTEM_ADMIN", "HR_MANAGER", "RECRUITER", "PAYROLL_OFFICER", "ASSET_OFFICER"].includes(user.role)) {
      throw new ForbiddenException("FORBIDDEN");
    }
    const base = {
      id: employee.id,
      employeeCode: employee.employeeCode,
      legalName: employee.legalName,
      workEmail: employee.workEmail,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      status: employee.status,
      departmentId: employee.departmentId,
      managerId: employee.managerId,
      hireDate: employee.hireDate,
    };
    if (self) return { ...base, personalEmail: employee.personalEmail, phone: employee.phone };
    if (team || user.role === "RECRUITER" || user.role === "ASSET_OFFICER" || user.role === "SYSTEM_ADMIN") return base;
    if (user.role === "HR_MANAGER") return { ...base, phone: employee.phone, personalEmail: employee.personalEmail, baseSalaryUgx: employee.baseSalaryUgx, recurringAllowancesUgx: employee.recurringAllowancesUgx };
    if (user.role === "PAYROLL_OFFICER") return { ...base, baseSalaryUgx: employee.baseSalaryUgx, recurringAllowancesUgx: employee.recurringAllowancesUgx, taxResidency: employee.taxResidency };
    return base;
  }

  async getSelf(userId: string): Promise<Record<string, unknown>> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        department: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, legalName: true, employeeCode: true } },
        workSchedule: { select: { id: true, name: true, shiftStartTime: true, shiftEndTime: true } },
      },
    });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      legalName: employee.legalName,
      workEmail: employee.workEmail,
      personalEmail: employee.personalEmail,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      status: employee.status,
      hireDate: employee.hireDate,
      department: employee.department,
      manager: employee.manager,
      workSchedule: employee.workSchedule,
    };
  }

  async updateSelfContact(userId: string, update: EmployeeContactUpdate): Promise<Record<string, unknown>> {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(update.phone !== undefined ? { phone: update.phone } : {}),
        ...(update.personalEmail !== undefined ? { personalEmail: update.personalEmail } : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        workEmail: true,
        personalEmail: true,
        phone: true,
      },
    });
    return updated;
  }
}
