/**
 * College bus routes and their boarding points.
 *
 * ⚠️ PLACEHOLDER DATA — replace with the real routes/boarding points from
 * "Bus Fees 2026-2027.pdf". Each route lists the stops (boarding points) that
 * appear under it, and the annual fee if you want it shown in the dropdown.
 *
 * This is the single source of truth for the cascading Transport selector on
 * the Registration form (field type "transport_select"). After editing this,
 * reseed (npm run db:seed) so the registration template picks up the changes.
 */

import type { TransportRoute } from "@/types";

export const TRANSPORT_ROUTES: TransportRoute[] = [
  {
    route: "Route 1 — Gandhipuram",
    fee: "₹—",
    boardingPoints: ["Gandhipuram", "Town Hall", "Ukkadam", "Sungam"],
  },
  {
    route: "Route 2 — Saibaba Colony",
    fee: "₹—",
    boardingPoints: ["Saibaba Colony", "Sai Baba Temple", "Thudiyalur", "Vadavalli"],
  },
  {
    route: "Route 3 — Peelamedu",
    fee: "₹—",
    boardingPoints: ["Peelamedu", "Hope College", "Avinashi Road", "Singanallur"],
  },
];
