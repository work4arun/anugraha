"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  Printer,
  Home,
  Sparkles,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import {
  finishLineContainer,
  finishLineItem,
  sectionComplete,
} from "@/lib/motion";

export default function CompletePage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [generating, setGenerating] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cheap, read-only check — does NOT generate anything, just looks at
  // whatever pdfUrl the student record already has.
  function checkForPdf({ silent = false }: { silent?: boolean } = {}) {
    setChecking(true);
    return fetch("/api/student/profile")
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          throw new Error(d?.error || "Couldn't check your PDF status");
        }
        return d;
      })
      .then((d) => {
        if (!mountedRef.current) return;
        if (d.data?.pdfUrl) setPdfUrl(d.data.pdfUrl);
        if (d.data?.name) setStudentName(d.data.name.split(" ")[0]);
      })
      .catch((err) => {
        if (!mountedRef.current || silent) return;
        toast.error(
          err instanceof Error ? err.message : "Couldn't check your PDF status"
        );
      })
      .finally(() => {
        if (mountedRef.current) setChecking(false);
      });
  }

  // Actually generate the PDF. This page can be reached without ever having
  // triggered generation (e.g. the dashboard's "View & Download PDF" button
  // jumps straight here once all steps + agreements are done, without ever
  // calling /api/pdf) — in that case pdfUrl is null forever unless something
  // here actually calls the generate endpoint, not just re-checks the same
  // never-generated value.
  function generatePdf() {
    setGenerating(true);
    return fetch("/api/pdf", { method: "POST" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          if (d?.code === "AGREEMENTS_PENDING") {
            throw new Error(
              `${d.error} Go back to your dashboard to finish signing.`
            );
          }
          throw new Error(d?.error || "Could not generate your PDF — please try again");
        }
        return d;
      })
      .then(() => {
        if (!mountedRef.current) return;
        toast.success("PDF ready!");
        return checkForPdf();
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        toast.error(err instanceof Error ? err.message : "Could not generate your PDF");
      })
      .finally(() => {
        if (mountedRef.current) setGenerating(false);
      });
  }

  useEffect(() => {
    // Fetch the current student's PDF URL from their profile. Silent on
    // mount — an error here shouldn't greet the student with a toast;
    // it'll surface if they hit the button below and it still fails.
    checkForPdf({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12">
      {/* Confetti-like decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full opacity-30"
            style={{
              backgroundColor: i % 2 === 0 ? "#8DC63F" : "#27AAE1",
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 20}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 180, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <motion.div
        variants={finishLineContainer}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm flex flex-col items-center gap-6 relative"
      >
        {/* Big success icon */}
        <motion.div variants={finishLineItem}>
          <motion.div
            variants={sectionComplete}
            initial="hidden"
            animate="visible"
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-success to-green-500 flex items-center justify-center shadow-lg"
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>
        </motion.div>

        {/* Headline */}
        <motion.div variants={finishLineItem} className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">
              Induction Complete
            </span>
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2">
            {studentName ? `You did it, ${studentName}!` : "You did it!"}
          </h1>
          <p className="text-base text-ink-muted leading-relaxed">
            Your Anugraha 2026 induction is complete. Download your PDF, print it,
            and present it at the gate on Day One.
          </p>
        </motion.div>

        {/* PDF actions */}
        <motion.div variants={finishLineItem} className="w-full flex flex-col gap-3">
          {pdfUrl ? (
            <>
              <Button
                size="lg"
                fullWidth
                icon={<Download className="w-5 h-5" />}
                onClick={() => window.open(pdfUrl, "_blank")}
              >
                Download PDF
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="outline"
                icon={<Printer className="w-5 h-5" />}
                onClick={() => {
                  const win = window.open(pdfUrl, "_blank");
                  win?.addEventListener("load", () => win.print());
                }}
              >
                Print PDF
              </Button>
            </>
          ) : (
            <div className="bg-surface-muted rounded-2xl p-4 text-center space-y-3">
              <p className="text-sm text-ink-muted">
                {generating
                  ? "Generating your PDF — this can take up to a minute…"
                  : "Your PDF hasn't been generated yet."}
              </p>
              <Button
                size="md"
                fullWidth
                icon={<FileDown className="w-4 h-4" />}
                onClick={generatePdf}
                loading={generating}
                disabled={checking}
              >
                Generate PDF
              </Button>
              <Button
                size="sm"
                fullWidth
                variant="ghost"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => checkForPdf()}
                loading={checking}
                disabled={generating}
              >
                Already generated elsewhere? Refresh
              </Button>
            </div>
          )}
        </motion.div>

        {/* Instruction */}
        <motion.div
          variants={finishLineItem}
          className="w-full bg-brand-50 border border-brand/20 rounded-2xl p-4"
        >
          <p className="text-sm font-semibold text-brand mb-1">What to do next</p>
          <ol className="text-sm text-ink-muted space-y-1.5 list-decimal list-inside">
            <li>Download and print your Anugraha 2026 PDF</li>
            <li>Bring the printed copy to campus on Day One</li>
            <li>Submit it at the reporting gate / admission desk</li>
          </ol>
        </motion.div>

        {/* Back to dashboard */}
        <motion.div variants={finishLineItem}>
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand transition-colors min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
