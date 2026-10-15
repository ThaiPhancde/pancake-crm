param([string]$PgBin='D:\PostgreSQL\18\bin',[string]$PgHost='127.0.0.1',[int]$PgPort=5432,[string]$PgUser='postgres')
$ErrorActionPreference='Stop'
$passwordInput=Read-Host 'PostgreSQL password (local input only)' -AsSecureString
$passwordPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordInput)
try {
  $env:PGPASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $exists=& (Join-Path $PgBin 'psql.exe') -h $PgHost -p $PgPort -U $PgUser -d postgres -w -Atc "SELECT 1 FROM pg_database WHERE datname='comp_ai_crm'"
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL authentication fails.' }
  if ($exists -eq '1') { Write-Output 'comp_ai_crm already exists. Database remains unchanged.'; exit 0 }
  & (Join-Path $PgBin 'createdb.exe') -h $PgHost -p $PgPort -U $PgUser -w comp_ai_crm
  if ($LASTEXITCODE -ne 0) { throw 'Database creation fails.' }
  Write-Output 'Created dedicated comp_ai_crm. Configure DATABASE_URL in the root .env.'
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
