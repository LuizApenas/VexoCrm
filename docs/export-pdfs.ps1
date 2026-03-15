$ErrorActionPreference = "Stop"

$browserCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$browser = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browser) {
  throw "Nenhum navegador compativel encontrado. Instale Edge ou Chrome para exportar os PDFs."
}

$docsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @(
  "apresentacao-executiva",
  "arquitetura-operacional",
  "workflow-n8n"
)

foreach ($name in $files) {
  $htmlPath = Join-Path $docsDir "$name.html"
  $pdfPath = Join-Path $docsDir "$name.pdf"
  $uri = [System.Uri]::new($htmlPath).AbsoluteUri

  & $browser `
    --headless=new `
    --disable-gpu `
    --print-to-pdf-no-header `
    "--print-to-pdf=$pdfPath" `
    $uri | Out-Null
}

Write-Host "PDFs exportados com sucesso em $docsDir"
