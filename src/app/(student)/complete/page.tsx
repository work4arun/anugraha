"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  Printer,
  Home,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  finishLineContainer,
  finishLineItem,
  sectionComplete,
} from "@/lib/motion";

const WAIT_SECONDS = 120;

export default function CompletePage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("Congratulations");
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  // Poll for the PDF in the background — once the merge finishes, this
  // picks it up without the student needing to do anything.
  useEffect(() => {
    let cancelled = false;
    function fetchProfile() {
      fetch("/api/student/profile")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d.data?.pdfUrl) setPdfUrl(d.data.pdfUrl);
          if (d.data?.name) setStudentName(d.data.name.split(" ")[0]);
        })
        .catch(() => null);
    }
    fetchProfile();
    const pollId = setInterval(fetchProfile, 5000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  // Visible 2-minute countdown to keep students engaged while the final
  // PDF merges in the background. It counts down once and stops — the
  // actual "refresh" happens silently via the polling above, which swaps
  // in the download button the moment the PDF is ready. No page reload.
  useEffect(() => {
    if (pdfUrl || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, pdfUrl]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

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
            You did it, {studentName}!
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
            <div className="bg-surface-muted rounded-2xl p-5 text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-brand animate-spin" />
                <p className="text-sm font-semibold text-ink">
                  Finalizing your PDF…
                </p>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                We&apos;re merging all your documents into your final Anugraha
                2026 PDF. This usually takes about 2 minutes.
              </p>
              <div className="text-2xl font-bold text-brand tabular-nums tracking-wide">
                {mm}:{ss}
              </div>
              <p className="text-xs text-ink-muted">
                {secondsLeft > 0
                  ? "Please wait — this page updates automatically once it's ready."
                  : "Almost there — still finishing up. Hang tight, or tap refresh below."}
              </p>
              <Button
                size="md"
                fullWidth
                variant="outline"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={() => window.location.reload()}
              >
                Refresh Now
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
