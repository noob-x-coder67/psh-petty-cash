import { Module } from "@nestjs/common";
import { ATTACHMENT_STORAGE, type AttachmentStorage } from "./storage.interface";
import { PostgresByteaStorageDriver } from "./postgres-bytea.driver";
import { FilesystemStorageDriver } from "./filesystem.driver";

// ATTACHMENT_STORAGE_DRIVER selects the driver (default: postgres-bytea, the demo mode).
@Module({
  providers: [
    PostgresByteaStorageDriver,
    FilesystemStorageDriver,
    {
      provide: ATTACHMENT_STORAGE,
      useFactory: (
        bytea: PostgresByteaStorageDriver,
        filesystem: FilesystemStorageDriver,
      ): AttachmentStorage => (process.env.ATTACHMENT_STORAGE_DRIVER === "filesystem" ? filesystem : bytea),
      inject: [PostgresByteaStorageDriver, FilesystemStorageDriver],
    },
  ],
  exports: [ATTACHMENT_STORAGE],
})
export class StorageModule {}
