import { Body, Controller, Get, Post, Param, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { CareersService } from "./careers.service";
import { Throttle } from "@nestjs/throttler";

@Controller("careers")
export class CareersController {
  constructor(private readonly careers: CareersService) {}

  @Get("vacancies")
  vacancies(@Query("search") search: string | undefined, @Query("departmentId") departmentId: string | undefined) {
    return this.careers.vacancies(search, departmentId);
  }

  @Post("vacancies/:id/apply")
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @UseInterceptors(FileInterceptor("cv", {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  }))
  apply(
    @Param("id") id: string,
    @Body() body: unknown,
    @UploadedFile() cv: Express.Multer.File,
  ) {
    return this.careers.apply(id, body, cv);
  }
}
