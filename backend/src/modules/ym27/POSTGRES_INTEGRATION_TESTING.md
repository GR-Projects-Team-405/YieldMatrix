# YM27 PostgreSQL integration tests

The payout-store integration suite is opt-in. It uses only an explicitly configured local PostgreSQL 17 instance and a dedicated, disposable database. It does not load dotenv, read `DATABASE_URL`, or use the shared database module.

## Prepare a disposable database

Create a new, empty database using local PostgreSQL administration tools. Use a fresh name matching `ym27_local_test_vN`, where `N` is an unused integer greater than or equal to 2. Do not point the suite at a development, shared, or production database. The suite verifies the server and database identity and refuses to proceed unless the database contains only the default `public` schema and no user objects.

The suite creates its own schema and synthetic fixtures after those checks pass. It does not drop objects after running; use a different newly created disposable database for every run.

## Run from the backend directory in PowerShell

Set the connection values for the local server, enter the database and local test-role names, then run:

```powershell
$env:YM27_RUN_POSTGRES_INTEGRATION = '1'
$env:YM27_LOCAL_PG_HOST = '::1'
$env:YM27_LOCAL_PG_PORT = '5432'
$env:YM27_LOCAL_PG_DATABASE = Read-Host 'New disposable database name (ym27_local_test_vN)'
$env:YM27_LOCAL_PG_USER = Read-Host 'Local test role'
$securePassword = Read-Host 'Local PostgreSQL password (input is masked)' -AsSecureString
$passwordPointer = [IntPtr]::Zero
try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:YM27_LOCAL_PG_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  node --test .\src\modules\ym27\payoutDatabaseStore.integration.test.js
  if ($LASTEXITCODE -ne 0) { throw 'YM27 PostgreSQL integration tests failed.' }
} finally {
  Remove-Item Env:YM27_RUN_POSTGRES_INTEGRATION -ErrorAction SilentlyContinue
  Remove-Item Env:YM27_LOCAL_PG_HOST -ErrorAction SilentlyContinue
  Remove-Item Env:YM27_LOCAL_PG_PORT -ErrorAction SilentlyContinue
  Remove-Item Env:YM27_LOCAL_PG_DATABASE -ErrorAction SilentlyContinue
  Remove-Item Env:YM27_LOCAL_PG_USER -ErrorAction SilentlyContinue
  Remove-Item Env:YM27_LOCAL_PG_PASSWORD -ErrorAction SilentlyContinue
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  if ($securePassword) { $securePassword.Dispose() }
}
```

Only the exact loopback hosts `::1` and `127.0.0.1`, port `5432`, and a fresh `ym27_local_test_vN` database are accepted. The server identity query also checks the connected database, server address, port, role, and PostgreSQL major version before any schema or fixture writes.

The suite contains nine scenarios covering payout persistence and reservation, balanced journals, idempotent replay and conflicts, insufficient balance, invalid cents, concurrent requests, transaction rollback, farmer ownership, and PostgreSQL journal/payout constraints.
