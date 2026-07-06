/**
 * Auto-fill for agreement TEXT fields.
 *
 * A TEXT field placed on an agreement can be bound to a piece of the student's
 * record (name, register number, father's name, …) so it stamps automatically
 * on the signed PDF instead of asking the student to re-type information the
 * system already knows.
 *
 * How a field gets bound:
 *   1. Explicit — the admin picks a source in the editor, stored in the field's
 *      `defaultValue` as the bare source key (e.g. "name"). This is authoritative.
 *   2. Inferred — if `defaultValue` isn't a known key, the field's label is
 *      keyword-matched (e.g. a field labelled "Father's Name" binds to fatherName).
 *      This makes agreements that were set up before auto-fill existed "just work".
 *
 * The resolved value is computed server-side from the Student row, so it is
 * trustworthy regardless of what the client sends.
 *
 * Pure module (no server-only imports) — safe to import from client components.
 */

/** The subset of the Student record auto-fill can read from. */
export interface AutofillStudent {
  name?: string | null;
  regNo?: string | null;
  email?: string | null;
  mobile?: string | null;
  gender?: string | null;
  accommodation?: string | null;
  boardingPoint?: string | null;
  fatherName?: string | null;
  fatherMobile?: string | null;
  fatherOccupation?: string | null;
  motherName?: string | null;
  motherMobile?: string | null;
  motherOccupation?: string | null;
}

export type AutofillKey = keyof AutofillStudent;

/** Canonical sources shown in the admin picker (order = display order). */
export const AUTOFILL_SOURCES: Array<{ key: AutofillKey; label: string }> = [
  { key: "name", label: "Student name" },
  { key: "regNo", label: "Register number" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile number" },
  { key: "gender", label: "Gender" },
  { key: "accommodation", label: "Accommodation" },
  { key: "boardingPoint", label: "Boarding point" },
  { key: "fatherName", label: "Father's name" },
  { key: "fatherMobile", label: "Father's mobile" },
  { key: "fatherOccupation", label: "Father's occupation" },
  { key: "motherName", label: "Mother's name" },
  { key: "motherMobile", label: "Mother's mobile" },
  { key: "motherOccupation", label: "Mother's occupation" },
];

const AUTOFILL_KEYS = new Set<string>(AUTOFILL_SOURCES.map((s) => s.key));

export function isAutofillKey(v: unknown): v is AutofillKey {
  return typeof v === "string" && AUTOFILL_KEYS.has(v);
}

export function autofillLabel(key: AutofillKey): string {
  return AUTOFILL_SOURCES.find((s) => s.key === key)?.label ?? key;
}

/** Accommodation is stored as an enum-ish string — present it readably. */
function prettyAccommodation(v: string): string {
  const map: Record<string, string> = {
    HOSTEL: "Hostel",
    DAY_SCHOLAR: "Day Scholar",
  };
  return map[v] ?? v;
}

/**
 * Infer a source from a field label when no explicit source is set. Parent
 * checks come first so "Father's Name" doesn't match the generic "name" rule.
 */
function inferFromLabel(label: string | null | undefined): AutofillKey | null {
  const l = (label ?? "").toLowerCase().trim();
  if (!l) return null;

  const has = (...words: string[]) => words.every((w) => l.includes(w));
  const contact = (kind: "father" | "mother") =>
    has(kind, "mobile") || has(kind, "phone") || has(kind, "contact") || has(kind, "number");

  if (l.includes("father")) {
    if (has("father", "occupation")) return "fatherOccupation";
    if (contact("father")) return "fatherMobile";
    if (l.includes("name")) return "fatherName";
  }
  if (l.includes("mother") || l.includes("guardian")) {
    if (has("mother", "occupation")) return "motherOccupation";
    if (contact("mother")) return "motherMobile";
    if (l.includes("name")) return "motherName";
  }

  if (l.includes("register") || l.includes("registration") || l.includes("reg no") || l.includes("regno") || l.includes("roll"))
    return "regNo";
  if (l.includes("email") || l.includes("e-mail")) return "email";
  if (l.includes("gender") || l.includes("sex")) return "gender";
  if (l.includes("accommodation") || l.includes("hostel") || l.includes("day scholar")) return "accommodation";
  if (l.includes("boarding")) return "boardingPoint";
  if ((l.includes("mobile") || l.includes("phone") || l.includes("contact")) && !l.includes("user"))
    return "mobile";
  // Generic "name" last, and never a login/username field.
  if (l.includes("name") && !l.includes("user")) return "name";

  return null;
}

/**
 * The auto-fill source bound to a TEXT field, or null if it's a free-text
 * field the student fills in manually. Non-TEXT fields always return null.
 */
export function autofillSourceForField(field: {
  fieldType: string;
  defaultValue?: string | null;
  label?: string | null;
}): AutofillKey | null {
  if (field.fieldType !== "TEXT") return null;
  const explicit = (field.defaultValue ?? "").trim();
  if (isAutofillKey(explicit)) return explicit;
  return inferFromLabel(field.label);
}

/** Resolve a source key to a display string from the student record. */
export function resolveAutofillValue(key: AutofillKey, student: AutofillStudent): string {
  const raw = student[key];
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (key === "accommodation") return prettyAccommodation(s);
  return s;
}

/**
 * Convenience: resolve a field's auto-fill value directly, or null if the
 * field isn't auto-filled. An auto-filled field with no data on the student
 * resolves to "" (stamps blank) rather than null.
 */
export function resolveFieldAutofill(
  field: { fieldType: string; defaultValue?: string | null; label?: string | null },
  student: AutofillStudent
): { key: AutofillKey; value: string } | null {
  const key = autofillSourceForField(field);
  if (!key) return null;
  return { key, value: resolveAutofillValue(key, student) };
}
