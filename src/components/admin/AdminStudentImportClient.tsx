"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  ArrowLeft,
  Upload,
  FileDown,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listContainer, listItem } from "@/lib/motion";

interface Batch {
  id: string;
  name: string;
  code: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  unmatchedBatches: string[];
  errors: string[];
  credentials: Array<{ regNo: string; name: string; username: string; password: string; action: string }>;
}

export function AdminStudentImportClient({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [defaultBatchId, setDefaultBatchId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data);
        setFileName(file.name);
        toast.success(`${res.data.length} rows loaded`);
      },
      error: () => toast.error("Could not read that file — is it a valid CSV?"),
    });
    e.target.value = "";
  }

  async function runImport() {
    if (rows.length === 0) {
      toast.error("Load a CSV first");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: defaultBatchId || undefined,
          students: rows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.data);
      toast.success(`Imported: ${data.data.created} new, ${data.data.updated} updated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const sample = [
      {
        batch: batches[0]?.name ?? "RTC B.E./B.Tech 2024–25",
        reg_no: "24CS001",
        name: "Arjun Kumar",
        username: "24CS001",
        password: "Welcome@123",
        email: "arjun@example.com",
        mobile: "9876543210",
      },
    ];
    downloadCsv(Papa.unparse(sample), "student_import_template.csv");
  }

  function downloadCredentials() {
    if (!result) return;
    downloadCsv(Papa.unparse(result.credentials), "imported_credentials.csv");
  }

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const previewCols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="min-h-[100dvh] bg-surface-muted">
      <header className="bg-white border-b border-surface-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-subtle"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1">
            <p className="text-base font-semibold text-ink">Import Students</p>
            <p className="text-xs text-ink-muted">Upload details with batch, username &amp; password</p>
          </div>
          <Button size="sm" variant="secondary" icon={<FileDown className="w-4 h-4" />} onClick={downloadTemplate}>
            Template
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
          {/* Instructions */}
          <motion.div variants={listItem}>
            <Card padding="md">
              <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
              <p className="text-sm text-ink leading-relaxed">
                Upload a CSV with one student per row. Each student is matched to a batch so their
                profile syncs automatically. Columns (header names are flexible):
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {["batch", "reg_no", "name", "username", "password", "email", "mobile"].map((c) => (
                  <span key={c} className="px-2 py-1 rounded-md bg-surface-subtle font-mono text-ink">{c}</span>
                ))}
              </div>
              <ul className="mt-3 text-xs text-ink-muted list-disc list-inside space-y-1">
                <li><span className="font-medium text-ink">batch</span> = the batch name (or id). Leave it out and pick a default batch below.</li>
                <li><span className="font-medium text-ink">username</span> defaults to the reg no if omitted.</li>
                <li><span className="font-medium text-ink">password</span> is used as-is when provided; otherwise one is generated and returned to you.</li>
              </ul>
            </Card>
          </motion.div>

          {/* Upload */}
          <motion.div variants={listItem}>
            <Card padding="md" className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-ink mb-1.5 block">Default batch (optional)</label>
                  <select
                    value={defaultBatchId}
                    onChange={(e) => setDefaultBatchId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-surface-border text-sm bg-white"
                  >
                    <option value="">Use the “batch” column in the file</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={handleFile} />
                <Button icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>
                  Choose CSV
                </Button>
              </div>
              {fileName && (
                <p className="text-xs text-ink-muted">
                  Loaded <span className="font-medium text-ink">{fileName}</span> · {rows.length} rows
                </p>
              )}
            </Card>
          </motion.div>

          {/* Preview */}
          {rows.length > 0 && (
            <motion.div variants={listItem}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">Preview ({rows.length})</h2>
                <Button loading={importing} icon={<Users className="w-4 h-4" />} onClick={runImport}>
                  Import {rows.length} students
                </Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-surface-border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-muted">
                      {previewCols.map((c) => (
                        <th key={c} className="text-left px-3 py-2 text-xs font-semibold text-ink-muted whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-surface-border last:border-0">
                        {previewCols.map((c) => (
                          <td key={c} className="px-3 py-2 text-ink whitespace-nowrap">{r[c]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 8 && (
                  <p className="text-xs text-ink-muted px-3 py-2">…and {rows.length - 8} more</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Results */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card padding="md" className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <h2 className="text-sm font-semibold text-ink">Import complete</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="success">{result.created} created</Badge>
                  <Badge variant="default">{result.updated} updated</Badge>
                  {result.skipped > 0 && <Badge variant="warning">{result.skipped} skipped</Badge>}
                </div>

                {result.unmatchedBatches.length > 0 && (
                  <div className="flex items-start gap-2 bg-warning-light border border-warning/30 rounded-xl p-3">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">
                      These batch names didn&apos;t match any batch, so those rows were skipped:{" "}
                      <span className="font-medium">{result.unmatchedBatches.join(", ")}</span>. Create the
                      batch first, or fix the name.
                    </p>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div className="text-xs text-error space-y-0.5">
                    {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
                  </div>
                )}

                {result.credentials.length > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-border">
                    <p className="text-xs text-ink-muted">
                      Download the login credentials to share with students (generated passwords included).
                    </p>
                    <Button size="sm" variant="secondary" icon={<Download className="w-4 h-4" />} onClick={downloadCredentials}>
                      Credentials CSV
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
