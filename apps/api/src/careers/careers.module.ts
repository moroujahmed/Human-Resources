import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CareersController } from "./careers.controller";
import { CareersService } from "./careers.service";
import { PrivateStorageService } from "../storage/private-storage.service";

@Module({
  controllers: [CareersController],
  providers: [PrismaService, CareersService, PrivateStorageService],
})
export class CareersModule {}
