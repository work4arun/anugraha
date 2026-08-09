/**
 * Minimal, zero-dependency ZIP writer.
 *
 * Builds a standard .zip archive entirely in memory using Node's built-in
 * `zlib` for DEFLATE compression — no `archiver`/`jszip` dependency required.
 * Entries are stored with method 8 (deflate); already-compressed inputs (like
 * PDFs) still produce a valid, portable archive.
 *
 * Only the subset of the ZIP spec needed here is implemented:
 *   - local file headers + deflated data
 *   - a central directory + end-of-central-directory record
 *   - forward slashes in names (folders are implied by "/" in the path)
 *
 * This is sufficient for macOS/Windows/Linux built-in extractors. It is NOT a
 * general-purpose archiver (no Zip64, no encryption, no streaming).
 */

import zlib from "zlib";

// ── CRC32 ─────────────────────────────────────────────────────────────────────
// Standard IEEE 802.3 CRC32, required in every ZIP entry header.

const CRC_TABLE: number[] = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── DOS date/time ─────────────────────────────────────────────────────────────

function dosDateTime(date: Date): { time: number; date: number } {
  const year = date.getFullYear();
  // ZIP epoch starts at 1980; clamp older dates so the field stays valid.
  const dosYear = year < 1980 ? 0 : year - 1980;
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = (dosYear << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

export interface ZipEntry {
  /** Path inside the archive. Use "/" to create folders, e.g. "Batch A/file.pdf". */
  name: string;
  /** Raw file bytes. */
  data: Buffer;
  /** Optional last-modified timestamp (defaults to now). */
  date?: Date;
}

/**
 * Build a complete ZIP archive from the given entries and return it as a Buffer.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const crc = crc32(entry.data);
    const compressed = zlib.deflateRawSync(entry.data);
    const { time, date } = dosDateTime(entry.date ?? new Date());

    // Bit 11 (0x0800) of the general-purpose flags marks the filename as UTF-8.
    const flags = 0x0800;
    const method = 8; // deflate

    // ── Local file header ──────────────────────────────────────────────────
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract (2.0)
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    fileParts.push(local, nameBuf, compressed);

    // ── Central directory header ───────────────────────────────────────────
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42); // relative offset of local header

    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const fileData = Buffer.concat(fileParts);

  // ── End of central directory record ──────────────────────────────────────
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDir.length, 12); // central dir size
  eocd.writeUInt32LE(fileData.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([fileData, centralDir, eocd]);
}

/**
 * Sanitize a string for safe use as a ZIP path segment (folder or filename).
 * Strips path separators and characters that break Windows/macOS extractors.
 */
export function safeZipSegment(value: string, fallback = "unnamed"): string {
  const cleaned = value
    .replace(/[/\\]+/g, "-") // no nested paths from a single segment
    .replace(/[<>:"|?*\x00-\x1f]/g, "") // illegal on Windows
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "") // trailing dots/spaces break Windows extractors
    .trim();
  return cleaned || fallback;
}
