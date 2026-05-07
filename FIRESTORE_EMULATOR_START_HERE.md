# Firestore Emulator — START HERE (60 seconds)

**Don't read anything else. Just follow these steps.**

---

## 1. Check Prerequisites (30 sec)

**macOS/Linux:**
```bash
bash scripts/check-emulator-prerequisites.sh --fix
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-emulator-prerequisites.ps1 -Fix
```

Wait for green checkmarks. If any red errors remain, follow the messages.

---

## 2. Start Emulator (10 sec)

**macOS/Linux:**
```bash
bash scripts/firestore-emulator-setup.sh start
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1
```

**You should see:**
```
✓ Emulator ready on port 8080
✓ UI available at http://localhost:4000
```

Keep this terminal open.

---

## 3. Seed Test Data (15 sec)

**Open a NEW terminal** and run:

**macOS/Linux:**
```bash
bash scripts/firestore-emulator-setup.sh seed
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/firestore-emulator-setup.ps1 -Command seed
```

**You should see:**
```
✓ Test data seeded successfully
```

---

## 4. Verify (5 sec)

Open in your browser:
```
http://localhost:4000
```

You should see a Firestore UI with collections:
- `labs`
- `portals`
- `notivisa-events`
- etc.

---

## Done! 🎉

You now have:
- Local Firestore running on `localhost:8080`
- 3 test labs with realistic data
- Browser UI for inspection
- Ready for rules testing

---

## Next: Common Tasks

| Task | Command |
|------|---------|
| Run rules tests | `npm run test:rules` |
| View logs | `bash scripts/firestore-emulator-setup.sh logs` |
| Clean all data | `bash scripts/firestore-emulator-setup.sh clean` |
| Backup state | `firebase emulators:export .firebase/emulator-backups/my-snapshot` |
| Restore from backup | `bash scripts/firestore-emulator-setup.sh restore my-snapshot` |

---

## When Something Goes Wrong

| Problem | Fix |
|---------|-----|
| "Port 8080 in use" | Edit `.env.emulator` → `FIRESTORE_EMULATOR_PORT=8081` |
| "firebase-tools not found" | `npm install -g firebase-tools` |
| "Seed fails" | Kill emulator: `pkill -f "firebase emulators:start"` → try again |
| "Rules tests fail" | Make sure emulator running in another terminal |

---

## Read More (Optional)

- **Quick reference card:** [`docs/FIRESTORE_EMULATOR_QUICK_REFERENCE.md`](docs/FIRESTORE_EMULATOR_QUICK_REFERENCE.md)
- **Complete guide:** [`docs/FIRESTORE_EMULATOR_GUIDE.md`](docs/FIRESTORE_EMULATOR_GUIDE.md)
- **CI/CD setup:** [`docs/FIRESTORE_EMULATOR_CI_INTEGRATION.md`](docs/FIRESTORE_EMULATOR_CI_INTEGRATION.md)
- **Test examples:** [`docs/FIRESTORE_RULES_TEST_EXAMPLE.md`](docs/FIRESTORE_RULES_TEST_EXAMPLE.md)

---

**That's it. Happy hacking.**
