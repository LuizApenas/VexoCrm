# Import Leads from Excel

## 1. Create tables (if not exists)

**Supabase Dashboard:** Project → SQL Editor → New query → paste and run:

```
scripts/setup-leads-tables.sql
```

Or run the migrations in `frontend/supabase/migrations/` in order.

## 2. Convert Excel to JSON

```powershell
cd VexoCrm
python scripts/excel-to-leads.py "C:\path\to\planilha-leads-infinie.xlsx"
```

Output: `scripts/leads.json`

## 3. Import to Supabase

```powershell
cd VexoCrm/backend
node scripts/import-leads.js
```

Requires `backend/.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## One-liner (from Vexo root)

```powershell
python VexoCrm/scripts/excel-to-leads.py "C:\Users\W11\Downloads\planilha-leads-infinie (1).xlsx"
cd VexoCrm/backend; node scripts/import-leads.js
```
