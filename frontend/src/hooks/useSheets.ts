// VexoCrm/src/hooks/useSheets.ts
import { useQuery } from "@tanstack/react-query";
import { fetchSheetData, type SheetRow } from "@/lib/sheets";

export interface SheetConfig {
  id: string;
  name: string;
  sheetId: string;
  gid: string;
}

/** Infinie client sheet - from the provided Google Sheets URL */
export const INFINIE_SHEET: SheetConfig = {
  id: "infinie",
  name: "Infinie",
  sheetId: "1uePB3LiKFktqJw8ZT3teUzCpBXQVf84EImfEJ_iV718",
  gid: "1604153582",
};

export function useSheets(config: SheetConfig) {
  return useQuery({
    queryKey: ["sheets", config.id, config.sheetId, config.gid],
    queryFn: () => fetchSheetData({ sheetId: config.sheetId, gid: config.gid }),
    staleTime: 60 * 1000, // 1 min
  });
}
