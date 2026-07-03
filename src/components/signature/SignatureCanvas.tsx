"use client";

/**
 * SignatureCanvas — touch-first, scroll-locked signature capture.
 *
 * Features:
 *  - Canvas draw with mouse & finger
 *  - Scroll-lock on the document while actively drawing (prevents accidental page scroll)
 *  - Clear / Confirm actions
 *  - "Reuse signature" flow when a prior signature is available
 *  - Animated ink-dry confirmation state
 *  - Exports PNG as base64 data URL
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Check, RefreshCw, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { signatureConfirm } from "@/lib/motion";

interface SignatureCanvasProps {
  label?: string;
  required?: boolean;
  existingSignatureUrl?: string | null; // offer to reuse
  onConfirm: (dataUrl: string) => void | Promise<void>;
  onClear?: () => void;
  className?: string;
  disabled?: boolean;
}

export interface SignatureCanvasRef {
  clear: () => void;
  getDataUrl: () => string | null;
}

type DrawState = "empty" | "drawing" | "confirmed";

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(
  (
    {
      label = "Signature",
      required = false,
      existingSignatureUrl,
      onConfirm,
      onClear,
      className,
      disabled = false,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const [drawState, setDrawState] = useState<DrawState>("empty");
    const [hasStrokes, setHasStrokes] = useState(false);
    const [confirmedUrl, setConfirmedUrl] = useState<string | null>(null);
    const [offerReuse, setOfferReuse] = useState(!!existingSignatureUrl);
    const [confirming, setConfirming] = useState(false);

    // ── Canvas setup ─────────────────────────────────────────────────────

    const setupCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#3E7D25"; // brand green ink (readable on white)
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    useEffect(() => {
      setupCanvas();
    }, [setupCanvas]);

    // ── Coordinate helpers ────────────────────────────────────────────────

    function getPoint(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }

    // ── Drawing ───────────────────────────────────────────────────────────

    function startDrawing(e: React.TouchEvent | React.MouseEvent) {
      if (disabled || drawState === "confirmed") return;
      e.preventDefault();
      isDrawingRef.current = true;
      const pt = getPoint(e);
      lastPointRef.current = pt;
      setDrawState("drawing");

      // Lock scroll while signing
      document.documentElement.classList.add("signature-active");
    }

    function draw(e: React.TouchEvent | React.MouseEvent) {
      if (!isDrawingRef.current || disabled) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !lastPointRef.current) return;

      const pt = getPoint(e);
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPointRef.current = pt;
      setHasStrokes(true);
    }

    function stopDrawing() {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;
      document.documentElement.classList.remove("signature-active");
    }

    // ── Actions ───────────────────────────────────────────────────────────

    function clearCanvas() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasStrokes(false);
      setDrawState("empty");
      setConfirmedUrl(null);
      onClear?.();
    }

    async function handleConfirm() {
      const canvas = canvasRef.current;
      if (!canvas || !hasStrokes) return;
      setConfirming(true);

      const dataUrl = canvas.toDataURL("image/png");
      setConfirmedUrl(dataUrl);
      setDrawState("confirmed");

      try {
        await onConfirm(dataUrl);
      } finally {
        setConfirming(false);
      }
    }

    async function handleReuseExisting() {
      if (!existingSignatureUrl) return;
      setConfirmedUrl(existingSignatureUrl);
      setDrawState("confirmed");
      setOfferReuse(false);
      await onConfirm(existingSignatureUrl);
    }

    // ── Ref ────────────────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      clear: clearCanvas,
      getDataUrl: () => confirmedUrl,
    }));

    // ── Render ─────────────────────────────────────────────────────────────

    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {/* Label */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink">
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </label>
          {drawState !== "empty" && drawState !== "confirmed" && (
            <button
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-error transition-colors min-h-[44px] px-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Reuse offer */}
        <AnimatePresence>
          {offerReuse && existingSignatureUrl && drawState === "empty" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl border border-brand/20"
            >
              <div className="w-16 h-8 bg-white rounded border border-brand/20 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existingSignatureUrl}
                  alt="Previous signature"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-brand">Use existing signature?</p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Your signature from a previous step
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleReuseExisting}
                  className="text-xs h-8"
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOfferReuse(false)}
                  className="text-xs h-8"
                >
                  Draw new
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className={cn(
            "relative rounded-2xl border-2 overflow-hidden",
            "bg-white",
            drawState === "confirmed"
              ? "border-success/40"
              : drawState === "drawing"
              ? "border-brand"
              : "border-dashed border-surface-border hover:border-brand/40",
            "transition-colors duration-200",
            disabled && "opacity-50 pointer-events-none"
          )}
          style={{ height: 140 }}
        >
          {/* Placeholder text */}
          <AnimatePresence>
            {drawState === "empty" && !offerReuse && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2"
              >
                <PenLine className="w-6 h-6 text-ink-faint" />
                <p className="text-sm text-ink-faint">Sign here</p>
                <p className="text-xs text-ink-faint">Use your finger or stylus</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirmed state overlay */}
          <AnimatePresence>
            {drawState === "confirmed" && confirmedUrl && (
              <motion.div
                variants={signatureConfirm}
                initial="signing"
                animate="confirmed"
                className="absolute inset-0 flex items-center justify-center"
              >
                <img
                  src={confirmedUrl}
                  alt="Signature"
                  className="max-w-full max-h-full object-contain p-2"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 w-full h-full touch-none",
              drawState === "confirmed" && "opacity-0 pointer-events-none"
            )}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ cursor: disabled ? "not-allowed" : "crosshair" }}
          />
        </div>

        {/* Actions row */}
        <div className="flex gap-2">
          {drawState === "confirmed" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCanvas}
              icon={<RefreshCw className="w-4 h-4" />}
              fullWidth
            >
              Re-sign
            </Button>
          ) : (
            <>
              {hasStrokes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCanvas}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={!hasStrokes}
                loading={confirming}
                icon={<Check className="w-4 h-4" />}
                fullWidth={!hasStrokes}
              >
                Confirm Signature
              </Button>
            </>
          )}
        </div>

        {/* Confirmed indicator */}
        <AnimatePresence>
          {drawState === "confirmed" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 text-xs text-success font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              Signature confirmed
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

SignatureCanvas.displayName = "SignatureCanvas";
