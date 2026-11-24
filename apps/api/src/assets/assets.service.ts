import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AssetCreate, AssetUpdate } from "@staffhub/shared";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(user: AuthenticatedUser): void {
    if (user.role !== "ASSET_OFFICER" && user.role !== "SYSTEM_ADMIN") throw new ForbiddenException("FORBIDDEN");
  }

  private checksum(action: string, entityId: string): string {
    return createHash("sha256").update(`${action}:${entityId}:${new Date().toISOString()}`).digest("hex");
  }

  list(user: AuthenticatedUser) {
    this.canManage(user);
    return this.prisma.asset.findMany({ include: { assignments: true }, orderBy: { assetTag: "asc" } });
  }

  async mine(user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    return this.prisma.assetAssignment.findMany({
      where: { employeeId: user.employeeId },
      include: { asset: true },
      orderBy: { issuedAt: "desc" },
    });
  }

  async create(user: AuthenticatedUser, input: AssetCreate) {
    this.canManage(user);
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
        assetTag: input.assetTag,
        serialNumber: input.serialNumber,
        name: input.name,
        category: input.category,
        purchaseValueUgx: (input.purchaseValueUgx ?? 0).toString(),
        condition: input.condition ?? "GOOD",
        notes: input.notes,
        },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_REGISTERED", entityType: "Asset", entityId: asset.id,
        checksumSha256: this.checksum("ASSET_REGISTERED", asset.id),
      } });
      return asset;
    });
  }

  async update(user: AuthenticatedUser, id: string, input: AssetUpdate) {
    this.canManage(user);
    const { version, ...fields } = input;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.asset.updateMany({
        where: { id, version },
        data: {
          ...(fields.assetTag !== undefined ? { assetTag: fields.assetTag } : {}),
          ...(fields.serialNumber !== undefined ? { serialNumber: fields.serialNumber } : {}),
          ...(fields.name !== undefined ? { name: fields.name } : {}),
          ...(fields.category !== undefined ? { category: fields.category } : {}),
          ...(fields.purchaseValueUgx !== undefined ? { purchaseValueUgx: fields.purchaseValueUgx.toString() } : {}),
          ...(fields.condition !== undefined ? { condition: fields.condition } : {}),
          ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        const found = await tx.asset.findUnique({ where: { id }, select: { id: true } });
        if (!found) throw new NotFoundException("ASSET_NOT_FOUND");
        throw new ConflictException("ASSET_VERSION_CONFLICT");
      }
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_UPDATED", entityType: "Asset", entityId: id,
        checksumSha256: this.checksum("ASSET_UPDATED", id),
      } });
      return tx.asset.findUniqueOrThrow({ where: { id } });
    });
    return updated;
  }

  async issue(user: AuthenticatedUser, assetId: string, employeeId: string) {
    this.canManage(user);
    const active = await this.prisma.assetAssignment.findFirst({
      where: { assetId, returnedAt: null, status: { in: ["PENDING_ACKNOWLEDGEMENT", "ACKNOWLEDGED"] } },
    });
    if (active) throw new ConflictException("ASSET_ALREADY_ASSIGNED");
    const [asset, employee] = await Promise.all([
      this.prisma.asset.findUnique({ where: { id: assetId } }),
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
    ]);
    if (!asset) throw new NotFoundException("ASSET_NOT_FOUND");
    if (!employee) throw new NotFoundException("EMPLOYEE_NOT_FOUND");
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assetAssignment.create({
        data: { assetId, employeeId, issuedByUserId: user.id, status: "PENDING_ACKNOWLEDGEMENT" },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_ISSUED", entityType: "AssetAssignment", entityId: assignment.id,
        checksumSha256: this.checksum("ASSET_ISSUED", assignment.id),
      } });
      return assignment;
    });
  }

  async acknowledge(user: AuthenticatedUser, assignmentId: string) {
    if (!user.employeeId) throw new ForbiddenException("EMPLOYEE_LINK_REQUIRED");
    const employeeId = user.employeeId;
    const assignment = await this.prisma.assetAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("ASSIGNMENT_NOT_FOUND");
    if (assignment.employeeId !== employeeId) throw new ForbiddenException("FORBIDDEN_SCOPE");
    if (assignment.status !== "PENDING_ACKNOWLEDGEMENT") throw new ConflictException("INVALID_ASSIGNMENT_STATE");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assetAssignment.updateMany({
        where: { id: assignmentId, employeeId, status: "PENDING_ACKNOWLEDGEMENT", returnedAt: null },
        data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException("INVALID_ASSIGNMENT_STATE");
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_ACKNOWLEDGED", entityType: "AssetAssignment", entityId: assignmentId,
        checksumSha256: this.checksum("ASSET_ACKNOWLEDGED", assignmentId),
      } });
      return tx.assetAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    });
  }

  async returnAsset(user: AuthenticatedUser, assignmentId: string, input: { returnCondition: "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST"; notes?: string }) {
    this.canManage(user);
    if ((input.returnCondition === "DAMAGED" || input.returnCondition === "LOST") && !input.notes?.trim()) {
      throw new UnprocessableEntityException("INCIDENT_NOTES_REQUIRED");
    }
    const assignment = await this.prisma.assetAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("ASSIGNMENT_NOT_FOUND");
    return this.prisma.$transaction(async (tx) => {
      const returned = await tx.assetAssignment.updateMany({
        where: { id: assignmentId, returnedAt: null, status: { in: ["ACKNOWLEDGED", "PENDING_ACKNOWLEDGEMENT"] } },
        data: {
          status: "RETURNED",
          returnedAt: new Date(),
          receivedByUserId: user.id,
          returnCondition: input.returnCondition,
          incidentNotes: input.notes?.trim() ?? null,
        },
      });
      if (returned.count !== 1) throw new ConflictException("INVALID_ASSIGNMENT_STATE");
      await tx.asset.update({
        where: { id: assignment.assetId },
        data: { condition: input.returnCondition },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_RETURNED", entityType: "AssetAssignment", entityId: assignmentId,
        reason: input.notes?.trim(), checksumSha256: this.checksum("ASSET_RETURNED", assignmentId),
      } });
      return tx.assetAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    });
  }

  async incident(user: AuthenticatedUser, assignmentId: string, input: { outcome: "CLOSED_DAMAGED" | "CLOSED_LOST"; incidentNotes: string }) {
    this.canManage(user);
    const assignment = await this.prisma.assetAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("ASSIGNMENT_NOT_FOUND");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assetAssignment.updateMany({
        where: { id: assignmentId, returnedAt: null, status: { in: ["ACKNOWLEDGED", "PENDING_ACKNOWLEDGEMENT"] } },
        data: {
        status: "RETURNED",
        returnedAt: new Date(),
        receivedByUserId: user.id,
        returnCondition: input.outcome === "CLOSED_DAMAGED" ? "DAMAGED" : "LOST",
        incidentNotes: input.incidentNotes.trim(),
      },
      });
      if (updated.count !== 1) throw new ConflictException("INVALID_ASSIGNMENT_STATE");
      await tx.asset.update({
        where: { id: assignment.assetId },
        data: { condition: input.outcome === "CLOSED_DAMAGED" ? "DAMAGED" : "LOST" },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id, actorRole: user.role, action: "ASSET_INCIDENT_RECORDED", entityType: "AssetAssignment", entityId: assignmentId,
        reason: input.incidentNotes.trim(), checksumSha256: this.checksum("ASSET_INCIDENT_RECORDED", assignmentId),
      } });
      return tx.assetAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    });
  }
}
