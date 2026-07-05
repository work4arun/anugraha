/**
 * Patch the bus routes into every existing REGISTRATION template.
 *
 * Templates keep a copy of the transport routes inside their schema JSON, so
 * editing src/lib/transport.ts alone only affects newly seeded templates.
 *
 * For each REGISTRATION template this script:
 *   - updates the `routes` of any existing `transport_select` field, and
 *   - with --add-missing, ADDS the transport question (checkbox + cascading
 *     route/boarding-point selector) to templates that don't have one yet
 *     (inserted before the "place" field, or appended at the end).
 *
 * Run locally:
 *   npx tsx scripts/update-transport-routes.ts              # inspect + update existing fields
 *   npx tsx scripts/update-transport-routes.ts --add-missing # also add where absent
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { TRANSPORT_ROUTES } from "../src/lib/transport";

const prisma = new PrismaClient();
const ADD_MISSING = process.argv.includes("--add-missing");

const TRANSPORT_FIELDS = [
  {
    id: "transport_required",
    label: "College Transport Required?",
    type: "checkbox",
    required: false,
  },
  {
    id: "transport_selection",
    label: "Transport Selection",
    type: "transport_select",
    required: true,
    showWhen: { field: "transport_required", value: true },
    hint: "Select your bus route, then your boarding point",
    routes: TRANSPORT_ROUTES,
  },
];

async function main() {
  const templates = await prisma.formTemplate.findMany({
    where: { type: "REGISTRATION" },
  });

  let patched = 0;
  let added = 0;
  for (const t of templates) {
    const schema = t.schema as { fields?: Array<Record<string, unknown>> };
    if (!Array.isArray(schema?.fields)) {
      console.log(`— ${t.name} (${t.id}): schema has no fields array, skipped`);
      continue;
    }

    const hasTransport = schema.fields.some((f) => f.type === "transport_select");

    if (!hasTransport && !ADD_MISSING) {
      console.log(
        `— ${t.name} (${t.id}): no transport field. Fields: ` +
          schema.fields.map((f) => `${f.id}:${f.type}`).join(", ")
      );
      continue;
    }

    let fields: Array<Record<string, unknown>>;
    if (hasTransport) {
      fields = schema.fields.map((f) =>
        f.type === "transport_select" ? { ...f, routes: TRANSPORT_ROUTES } : f
      );
    } else {
      // Insert the transport question before the "place" field (the seed's
      // position), or at the end when there's no place field.
      const idx = schema.fields.findIndex((f) => f.id === "place");
      fields = [...schema.fields];
      fields.splice(idx === -1 ? fields.length : idx, 0, ...TRANSPORT_FIELDS);
      added++;
    }

    await prisma.formTemplate.update({
      where: { id: t.id },
      data: { schema: { ...schema, fields } as Prisma.InputJsonValue },
    });
    patched++;
    console.log(
      `✓ ${t.name} (${t.id}) — ${hasTransport ? "routes updated" : "transport field ADDED"} (${TRANSPORT_ROUTES.length} routes)`
    );
  }

  console.log(
    `\nDone: ${patched} of ${templates.length} registration template(s) patched` +
      (ADD_MISSING ? ` (${added} had the field newly added).` : ".") +
      (!ADD_MISSING && patched === 0
        ? "\nNo template had a transport field. Re-run with --add-missing to insert it."
        : "")
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
