"use client";

/**
 * Student-facing agreements STATUS summary (dashboard).
 *
 * This is read-only — it lists the batch's active agreements and each one's
 * signing status, with a link into the dedicated full-page signing step
 * (/induction/agreements) for anything still pending. The actual reviewing
 * and signing happens only on that page, which forces the student to scroll
 * through the whole document and draw a fresh signature; it deliberately
 * does not happen here, so signing can never feel like a passive side effect
 * of poking around the dashboard.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, ExternalLink, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AgreementItem {
  id: string;
  name: string;
  originalPdfUrl: string;
  status: "PENDING" | "PARTIAL" | "COMPLETED";
  signedPdfUrl: string | null;
}

export function AgreementsCard() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<AgreementItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/student/agreements");
      const data = await res.json();
      setAgreements(res.ok && data.success ? data.data : []);
    } catch {
      setAgreements([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nothing to show (still loading renders nothing too — the dashboard
  // shouldn't jump for students whose batch has no agreements).
  if (!agreements || agreements.length === 0) return null;

  const pendingCount = agreements.filter((a) => a.status !== "COMPLETED").length;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1 mb-3">
        Agreements (final step)
      </h2>
      <div className="flex flex-col gap-3">
        {agreements.map((a) => {
          const done = a.status === "COMPLETED";
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-surface-border bg-white p-4"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  done ? "bg-success-light" : "bg-brand-50"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <FileSignature className="w-5 h-5 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{a.name}</p>
                <Badge variant={done ? "success" : "warning"} dot className="mt-1">
                  {done ? "Signed" : a.status === "PARTIAL" ? "Partially signed" : "Awaiting your signature"}
                </Badge>
              </div>
              <a
                href={done && a.signedPdfUrl ? a.signedPdfUrl : a.originalPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand font-medium shrink-0 min-h-[44px] px-1"
              >
                View <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          );
        })}
      </div>
      {pendingCount > 0 && (
        <Button
          size="sm"
          fullWidth
          className="mt-3"
          onClick={() => router.push("/induction/agreements")}
          icon={<FileSignature className="w-4 h-4" />}
          iconRight={<ChevronRight className="w-4 h-4" />}
        >
          Sign {pendingCount} agreement{pendingCount === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  );
}
