# Firestore Emulator — Quick Reference Card

**Print this. Bookmark this. Refer to this in < 10 seconds.**

---

## One-Liner Startup

### macOS / Linux
```bash
bash scripts/firestore-emulator-setup.sh start && sleep 2 && bash scripts/firestore-emulator-setup.sh seed
```

### Windows PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command start
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed
```

**Then open:** http://localhost:4000

---

## Command Cheat Sheet

| Task | Bash | PowerShell |
|------|------|-----------|
| **Start emulator** | `bash scripts/firestore-emulator-setup.sh start` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command start` |
| **Seed test data** | `bash scripts/firestore-emulator-setup.sh seed` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command seed` |
| **Run rules tests** | `bash scripts/firestore-emulator-setup.sh test` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command test` |
| **Clean all data** | `bash scripts/firestore-emulator-setup.sh clean` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command clean` |
| **Restore from backup** | `bash scripts/firestore-emulator-setup.sh restore <name>` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command restore -BackupName "<name>"` |
| **View logs** | `bash scripts/firestore-emulator-setup.sh logs` | `powershell -File scripts/firestore-emulator-setup.ps1 -Command logs` |
| **Kill stuck emulator** | `pkill -f "firebase emulators:start"` | `Get-Process firebase \| Stop-Process -Force` |

---

## Default Ports

| Service | URL | Port |
|---------|-----|------|
| Firestore | `localhost:8080` | 8080 |
| Emulator UI | `http://localhost:4000` | 4000 |

**In browser:** Open http://localhost:4000 to inspect data

---

## Test Lab IDs (Default)

```
TEST-LAB-001
TEST-LAB-002
TEST-LAB-003
```

Each lab gets:
- Sample users with module claims
- CIQ runs (coagulation, immunology, etc.)
- Equipment + suppliers
- Portal configuration with branding
- NOTIVISA events (sample)

---

## Port Already in Use?

**macOS / Linux:**
```bash
lsof -ti:8080 | xargs kill -9
```

**Windows PowerShell:**
```powershell
Get-NetTCPConnection -LocalPort 8080 | ForEach-Object { taskkill /PID $_.OwningProcess -Force }
```

**Or use different port:**
```bash
FIRESTORE_EMULATOR_PORT=8081 bash scripts/firestore-emulator-setup.sh start
```

---

## Typical 5-Minute Workflow

```bash
# Terminal 1: Start
bash scripts/firestore-emulator-setup.sh start
# (keep running)

# Terminal 2: Seed (in different terminal)
bash scripts/firestore-emulator-setup.sh seed

# Terminal 3: Test
bash scripts/firestore-emulator-setup.sh test

# Terminal 3: View data
open http://localhost:4000

# When done:
# Terminal 1: Ctrl+C to stop
# Terminal 2/3: Done
```

---

## Backup + Restore Pattern

```bash
# Save current state
firebase emulators:export .firebase/emulator-backups/my-snapshot

# Later, restore
bash scripts/firestore-emulator-setup.sh restore my-snapshot
```

---

## Debugging Rules

1. **Rule denied write?** Check emulator UI logs (http://localhost:4000)
2. **Test fails?** Ensure emulator running: `nc -zv localhost 8080`
3. **Data not seeded?** Check: `FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-staging-data.mjs`
4. **Port conflict?** Kill via `lsof` or use different port

---

## Config File

Edit `.env.emulator` to customize:
```bash
FIREBASE_PROJECT_ID=hmatologia2
FIRESTORE_EMULATOR_PORT=8080
FIREBASE_EMULATOR_UI_PORT=4000
TEST_LAB_IDS=TEST-LAB-001,TEST-LAB-002,TEST-LAB-003
SEED_DATA_DIR=.firebase/emulator-backups
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| "firebase-tools not found" | `npm install -g firebase-tools` |
| "Port in use" | Kill via `lsof`/`taskkill` or use different port |
| "Seed hangs" | Check port is accessible + emulator running |
| "Rules test fails" | Emulator running? `npm run test:rules` configured? |
| "Cannot connect" | Check `.env.emulator` → `FIRESTORE_EMULATOR_HOST` |

---

## Rules Testing

```bash
# Single test run
npm run test:rules

# Watch mode (if configured)
npm run test:rules -- --watch

# Coverage
npm run test:rules -- --coverage
```

---

## Full Documentation

→ See **[FIRESTORE_EMULATOR_GUIDE.md](./FIRESTORE_EMULATOR_GUIDE.md)** for detailed explanations, workflows, CI/CD integration, and troubleshooting.

---

## Multi-Tenant Test Data Structure

```
labs/{labId}/
  ├── members/{userId}           ← RBAC checks (active + role)
  ├── usuarios/{userId}          ← Lab staff
  ├── runs/                       ← CIQ runs (immutable events)
  ├── insumos/                    ← Consumables (status, validade)
  ├── equipamentos/               ← Equipment
  ├── fornecedores/               ← Suppliers
  └── auditLogs/                  ← Append-only audit trail

portals/{labId}/
  └── config                      ← Branding + settings

notivisa-events/{labId}/
  └── events                      ← NOTIVISA submission log
```

---

**Last updated:** 2026-05-07
