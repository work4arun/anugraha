"use client";

/**
 * Inline, scrollable render of an agreement PDF (via pdf.js). Calls
 * `onReadThrough` once the student has scrolled to the end (or immediately,
 * if the whole document fits without scrolling / the preview fails and a
 * "View" link elsewhere is the backup way to read it).
 *
 * Shared by the dashboard's read-only agreements summary and the dedicated
 * full-page signing step — both need the same "must actually reach the end
 * of the document" gate before a Sign action is allowed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// pdf.js worker (same pinned version as the admin placement editor).
const PDF_WORKER_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export function AgreementInlinePreview({
  url,
  onReadThrough,
  maxHeight = 420,
}: {
  url: string;
  onReadThrough: () => void;
  maxHeight?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Split "something is on screen" from "every page is rendered": we hide the
  // loading overlay the moment the first page paints (so the student isn't
  // staring at a blank bar), but keep status="loading" until the whole
  // document is rendered so the end-of-document detector never fires early.
  const [firstPageShown, setFirstPageShown] = useState(false);

  const fire = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onReadThrough();
    }
  }, [onReadThrough]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        const host = pagesRef.current;
        if (!host) return;
        host.innerHTML = "";
        const cssWidth = Math.min(host.clientWidth || 560, 800);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.borderBottom = "1px solid #E5E7EB";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          // First page is on screen — clear the loading overlay right away.
          if (i === 1) setFirstPageShown(true);
        }
        if (cancelled) return;
        setStatus("ready");
      } catch (err) {
        console.error("[agreements] inline preview failed", err);
        if (!cancelled) {
          setStatus("error");
          // Don't lock the student out of signing over a render issue — the
          // "View" link remains as the way to read the document.
          fire();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, fire]);

  // "Reached the end" detection via IntersectionObserver on a sentinel placed
  // right after the last rendered page. This is set up only once all pages
  // have finished rendering (status === "ready"), so it never fires against a
  // scrollHeight that's still growing mid-render. It also naturally covers
  // "the whole document fits without scrolling" — the sentinel is visible in
  // the viewport the moment the observer attaches — and is immune to the
  // rounding/zoom quirks that plain scrollTop/scrollHeight math can hit.
  useEffect(() => {
    if (status !== "ready") return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fire();
      },
      { root, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, fire]);

  return (
    <div className="mt-3 border border-surface-border rounded-xl overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          // Fallback in case IntersectionObserver is unavailable/unreliable
          // in some environment — belt and suspenders.
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) fire();
        }}
        className="overflow-y-auto bg-surface-muted"
        style={{ maxHeight }}
      >
        <div ref={pagesRef} />
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
        {/* Initial load: skeleton + spinner until the first page paints. */}
        {status === "loading" && !firstPageShown && (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-8">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
            <p className="text-center text-sm font-medium text-ink">
              Getting your agreement ready…
            </p>
            <p className="text-center text-xs text-ink-muted">
              This can take a few seconds. Please don&apos;t close this page.
            </p>
          </div>
        )}
        {/* First page is visible but later pages are still rendering. */}
        {status === "loading" && firstPageShown && (
          <p className="flex items-center justify-center gap-1.5 py-3 text-center text-xs text-ink-muted">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading the rest of the document…
          </p>
        )}
        {status === "error" && (
          <p className="p-8 text-center text-xs text-error">
            Could not load the preview — use the View link above to read the agreement.
          </p>
        )}
      </div>
    </div>
  );
}
