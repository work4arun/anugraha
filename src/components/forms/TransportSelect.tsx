"use client";

/**
 * TransportSelect — a cascading Route → Boarding Point picker.
 *
 * The student first chooses a bus route from a dropdown; once a route is
 * selected, a second dropdown lists only the boarding points for that route.
 * The stored value is { route, boardingPoint }.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Bus, MapPin } from "lucide-react";
import type { TransportRoute } from "@/types";

export interface TransportValue {
  route?: string;
  boardingPoint?: string;
}

interface Props {
  label: string;
  routes: TransportRoute[];
  value: TransportValue | null | undefined;
  onChange: (value: TransportValue) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function TransportSelect({
  label,
  routes,
  value,
  onChange,
  required,
  disabled,
  error,
}: Props) {
  const selected = value ?? {};
  const selectedRoute = routes.find((r) => r.route === selected.route);

  function handleRouteChange(routeName: string) {
    // Reset the boarding point whenever the route changes.
    onChange({ route: routeName || undefined, boardingPoint: undefined });
  }

  function handleBoardingChange(bp: string) {
    onChange({ ...selected, boardingPoint: bp || undefined });
  }

  const selectClass =
    "w-full px-4 py-3 text-base text-ink bg-white border rounded-xl min-h-[48px] transition-all " +
    "focus:outline-none focus:ring-3 disabled:opacity-50 " +
    (error
      ? "border-error focus:border-error focus:ring-error/10"
      : "border-surface-border focus:border-brand focus:ring-brand/10");

  return (
    <div className="flex flex-col gap-3">
      {/* Route */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink flex items-center gap-1.5">
          <Bus className="w-4 h-4 text-brand" />
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
        <select
          className={selectClass}
          value={selected.route ?? ""}
          disabled={disabled}
          onChange={(e) => handleRouteChange(e.target.value)}
        >
          <option value="">Select your bus route…</option>
          {routes.map((r) => (
            <option key={r.route} value={r.route}>
              {r.route}
            </option>
          ))}
        </select>
      </div>

      {/* Boarding point — only once a route is chosen */}
      <AnimatePresence initial={false}>
        {selectedRoute && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            <label className="text-sm font-medium text-ink flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-accent" />
              Boarding Point
              {required && <span className="text-error ml-0.5">*</span>}
            </label>
            <select
              className={selectClass}
              value={selected.boardingPoint ?? ""}
              disabled={disabled}
              onChange={(e) => handleBoardingChange(e.target.value)}
            >
              <option value="">Select your boarding point…</option>
              {selectedRoute.boardingPoints.map((bp) => (
                <option key={bp} value={bp}>
                  {bp}
                </option>
              ))}
            </select>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
