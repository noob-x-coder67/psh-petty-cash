import { z } from "zod";

// Mirrors what the API actually returns from POST /expenses/:id/attachments — metadata
// only, never the raw bytes (data/storageKey are stripped server-side before the
// response is built).
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  voucherId: z.string().uuid(),
  driver: z.enum(["POSTGRES_BYTEA", "FILESYSTEM"]),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string(),
  pageNo: z.number().int(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().uuid().nullable(),
  archiveId: z.string().uuid().nullable(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
