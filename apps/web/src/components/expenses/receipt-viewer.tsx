import type { Attachment } from "@psh/contracts";
import { FileText } from "lucide-react";

// <img>/<a> go straight through the /api/* rewrite so the session cookie rides along
// same-origin — no signed URLs or token handling needed for a private attachment.
export function ReceiptViewer({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-ink-muted">No receipt attached.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-card border border-border p-3">
          {attachment.mimeType.startsWith("image/") ? (
            // Plain <img>, not next/image — this is private, cookie-authenticated bytes
            // streamed through the API; next/image's remote optimizer can't proxy these.
            <img
              src={`/api/attachments/${attachment.id}/view`}
              alt={`Receipt page ${attachment.pageNo} for ${attachment.fileName}`}
              className="max-h-96 w-full rounded-control object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm text-ink">
              <FileText className="h-5 w-5" aria-hidden />
              {attachment.fileName}
            </div>
          )}
          <div className="mt-2 flex gap-3 text-xs">
            <a
              href={`/api/attachments/${attachment.id}/view`}
              target="_blank"
              rel="noreferrer"
              className="text-royal-600 underline"
            >
              View
            </a>
            <a href={`/api/attachments/${attachment.id}/download`} className="text-royal-600 underline">
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
