# Session: Import Leads from Excel

**Date:** 2026-03-05

## Summary
Created pipeline to import leads from Excel (`planilha-leads-infinie.xlsx`) into Supabase.

## Created Files
- `VexoCrm/scripts/excel-to-leads.py` — Converts Excel to `leads.json`
- `VexoCrm/scripts/import-leads.js` — Node script to upsert leads via Supabase API (run from backend/)
- `VexoCrm/scripts/setup-leads-tables.sql` — SQL to create `leads` and `leads_clients` tables
- `VexoCrm/scripts/README-import-leads.md` — Usage instructions

## Flow
1. Run `scripts/setup-leads-tables.sql` in Supabase SQL Editor (creates tables)
2. `python scripts/excel-to-leads.py path/to/planilha.xlsx` → generates `leads.json`
3. `cd backend && npm run import-leads` → upserts to Supabase

## Notes
- Tables must exist before import. Error "Could not find table" = run setup SQL first.
- Excel columns mapped: Telefone, Nome, Tipo de Cliente, Faixa de Consumo, Cidade, Estado, etc.
