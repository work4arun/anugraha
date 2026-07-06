/**
 * Shared TypeScript types for Rathinam MyDayOne
 */

// ── Form Template Schema Types ─────────────────────────────────────────────

export type FieldType =
  | "text"
  | "tel"
  | "email"
  | "number"
  | "date"
  | "radio"
  | "checkbox"
  | "select"
  | "textarea"
  | "transport_select"
  | "section_header";

// A bus route and its boarding points (for the cascading Transport selector).
export interface TransportRoute {
  route: string;            // e.g. "Route 1 — Gandhipuram"
  fee?: string;             // annual fee, e.g. "₹18,000"
  boardingPoints: string[]; // e.g. ["Gandhipuram", "Town Hall", ...]
}

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
  maxLength?: number;
  pattern?: string;
  hint?: string;
  options?: string[];
  defaultValue?: string | boolean;
  defaultToday?: boolean; // for date fields
  characterBoxed?: boolean; // render as character-boxed input (like exam forms)
  sensitive?: boolean; // e.g. Aadhaar — mask in UI
  showWhen?: { field: string; value: string | boolean }; // conditional display
  routes?: TransportRoute[]; // for type "transport_select": route → boarding points
}

export interface RegistrationSchema {
  fields: FieldDefinition[];
  declaration: string;
  /** Admin option: students may submit this step incomplete ("Skip for now"). */
  allowSkip?: boolean;
}

export interface AcknowledgmentSchema {
  clauses: string[];
  acknowledgmentText: string;
  guaranteeDeclaration?: string; // for placement undertaking (parent-facing)
  place: { id: string; label: string; required: boolean };
  date: { id: string; label: string; required: boolean; defaultToday?: boolean };
  /** Admin option: students may submit this step incomplete ("Skip for now"). */
  allowSkip?: boolean;
}

export interface DeliverableRow {
  id: string;
  sno: number;
  deliverable: string;
  keyPoints: string;
}

export interface DeliverableTableSchema {
  programmeHeader?: { label: string; value: string };
  rows: DeliverableRow[];
  declaration: string;
  place: { id: string; label: string; required: boolean };
  date: { id: string; label: string; required: boolean; defaultToday?: boolean };
  /** Admin option: students may submit this step incomplete ("Skip for now"). */
  allowSkip?: boolean;
}

export interface DocumentDefinition {
  id: string;
  type: string;
  label: string;
  required: boolean;
  accept: string;
  maxSizeMB: number;
  hint?: string;
}

export interface DocumentUploadSchema {
  documents: DocumentDefinition[];
  /**
   * Admin option: when true, students may complete this step without
   * uploading all required documents (a "Skip for now" button appears).
   */
  allowSkip?: boolean;
}

export type FormSchema =
  | RegistrationSchema
  | AcknowledgmentSchema
  | DeliverableTableSchema
  | DocumentUploadSchema;

// ── Signatory Role ─────────────────────────────────────────────────────────

export interface SignatoryRole {
  role: "student" | "parent" | "authorized_signatory";
  label: string;
}

// ── Step / Progress ────────────────────────────────────────────────────────

export type StepStatus = "not_started" | "in_progress" | "completed";

export interface InductionStep {
  id: string;
  order: number;
  stepSlug: string;
  name: string;
  type: "REGISTRATION" | "ACKNOWLEDGMENT" | "DELIVERABLES_TABLE" | "DOCUMENT_UPLOAD";
  required: boolean;
  status: StepStatus;
  formTemplateId: string;
}

// ── Student Profile ─────────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  regNo: string;
  name: string;
  email?: string;
  mobile?: string;
  photoUrl?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LOCKED";
  completionPct: number;
  mustResetPassword: boolean;
  batch: {
    id: string;
    name: string;
    course: string;
    academicYear: string;
    logoUrl?: string;
    institution: {
      code: string;
      name: string;
      fullName: string;
      primaryColor?: string;
      accentColor?: string;
    };
  };
  steps: InductionStep[];
  // True once every required form step is submitted — independent of
  // agreements. `completionPct` folds BOTH form steps and agreements
  // together, so it can be < 100 even when this is true (agreement still
  // pending); use this flag when the UI needs to distinguish "forms done,
  // waiting on a signature" from "fully done".
  formStepsDone: boolean;
  // Active agreements for this batch the student hasn't fully signed yet.
  // Agreements act as the final step of induction — the final PDF can't be
  // generated while any of these remain.
  agreementsPending: Array<{ id: string; name: string }>;
}

// ── Admin Dashboard ────────────────────────────────────────────────────────

export interface BatchStat {
  batchId: string;
  batchName: string;
  course: string;
  institutionCode: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  completionPct: number;
}

// ── API Responses ──────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
