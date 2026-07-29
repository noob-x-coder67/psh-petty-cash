import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const AUDITED_KEY = "audited";

export interface AuditedMetadata {
  action: string | string[];
  entityType: string;
}

/**
 * Declares which audit_logs action/entityType a mutating route is expected to
 * produce (rule 16, FR-AUD-002). Purely descriptive metadata, read by the
 * audit-coverage test via Reflector — it does not perform the write itself.
 * The actual row is still written by AuditLogRepository.record(tx, ...) as the
 * last statement inside the handler's own $transaction (ADR-0005: that existing,
 * proven-atomic pattern is unchanged by this decorator).
 */
export const Audited = (metadata: AuditedMetadata): CustomDecorator<string> => SetMetadata(AUDITED_KEY, metadata);
