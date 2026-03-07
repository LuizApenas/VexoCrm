// VexoCrm/src/lib/sheets.ts
// Fetches Google Sheets data via backend API proxy (avoids CORS).
import { API_BASE_URL } from "@/lib/api";

const getSheetsApiUrl = (): string => {
  return `${API_BASE_URL}/api/sheets`;
};

export type SheetRow = Record<string, string>;

export interface FetchSheetsOptions {
  sheetId: string;
  gid: string;
}

/**
 * Fetches sheet data via Edge Function proxy.
 * Sheet must be "Published to web" (File > Share > Publish to web) for public access.
 */
export async function fetchSheetData(options: FetchSheetsOptions): Promise<SheetRow[]> {
  const { sheetId, gid } = options;
  const url = `${getSheetsApiUrl()}?sheetId=${encodeURIComponent(sheetId)}&gid=${encodeURIComponent(gid)}`;

  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets fetch failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.rows)) {
    throw new Error("Invalid sheets response");
  }
  return data.rows;
}
