import fs from "fs";
import path from "path";

/**
 * PDF Font utility module.
 * Provides embedded base64 font declarations for Chromium PDF generation
 * so that PDF output never renders blank square boxes ("tofu") even when
 * running in headless Linux / AWS Lambda / Vercel environments without system fonts.
 */

let cachedFontCss: string | null = null;

export function getPdfFontCss(): string {
  if (cachedFontCss) return cachedFontCss;

  let regularBase64 = "";
  let boldBase64 = "";

  try {
    const regularPath = path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2"
    );
    const boldPath = path.join(
      process.cwd(),
      "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.woff2"
    );

    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      regularBase64 = fs.readFileSync(regularPath).toString("base64");
      boldBase64 = fs.readFileSync(boldPath).toString("base64");
    }
  } catch (err) {
    console.warn("[pdfFonts] Could not load local geist font files, using fallbacks:", err);
  }

  const fontFaceRules =
    regularBase64 && boldBase64
      ? `
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('data:font/woff2;base64,${regularBase64}') format('woff2');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url('data:font/woff2;base64,${boldBase64}') format('woff2');
}
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url('data:font/woff2;base64,${boldBase64}') format('woff2');
}
`
      : "";

  cachedFontCss = fontFaceRules;
  return cachedFontCss;
}

export const PDF_FONT_FAMILY =
  "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
