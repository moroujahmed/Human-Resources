import { Controller, Get } from "@nestjs/common";
import {
  ApiHealthResponse,
  ApiHealthResponseSchema,
} from "@staffhub/shared";

@Controller()
export class HealthController {
  @Get("health")
  getHealth(): ApiHealthResponse {
    return ApiHealthResponseSchema.parse({ status: "ok", service: "api" });
  }
}
