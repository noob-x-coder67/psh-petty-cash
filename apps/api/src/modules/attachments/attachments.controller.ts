import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AttachmentsService, UPLOAD_MAX_BYTES } from "./attachments.service";

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post("expenses/:id/attachments")
  @RequiresPermission("attachment.upload")
  @RequiresUnitScope("derived")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  async upload(
    @Param("id") voucherId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException("A file is required");
    }
    return this.attachmentsService.upload({
      voucherId,
      originalName: file.originalname,
      bytes: file.buffer,
      actor: user,
    });
  }

  @Get("attachments/:id/view")
  @RequiresPermission("receipt.view")
  @RequiresUnitScope("derived")
  async view(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType } = await this.attachmentsService.openForView(id, user);
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new StreamableFile(stream);
  }

  @Get("attachments/:id/download")
  @RequiresPermission("receipt.view")
  @RequiresUnitScope("derived")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType } = await this.attachmentsService.openForView(id, user);
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new StreamableFile(stream);
  }
}
