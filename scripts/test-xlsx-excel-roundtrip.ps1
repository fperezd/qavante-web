param([Parameter(Mandatory=$true)][string]$CorpusPath)
# Sólo corpus sintético generado por QAVANTE_XLSX_CORPUS en xlsx.test.ts.
$ErrorActionPreference = 'Stop'
$excel = $null
$book = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AutomationSecurity = 3
  $version = $excel.Version
  $language = $excel.LanguageSettings.LanguageID(2)
  $path = (Resolve-Path -LiteralPath $CorpusPath).Path
  $roundtrip = [IO.Path]::Combine([IO.Path]::GetDirectoryName($path), 'excel-roundtrip.xlsx')
  $book = $excel.Workbooks.Open($path, 0, $true)
  $expectedTexts = 2..$book.Worksheets.Item(1).UsedRange.Rows.Count | ForEach-Object { $book.Worksheets.Item(1).Cells.Item($_, 6).Value2 }
  $before = 1..6 | ForEach-Object { $cell = $book.Worksheets.Item(1).Cells.Item(2, $_); @{ text = $cell.Text; value = $cell.Value2; formula = $cell.HasFormula; type = if ($null -eq $cell.Value2) { 'null' } else { $cell.Value2.GetType().Name } } }
  $book.SaveAs($roundtrip, 51)
  $book.Close($false)
  $book = $excel.Workbooks.Open($roundtrip, 0, $true)
  for ($rowIndex = 2; $rowIndex -le $book.Worksheets.Item(1).UsedRange.Rows.Count; $rowIndex++) {
    $check = $book.Worksheets.Item(1).Cells.Item($rowIndex, 6)
    if ($check.HasFormula -or $check.Value2 -cne $expectedTexts[$rowIndex - 2]) { throw "Texto alterado o fórmula en fila $rowIndex" }
  }
  $after = 1..6 | ForEach-Object { $cell = $book.Worksheets.Item(1).Cells.Item(2, $_); @{ text = $cell.Text; value = $cell.Value2; formula = $cell.HasFormula; type = if ($null -eq $cell.Value2) { 'null' } else { $cell.Value2.GetType().Name } } }
  @{ version=$version; language=$language; before=$before; after=$after; literal_rows_verified=$expectedTexts.Count } | ConvertTo-Json -Depth 5
  foreach ($phase in @($before, $after)) {
    if ($phase[0].value -cne '000123' -or $phase[0].type -ne 'String') { throw 'Folio alterado' }
    if ($phase[1].value -ne -0.5 -or $phase[1].type -ne 'Double') { throw 'Monto alterado' }
    if ($phase[2].value -ne 0 -or $phase[2].type -ne 'Double') { throw 'Cero alterado' }
    if ($null -ne $phase[3].value) { throw 'Ausencia alterada' }
    if ($phase[5].value -cne '=1+1') { throw 'Texto alterado' }
    if (@($phase | Where-Object { $_.formula }).Count -ne 0) { throw 'Formula ejecutable' }
  }
} finally {
  if ($null -ne $book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) }
  if ($null -ne $excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
