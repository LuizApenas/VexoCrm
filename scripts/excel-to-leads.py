# VexoCrm/scripts/excel-to-leads.py
# Reads planilha-leads-infinie.xlsx and outputs leads.json for import.
# Usage: python excel-to-leads.py [path/to/planilha.xlsx]
# Output: leads.json in same dir as script

import json
import sys
from pathlib import Path

import pandas as pd

COL_MAP = {
    "Telefone": "telefone",
    "Nome": "nome",
    "Tipo de Cliente": "tipo_cliente",
    "Faixa de Consumo": "faixa_consumo",
    "Cidade": "cidade",
    "Estado": "estado",
    "Conta de energia": "conta_energia",
    "status": "status",
    "Bot Ativo": "bot_ativo",
    "Historico": "historico",
    "Data e Hora": "data_hora",
    "Qualificacao": "qualificacao",
}


def to_str(val):
    """Convert value to string, None for NaN."""
    if pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return str(int(val)) if val == int(val) else str(val)
    return str(val).strip() or None


def to_bool(val):
    """Convert to boolean. 1/True = true, else false."""
    if pd.isna(val):
        return False
    if isinstance(val, (int, float)):
        return bool(val)
    return str(val).lower() in ("1", "true", "sim", "yes")


def row_to_lead(row, client_id="infinie"):
    """Convert Excel row to leads table record."""
    telefone = to_str(row.get("Telefone"))
    if not telefone:
        return None
    # Ensure telefone is string, add 55 if looks like number without country code
    if telefone.isdigit() and len(telefone) <= 11:
        telefone = "55" + telefone
    return {
        "client_id": client_id,
        "telefone": telefone,
        "nome": to_str(row.get("Nome")),
        "tipo_cliente": to_str(row.get("Tipo de Cliente")),
        "faixa_consumo": to_str(row.get("Faixa de Consumo")),
        "cidade": to_str(row.get("Cidade")),
        "estado": to_str(row.get("Estado")),
        "conta_energia": to_str(row.get("Conta de energia")),
        "status": to_str(row.get("status")),
        "bot_ativo": to_bool(row.get("Bot Ativo")),
        "historico": to_str(row.get("Historico")),
        "data_hora": to_str(row.get("Data e Hora")),
        "qualificacao": to_str(row.get("Qualificacao")),
    }


def main():
    script_dir = Path(__file__).resolve().parent
    default_path = Path.home() / "Downloads" / "planilha-leads-infinie (1).xlsx"
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_path

    if not xlsx_path.exists():
        print(f"Error: File not found: {xlsx_path}")
        sys.exit(1)

    df = pd.read_excel(xlsx_path)
    df.columns = [c.strip() for c in df.columns]

    leads = []
    for _, row in df.iterrows():
        lead = row_to_lead(row.to_dict())
        if lead:
            leads.append(lead)

    out_path = script_dir / "leads.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)

    print(f"Exported {len(leads)} leads to {out_path}")


if __name__ == "__main__":
    main()
