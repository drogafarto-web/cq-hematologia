# Firestore Emulator — CI/CD Integration

**Quick integration patterns for GitHub Actions, GitLab CI, and local pre-commit hooks.**

---

## GitHub Actions

### Minimal Example (5 min test run)

Create `.github/workflows/firestore-rules-test.yml`:

```yaml
name: Firestore Rules Validation

on:
  push:
    branches: [main, develop]
    paths:
      - 'firestore.rules'
      - 'firestore.indexes.json'
      - '__tests__/firestore/**'
  pull_request:
    paths:
      - 'firestore.rules'
      - 'firestore.indexes.json'
      - '__tests__/firestore/**'

jobs:
  firestore-rules:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start Firestore emulator
        run: bash scripts/firestore-emulator-setup.sh start &
        timeout-minutes: 2

      - name: Wait for emulator readiness
        run: |
          for i in {1..30}; do
            if nc -z localhost 8080 2>/dev/null; then
              echo "Emulator ready"
              exit 0
            fi
            echo "Waiting... ($i/30)"
            sleep 1
          done
          echo "Emulator failed to start"
          exit 1

      - name: Seed test data
        run: bash scripts/firestore-emulator-setup.sh seed
        timeout-minutes: 2

      - name: Run rules validation tests
        run: npm run test:rules
        timeout-minutes: 5

      - name: Cleanup
        if: always()
        run: pkill -f "firebase emulators:start" || true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: firestore-test-results
          path: |
            coverage/
            test-results.json
          retention-days: 30
```

### Full Example (with rules deployment gate)

```yaml
name: Firestore Rules Validation + Deploy

on:
  push:
    branches: [main]
    paths:
      - 'firestore.rules'
      - 'firestore.indexes.json'
  pull_request:
    paths:
      - 'firestore.rules'
      - 'firestore.indexes.json'

jobs:
  validate-rules:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start emulator and seed data
        run: |
          bash scripts/firestore-emulator-setup.sh start &
          sleep 3
          bash scripts/firestore-emulator-setup.sh seed

      - name: Validate rules syntax
        run: firebase validate-firestore-rules --project hmatologia2

      - name: Run unit tests
        run: npm run test:rules

      - name: Validate indexes
        run: firebase validate-firestore-indexes --project hmatologia2

      - name: Report results
        if: always()
        run: |
          echo "## Firestore Rules Validation" >> $GITHUB_STEP_SUMMARY
          echo "- Syntax: ✓" >> $GITHUB_STEP_SUMMARY
          echo "- Unit tests: ✓" >> $GITHUB_STEP_SUMMARY
          echo "- Indexes: ✓" >> $GITHUB_STEP_SUMMARY

  deploy-rules:
    needs: validate-rules
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Setup Firebase CLI
        uses: w9jds/setup-firebase@main
        with:
          tools-version: latest
          project_id: ${{ secrets.FIREBASE_PROJECT_ID }}

      - name: Authenticate Firebase
        run: firebase deploy --only firestore:rules --project ${{ secrets.FIREBASE_PROJECT_ID }}
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

---

## GitLab CI

### `.gitlab-ci.yml` Example

```yaml
stages:
  - test
  - deploy

variables:
  NODE_VERSION: "18"
  FIREBASE_PROJECT_ID: "hmatologia2"

firestore-rules:test:
  stage: test
  image: node:18
  before_script:
    - npm ci
    - npm install -g firebase-tools
  script:
    - bash scripts/firestore-emulator-setup.sh start &
    - sleep 3
    - bash scripts/firestore-emulator-setup.sh seed
    - npm run test:rules
  after_script:
    - pkill -f "firebase emulators:start" || true
  cache:
    paths:
      - node_modules/
  only:
    changes:
      - firestore.rules
      - firestore.indexes.json
      - __tests__/firestore/**

firestore-rules:deploy:
  stage: deploy
  image: node:18
  before_script:
    - npm ci
    - npm install -g firebase-tools
  script:
    - firebase deploy --only firestore:rules --project $FIREBASE_PROJECT_ID --token $FIREBASE_TOKEN
  only:
    - main
  when: manual
```

---

## Local Pre-commit Hook

### Setup

```bash
# Create hook file
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Firestore rules pre-commit validation
echo "Validating Firestore rules..."

# Check if rules files were changed
CHANGED_FILES=$(git diff --cached --name-only)

if echo "$CHANGED_FILES" | grep -E "firestore\.(rules|indexes\.json)"; then
  echo "  Rules files detected. Running validation..."

  # Start emulator
  bash scripts/firestore-emulator-setup.sh start &
  EMULATOR_PID=$!
  sleep 3

  # Seed data
  bash scripts/firestore-emulator-setup.sh seed

  # Run tests
  npm run test:rules
  TEST_RESULT=$?

  # Cleanup
  kill $EMULATOR_PID 2>/dev/null || true

  if [ $TEST_RESULT -ne 0 ]; then
    echo "  ✗ Rules validation failed"
    exit 1
  fi

  echo "  ✓ Rules validation passed"
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit
```

### Verify Hook

```bash
# Test it
git add firestore.rules
git commit -m "test: update rules"

# Should run validation automatically
```

---

## Pre-push Hook (Optional)

```bash
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

echo "Running pre-push checks..."

# Check if rules are being pushed to main
if [[ $(git rev-parse --abbrev-ref HEAD) == "main" ]]; then
  if git diff origin/main...HEAD --name-only | grep "firestore.rules"; then
    echo "  Running comprehensive rules tests before push to main..."

    bash scripts/firestore-emulator-setup.sh start &
    sleep 3
    bash scripts/firestore-emulator-setup.sh seed
    npm run test:rules

    if [ $? -ne 0 ]; then
      echo "  ✗ Tests failed. Push aborted."
      exit 1
    fi
  fi
fi

exit 0
EOF

chmod +x .git/hooks/pre-push
```

---

## Docker Integration

### `Dockerfile.emulator` Example

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install firebase-tools
RUN npm install -g firebase-tools

# Copy project files
COPY . .

# Install dependencies
RUN npm ci

# Expose ports
EXPOSE 8080 4000

# Default command: start emulator
CMD ["bash", "scripts/firestore-emulator-setup.sh", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  firestore-emulator:
    build:
      context: .
      dockerfile: Dockerfile.emulator
    ports:
      - "8080:8080"
      - "4000:4000"
    environment:
      FIRESTORE_EMULATOR_PORT: 8080
      FIREBASE_EMULATOR_UI_PORT: 4000
    volumes:
      - ./.firebase:/app/.firebase

  app-tests:
    build:
      context: .
      dockerfile: Dockerfile
    depends_on:
      - firestore-emulator
    environment:
      FIRESTORE_EMULATOR_HOST: "firestore-emulator:8080"
    command: npm run test:rules
```

Run:
```bash
docker-compose up --abort-on-container-exit
```

---

## Scheduled Validation (Nightly)

### GitHub Actions Scheduled Job

```yaml
name: Nightly Firestore Validation

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run comprehensive validation
        run: |
          bash scripts/firestore-emulator-setup.sh start &
          sleep 3
          bash scripts/firestore-emulator-setup.sh seed
          npm run test:rules
          npm run test:rules -- --coverage

      - name: Send Slack notification
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Nightly Firestore validation: ${{ job.status }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Performance Monitoring

### Add to CI workflow

```yaml
- name: Measure emulator startup time
  run: |
    START=$(date +%s%N)
    bash scripts/firestore-emulator-setup.sh start &
    sleep 3
    END=$(date +%s%N)
    DURATION=$(echo "scale=3; ($END - $START) / 1000000" | bc)
    echo "Startup time: ${DURATION}ms"

- name: Measure seed time
  run: |
    START=$(date +%s%N)
    bash scripts/firestore-emulator-setup.sh seed
    END=$(date +%s%N)
    DURATION=$(echo "scale=3; ($END - $START) / 1000000" | bc)
    echo "Seed time: ${DURATION}ms"
```

---

## Reporting & Notifications

### Slack Integration

```bash
#!/bin/bash
# scripts/post-rules-test-results.sh

TEST_RESULT=$1
DURATION=$2

if [ "$TEST_RESULT" -eq 0 ]; then
  STATUS="✓ PASSED"
  COLOR="#36a64b"
else
  STATUS="✗ FAILED"
  COLOR="#ff0000"
fi

curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  --data "{
    \"attachments\": [{
      \"color\": \"$COLOR\",
      \"title\": \"Firestore Rules Test\",
      \"text\": \"$STATUS\",
      \"fields\": [{
        \"title\": \"Duration\",
        \"value\": \"${DURATION}ms\",
        \"short\": true
      }]
    }]
  }"
```

---

## Emergency Bypass

### Deploy without full validation (use sparingly)

```bash
# Only in emergency — logs why
firebase deploy --only firestore:rules \
  --project hmatologia2 \
  --force

# Document in commit
git commit -m "emergency: deploy rules without tests — [INCIDENT-123](link)"
```

---

## Best Practices

1. **Always test before merge:**
   - Pre-commit hooks catch issues early
   - CI validates on every push
   - Pre-push hooks prevent bad merges

2. **Gate production deploys:**
   - Require `main` branch tests to pass
   - Manual approval for rules changes
   - Require approval from 2+ reviewers

3. **Backup before deploy:**
   - `firebase emulators:export` current state
   - Keep snapshots for 7 days minimum
   - Rollback procedure documented

4. **Monitor post-deploy:**
   - Cloud Logs for errors
   - Firestore quota monitoring
   - User-reported issues within 1 hour

---

## Related Docs

- [FIRESTORE_EMULATOR_GUIDE.md](./FIRESTORE_EMULATOR_GUIDE.md) — Full setup guide
- [FIRESTORE_EMULATOR_QUICK_REFERENCE.md](./FIRESTORE_EMULATOR_QUICK_REFERENCE.md) — Command cheat sheet
- [`firestore.rules`](../firestore.rules) — Rules source
- [Firebase Emulator Docs](https://firebase.google.com/docs/emulator-suite)

---

**Last updated:** 2026-05-07
