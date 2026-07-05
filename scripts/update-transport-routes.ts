/**
 * Patch the bus routes into every existing REGISTRATION template.
 *
 * Templates keep a copy of the transport routes inside their schema JSON, so
 * editing src/lib/transport.ts alone only affects newly seeded templates.
 * This script rewrites the `routes` of every `transport_select` field in
 * every REGISTRATION template (batch templates and library forms alike).
 *
 * Run locally:  npx tsx scripts/update-transport-routes.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { TRANSPORT_ROUTES } from "../src/lib/transport";

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.formTemplate.findMany({
    where: { type: "REGISTRATION" },
  });

  let patched = 0;
  for (const t of templates) {
    const schema = t.schema as { fields?: Array<Record<string, unknown>> };
    if (!Array.isArray(schema?.fields)) continue;

    let touched = false;
    const fields = schema.fields.map((f) => {
      if (f.type === "transport_select") {
        touched = true;
        return { ...f, routes: TRANSPORT_ROUTES };
      }
      return f;
    });

    if (!touched) continue;

    await prisma.formTemplate.update({
      where: { id: t.id },
      data: { schema: { ...schema, fields } as Prisma.InputJsonValue },
    });
    patched++;
    console.log(`✓ ${t.name} (${t.id}) — routes updated (${TRANSPORT_ROUTES.length} routes)`);
  }

  console.log(`\nDone: ${patched} of ${templates.length} registration template(s) patched.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
