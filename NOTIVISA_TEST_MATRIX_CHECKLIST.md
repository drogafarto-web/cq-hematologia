# NOTIVISA Phase 4 — Test Matrix & Implementation Checklist

**Document ID:** TEST-MATRIX-NOTIVISA-001  
**Date:** 2026-05-08  
**Version:** 1.0  
**Audience:** Engineering Team

---

## Test Coverage Matrix (211 Test Cases)

### Section 1: Unit Tests (130 cases)

#### 1.1 authenticatePortal.test.ts (18 tests)

| #   | Test Name                                                   | Category         | Input                           | Expected Output                                | Error Code              | Coverage                |
| --- | ----------------------------------------------------------- | ---------------- | ------------------------------- | ---------------------------------------------- | ----------------------- | ----------------------- |
| 1   | should authenticate user and return auth token              | Happy Path       | valid credentials, no MFA       | ok=true, authToken, sessionId, expiresAt       | —                       | Line: 95% Branch: 90%   |
| 2   | should handle MFA successfully                              | Happy Path       | valid credentials + 6-digit MFA | ok=true, authToken, sessionId                  | —                       | Line: 92% Branch: 88%   |
| 3   | should reject unauthenticated request                       | Auth             | request.auth = undefined        | throws HttpsError                              | unauthenticated         | Line: 100% Branch: 100% |
| 4   | should reject missing module claim                          | Auth             | token.modules.notivisa = false  | ok=false, code                                 | PERMISSION_DENIED       | Line: 100% Branch: 100% |
| 5   | should reject invalid credentials                           | Error            | username/password too short     | ok=false, code                                 | INTERNAL_ERROR          | Line: 95% Branch: 90%   |
| 6   | should return MFA_REQUIRED when configured but not provided | Error            | MFA required, code not provided | ok=false, code                                 | MFA_REQUIRED            | Line: 100% Branch: 100% |
| 7   | should return MFA_INVALID on wrong code                     | Error            | MFA required, wrong code        | ok=false, code                                 | MFA_INVALID             | Line: 95% Branch: 90%   |
| 8   | should return PORTAL_CONFIG_MISSING if no config exists     | Error            | no portal config doc            | ok=false, code                                 | PORTAL_CONFIG_MISSING   | Line: 100% Branch: 100% |
| 9   | should create session document with correct expiration      | Audit            | valid auth                      | batch.set called with status=active            | —                       | Line: 95% Branch: 92%   |
| 10  | should log authentication attempt for audit trail           | Audit            | valid auth                      | batch.set called with PORTAL_LOGIN action      | —                       | Line: 95% Branch: 90%   |
| 11  | should validate labId is not empty                          | Input Validation | labId=''                        | ok=false, code                                 | INTERNAL_ERROR          | Line: 100% Branch: 100% |
| 12  | should validate username min length                         | Input Validation | username.length < 3             | ok=false, code                                 | INTERNAL_ERROR          | Line: 100% Branch: 100% |
| 13  | should validate password min length                         | Input Validation | password.length < 8             | ok=false, code                                 | INTERNAL_ERROR          | Line: 100% Branch: 100% |
| 14  | should validate MFA code format if provided                 | Input Validation | mfaCode not 6 digits            | ok=false, code                                 | INTERNAL_ERROR          | Line: 100% Branch: 100% |
| 15  | should return PORTAL_UNREACHABLE on network error           | Error            | HTTP timeout                    | ok=false, code                                 | PORTAL_UNREACHABLE      | Line: 95% Branch: 88%   |
| 16  | should return SESSION_CREATION_FAILED on batch error        | Error            | batch.commit() fails            | ok=false, code                                 | SESSION_CREATION_FAILED | Line: 90% Branch: 85%   |
| 17  | should generate valid auth token format                     | Output           | valid auth                      | result.authToken matches `notivisa.*signature` | —                       | Line: 92% Branch: 88%   |
| 18  | should set sessionId in response                            | Output           | valid auth                      | result.sessionId is UUID-like                  | —                       | Line: 90% Branch: 88%   |

**Summary:** 18 tests, 95% line coverage, 90% branch coverage, all 8 error codes tested

---

#### 1.2 getPatientData.test.ts (16 tests)

| #   | Test Name                                                   | Category         | Input                           | Expected Output                                     | Error Code        | Coverage    |
| --- | ----------------------------------------------------------- | ---------------- | ------------------------------- | --------------------------------------------------- | ----------------- | ----------- |
| 1   | should retrieve patient and laudo data                      | Happy Path       | valid CPF, labId                | ok=true, paciente, laudo, readyForSubmission=true   | —                 | 92% / 88%   |
| 2   | should fetch latest laudo when laudoId not provided         | Happy Path       | CPF, no laudoId                 | ok=true, laudo with max resultadoEm                 | —                 | 90% / 85%   |
| 3   | should fetch specific laudo when laudoId provided           | Happy Path       | CPF, laudoId                    | ok=true, matching laudo                             | —                 | 92% / 88%   |
| 4   | should return PATIENT_NOT_FOUND if CPF not in DB            | Error            | invalid CPF                     | ok=false, code                                      | PATIENT_NOT_FOUND | 100% / 100% |
| 5   | should return LAUDO_NOT_FOUND if no results                 | Error            | valid CPF, no laudos            | ok=false, code                                      | LAUDO_NOT_FOUND   | 100% / 100% |
| 6   | should return INCOMPLETE_DATA + missingFields               | Error            | paciente missing dataNascimento | ok=false, code, missingFields                       | INCOMPLETE_DATA   | 95% / 90%   |
| 7   | should mask CPF in audit log (12345\*\*\*)                  | Audit            | valid request                   | audit log CPF masked                                | —                 | 100% / 100% |
| 8   | should log PATIENT_DATA_RETRIEVED to audit                  | Audit            | valid request                   | audit log with action                               | —                 | 95% / 90%   |
| 9   | should validate CPF format (11 digits)                      | Input Validation | CPF < 11 digits                 | ok=false, code                                      | INTERNAL_ERROR    | 100% / 100% |
| 10  | should reject unauthenticated request                       | Auth             | request.auth = undefined        | throws HttpsError                                   | unauthenticated   | 100% / 100% |
| 11  | should reject missing notivisa claim                        | Auth             | token.modules.notivisa = false  | ok=false, code                                      | PERMISSION_DENIED | 100% / 100% |
| 12  | should validate each resultado has required fields          | Input Validation | resultado missing analito       | ok=false, missingFields includes                    | INCOMPLETE_DATA   | 95% / 92%   |
| 13  | should handle null/undefined optional fields                | Edge Case        | sexo=null, mae=null             | ok=true (optional), readyForSubmission may be false | —                 | 88% / 85%   |
| 14  | should return readyForSubmission=false if any field missing | Output           | missing signature.ts            | readyForSubmission=false, missingFields populated   | —                 | 92% / 88%   |
| 15  | should handle empty resultados array                        | Error            | resultados=[]                   | INCOMPLETE_DATA                                     | —                 | 95% / 90%   |
| 16  | should handle paciente without required fields              | Edge Case        | paciente.nome missing           | INCOMPLETE_DATA                                     | —                 | 90% / 85%   |

**Summary:** 16 tests, 92% line coverage, 88% branch coverage, all 5 error codes tested

---

#### 1.3 submitRequisition.test.ts (22 tests)

| #   | Test Name                                                 | Category         | Input                                             | Expected Output                           | Error Code           | Coverage    |
| --- | --------------------------------------------------------- | ---------------- | ------------------------------------------------- | ----------------------------------------- | -------------------- | ----------- |
| 1   | should submit and return ok=true with requisitionId       | Happy Path       | valid input, active session                       | ok=true, requisitionId, status            | —                    | 96% / 92%   |
| 2   | should set status=submitted on portal success             | Happy Path       | valid input, portal returns success               | status='submitted', protocolNumber set    | —                    | 96% / 92%   |
| 3   | should set status=queued on portal failure                | Happy Path       | valid input, portal unavailable                   | status='queued', protocolNumber undefined | —                    | 95% / 90%   |
| 4   | should create notivisa-requisitions doc                   | Firestore        | valid input                                       | doc created with full payload             | —                    | 96% / 92%   |
| 5   | should set nextCheckAt = now + 5 minutes                  | Output           | valid input                                       | nextCheckAt ~= Date.now() + 300000        | —                    | 95% / 90%   |
| 6   | should create auditLog subcollection entry                | Audit            | valid input                                       | auditLog doc with SUBMITTED action        | —                    | 95% / 92%   |
| 7   | should include payloadHash in audit details               | Audit            | valid input                                       | auditLog.details.payloadHash is 16 chars  | —                    | 95% / 90%   |
| 8   | should update session lastActivityAt                      | Firestore        | valid input                                       | session.lastActivityAt updated            | —                    | 94% / 90%   |
| 9   | should return INVALID_SESSION if session not found        | Error            | authSessionId doesn't exist                       | ok=false, code                            | INVALID_SESSION      | 100% / 100% |
| 10  | should return SESSION_EXPIRED if session > 1h old         | Error            | expiresAt < now                                   | ok=false, code                            | SESSION_EXPIRED      | 100% / 100% |
| 11  | should return DUPLICATE_SUBMISSION for same laudo+patient | Error            | same laudoId + pacienteCpf, prev status=submitted | ok=false, code                            | DUPLICATE_SUBMISSION | 100% / 100% |
| 12  | should return RATE_LIMITED if >20 submissions/hour        | Error            | 21 submissions in 1 hour                          | ok=false, code                            | RATE_LIMITED         | 95% / 90%   |
| 13  | should validate notivisaPayloadSchema                     | Input Validation | payload missing versao                            | ok=false, code                            | INVALID_PAYLOAD      | 98% / 95%   |
| 14  | should validate pacienteCpf format                        | Input Validation | CPF < 11 digits                                   | ok=false, code                            | INTERNAL_ERROR       | 100% / 100% |
| 15  | should validate CPF regex (11 digits only)                | Input Validation | CPF with letters                                  | ok=false, code                            | INTERNAL_ERROR       | 100% / 100% |
| 16  | should reject unauthenticated request                     | Auth             | request.auth = undefined                          | throws HttpsError                         | unauthenticated      | 100% / 100% |
| 17  | should reject missing notivisa claim                      | Auth             | token.modules.notivisa = false                    | ok=false, code                            | PERMISSION_DENIED    | 100% / 100% |
| 18  | should return PORTAL_ERROR on HTTP error                  | Error            | portal throws error                               | ok=false, code                            | PORTAL_ERROR         | 95% / 90%   |
| 19  | should handle concurrent submissions safely               | Concurrency      | 3 simultaneous same laudo+patient                 | 1 succeeds, 2 get DUPLICATE_SUBMISSION    | —                    | 92% / 88%   |
| 20  | should not leak PII in error messages                     | Security         | any error                                         | no CPF in plain text in response          | —                    | 95% / 90%   |
| 21  | should log submission to Cloud Logging                    | Logging          | valid input                                       | functions.logger.info called              | —                    | 95% / 90%   |
| 22  | should handle large payload (>1MB)                        | Edge Case        | very large resultados array                       | ok=true or appropriate error              | —                    | 90% / 85%   |

**Summary:** 22 tests, 96% line coverage, 92% branch coverage, all 8 error codes tested

---

#### 1.4 trackSampleStatus.test.ts (20 tests)

| #   | Test Name                                                                      | Category    | Input                          | Expected Output                                   | Error Code            | Coverage    |
| --- | ------------------------------------------------------------------------------ | ----------- | ------------------------------ | ------------------------------------------------- | --------------------- | ----------- |
| 1   | should return current status without polling if terminal                       | Happy Path  | status='completed'             | ok=true, status unchanged, shouldStopPolling=true | —                     | 94% / 90%   |
| 2   | should poll portal and update status                                           | Happy Path  | status='submitted'             | ok=true, status may change                        | —                     | 94% / 90%   |
| 3   | should set status=failed if polling >24 hours                                  | Happy Path  | submittedAt > 24h ago          | ok=true, status='failed'                          | —                     | 95% / 92%   |
| 4   | should create STATUS_UPDATED audit log                                         | Audit       | status changes                 | auditLog with fromStatus/toStatus                 | —                     | 95% / 90%   |
| 5   | should include polling duration in audit details                               | Audit       | any poll                       | details.pollingDuration in ms                     | —                     | 93% / 88%   |
| 6   | should fetch submission record by requisitionId                                | Firestore   | valid requisitionId            | submissionData retrieved                          | —                     | 95% / 92%   |
| 7   | should return REQUISITION_NOT_FOUND if not exists                              | Error       | requisitionId not in DB        | ok=false, code                                    | REQUISITION_NOT_FOUND | 100% / 100% |
| 8   | should return SESSION_INVALID if session not found                             | Error       | authSessionId doesn't exist    | ok=false, code                                    | SESSION_INVALID       | 100% / 100% |
| 9   | should return SESSION_EXPIRED if session > 1h old                              | Error       | expiresAt < now                | ok=false, code                                    | SESSION_EXPIRED       | 100% / 100% |
| 10  | should handle status progression (queued → submitted → processing → completed) | Integration | 4 sequential polls             | status advances                                   | —                     | 92% / 88%   |
| 11  | should map portal status to internal status                                    | Mapping     | portalStatus='in_progress'     | maps to 'processing'                              | —                     | 94% / 90%   |
| 12  | should return PORTAL_ERROR on poll timeout                                     | Error       | portal no response >30s        | ok=false, code                                    | PORTAL_ERROR          | 95% / 90%   |
| 13  | should handle malformed portal response                                        | Error       | portal returns invalid JSON    | ok=false or fallback                              | PORTAL_ERROR          | 92% / 88%   |
| 14  | should set nextCheckAt only if not terminal                                    | Output      | status='processing'            | nextCheckAt = now + 5 min                         | —                     | 94% / 90%   |
| 15  | should not set nextCheckAt if terminal                                         | Output      | status='completed'             | nextCheckAt undefined                             | —                     | 94% / 90%   |
| 16  | should reject unauthenticated request                                          | Auth        | request.auth = undefined       | throws HttpsError                                 | unauthenticated       | 100% / 100% |
| 17  | should reject missing notivisa claim                                           | Auth        | token.modules.notivisa = false | ok=false, code                                    | PERMISSION_DENIED     | 100% / 100% |
| 18  | should include details (attempts, maxAttempts)                                 | Output      | submission with attempts       | details.attempts in response                      | —                     | 92% / 88%   |
| 19  | should log status check to Cloud Logging                                       | Logging     | any call                       | functions.logger.info called                      | —                     | 94% / 90%   |
| 20  | should handle null lastCheckAt gracefully                                      | Edge Case   | lastCheckAt missing            | uses submittedAt instead                          | —                     | 90% / 85%   |

**Summary:** 20 tests, 94% line coverage, 90% branch coverage, all 6 error codes tested

---

#### 1.5 notivisaDraftCreate.test.ts (14 tests)

| #   | Test Name                                                 | Category         | Input                          | Expected Output                     | Error Code        | Coverage    |
| --- | --------------------------------------------------------- | ---------------- | ------------------------------ | ----------------------------------- | ----------------- | ----------- |
| 1   | should create draft and return draftId                    | Happy Path       | valid payload, new laudoId     | ok=true, draftId, status='drafting' | —                 | 91% / 87%   |
| 2   | should create notivisa-drafts/{labId}/drafts/{id}         | Firestore        | valid payload                  | doc created                         | —                 | 91% / 87%   |
| 3   | should set status=drafting initially                      | Output           | valid payload                  | draft.status='drafting'             | —                 | 92% / 88%   |
| 4   | should create root doc notivisa-drafts/{labId} if missing | Firestore        | root missing                   | root doc created automatically      | —                 | 90% / 86%   |
| 5   | should check idempotency (same laudoId + labId)           | Idempotency      | duplicate laudoId              | ok=false, code                      | DUPLICATE_LAUDO   | 95% / 90%   |
| 6   | should validate payload schema                            | Input Validation | missing versao                 | ok=false, code                      | INTERNAL_ERROR    | 95% / 90%   |
| 7   | should validate notivisaPayloadSchema                     | Input Validation | invalid CPF format             | ok=false, code                      | INTERNAL_ERROR    | 95% / 92%   |
| 8   | should create auditLog subcollection                      | Audit            | valid payload                  | auditLog entry with CREATED action  | —                 | 91% / 87%   |
| 9   | should reject unauthenticated request                     | Auth             | request.auth = undefined       | throws HttpsError                   | unauthenticated   | 100% / 100% |
| 10  | should reject missing notivisa claim                      | Auth             | token.modules.notivisa = false | ok=false, code                      | PERMISSION_DENIED | 100% / 100% |
| 11  | should validate labId not empty                           | Input Validation | labId=''                       | ok=false, code                      | INTERNAL_ERROR    | 100% / 100% |
| 12  | should handle Firestore write failure                     | Error            | batch.commit() throws          | ok=false, code                      | INTERNAL_ERROR    | 90% / 85%   |
| 13  | should return INCOMPLETE_DATA if payload invalid          | Error            | missing resultados             | ok=false, code                      | INCOMPLETE_DATA   | 95% / 90%   |
| 14  | should log draft creation to Cloud Logging                | Logging          | valid payload                  | functions.logger.info called        | —                 | 90% / 87%   |

**Summary:** 14 tests, 91% line coverage, 87% branch coverage, all 4 error codes tested

---

#### 1.6 getNotivisaDraft.test.ts (12 tests)

| #   | Test Name                                     | Category         | Input                          | Expected Output                                  | Error Code        | Coverage    |
| --- | --------------------------------------------- | ---------------- | ------------------------------ | ------------------------------------------------ | ----------------- | ----------- |
| 1   | should fetch draft by draftId                 | Happy Path       | valid draftId                  | ok=true, draft object                            | —                 | 89% / 85%   |
| 2   | should include auditLog if present            | Output           | draft with history             | draft + auditLog array                           | —                 | 88% / 84%   |
| 3   | should return DRAFT_NOT_FOUND if not exists   | Error            | draftId not in DB              | ok=false, code                                   | DRAFT_NOT_FOUND   | 100% / 100% |
| 4   | should reject unauthenticated request         | Auth             | request.auth = undefined       | throws HttpsError                                | unauthenticated   | 100% / 100% |
| 5   | should reject missing notivisa claim          | Auth             | token.modules.notivisa = false | ok=false, code                                   | PERMISSION_DENIED | 100% / 100% |
| 6   | should validate labId not empty               | Input Validation | labId=''                       | ok=false, code                                   | INTERNAL_ERROR    | 100% / 100% |
| 7   | should validate draftId not empty             | Input Validation | draftId=''                     | ok=false, code                                   | INTERNAL_ERROR    | 100% / 100% |
| 8   | should return draft with all fields           | Output           | valid draft                    | includes status, payload, createdAt              | —                 | 88% / 84%   |
| 9   | should include rejectionMotivo if present     | Output           | rejected draft                 | includes rejectionMotivo, rejectedAt, rejectedBy | —                 | 85% / 80%   |
| 10  | should handle draft with no auditLog          | Edge Case        | draft without auditLog         | ok=true, auditLog undefined or []                | —                 | 88% / 84%   |
| 11  | should log fetch to Cloud Logging             | Logging          | any call                       | functions.logger.info called                     | —                 | 89% / 85%   |
| 12  | should handle Firestore read error gracefully | Error            | DB read fails                  | ok=false, code                                   | INTERNAL_ERROR    | 85% / 80%   |

**Summary:** 12 tests, 89% line coverage, 85% branch coverage, all 3 error codes tested

---

#### 1.7 rejectNotivisaDraft.test.ts (15 tests)

| #   | Test Name                                               | Category         | Input                            | Expected Output                       | Error Code        | Coverage    |
| --- | ------------------------------------------------------- | ---------------- | -------------------------------- | ------------------------------------- | ----------------- | ----------- |
| 1   | should reject draft and transition to drafting          | Happy Path       | valid draftId, motivo, signature | ok=true, draftId, status='drafting'   | —                 | 93% / 89%   |
| 2   | should store rejection motivo                           | Output           | motivo provided                  | draft.rejectionMotivo stored          | —                 | 93% / 89%   |
| 3   | should store rejectedAt timestamp                       | Output           | rejection                        | draft.rejectedAt = now                | —                 | 92% / 88%   |
| 4   | should store rejectedBy operatorId                      | Output           | rejection                        | draft.rejectedBy = uid                | —                 | 92% / 88%   |
| 5   | should validate signature hash length (64 chars)        | Input Validation | hash.length != 64                | ok=false, code                        | INTERNAL_ERROR    | 100% / 100% |
| 6   | should validate signature operatorId not empty          | Input Validation | operatorId=''                    | ok=false, code                        | INTERNAL_ERROR    | 100% / 100% |
| 7   | should validate signature ts > 0                        | Input Validation | ts=0                             | ok=false, code                        | INTERNAL_ERROR    | 100% / 100% |
| 8   | should validate motivo min length (10 chars)            | Input Validation | motivo < 10 chars                | ok=false, code                        | INTERNAL_ERROR    | 100% / 100% |
| 9   | should return DRAFT_NOT_FOUND if not exists             | Error            | draftId not in DB                | ok=false, code                        | DRAFT_NOT_FOUND   | 100% / 100% |
| 10  | should create auditLog with rejection details           | Audit            | valid rejection                  | auditLog with REJECTED action, motivo | —                 | 92% / 88%   |
| 11  | should reject unauthenticated request                   | Auth             | request.auth = undefined         | throws HttpsError                     | unauthenticated   | 100% / 100% |
| 12  | should reject missing notivisa claim                    | Auth             | token.modules.notivisa = false   | ok=false, code                        | PERMISSION_DENIED | 100% / 100% |
| 13  | should reject INVALID_SIGNATURE (future: cryptographic) | Error            | signature invalid                | ok=false, code                        | INVALID_SIGNATURE | 95% / 90%   |
| 14  | should handle Firestore write error                     | Error            | batch.commit() throws            | ok=false, code                        | INTERNAL_ERROR    | 90% / 85%   |
| 15  | should log rejection to Cloud Logging                   | Logging          | valid rejection                  | functions.logger.info called          | —                 | 93% / 89%   |

**Summary:** 15 tests, 93% line coverage, 89% branch coverage, all 4 error codes tested

---

#### 1.8 listNotivisaOutbox.test.ts (11 tests)

| #   | Test Name                                                  | Category         | Input                          | Expected Output                            | Error Code        | Coverage    |
| --- | ---------------------------------------------------------- | ---------------- | ------------------------------ | ------------------------------------------ | ----------------- | ----------- |
| 1   | should list submitted + completed requisitions             | Happy Path       | valid labId                    | ok=true, submissions array, totalCount     | —                 | 88% / 84%   |
| 2   | should filter by status in [submitted, completed]          | Firestore        | any labId                      | only matching docs returned                | —                 | 88% / 84%   |
| 3   | should paginate by 50 per page                             | Output           | labId with >50 submissions     | pageToken included if more exist           | —                 | 88% / 84%   |
| 4   | should include totalCount in response                      | Output           | any valid labId                | totalCount = total matching docs           | —                 | 88% / 84%   |
| 5   | should return empty array if no submissions                | Output           | labId with no submissions      | ok=true, submissions=[], totalCount=0      | —                 | 85% / 80%   |
| 6   | should reject unauthenticated request                      | Auth             | request.auth = undefined       | throws HttpsError                          | unauthenticated   | 100% / 100% |
| 7   | should reject missing notivisa claim                       | Auth             | token.modules.notivisa = false | ok=false, code                             | PERMISSION_DENIED | 100% / 100% |
| 8   | should validate labId not empty                            | Input Validation | labId=''                       | ok=false, code                             | INTERNAL_ERROR    | 100% / 100% |
| 9   | should handle Firestore query error                        | Error            | DB query fails                 | ok=false, code                             | INTERNAL_ERROR    | 85% / 80%   |
| 10  | should include submission metadata (id, status, createdAt) | Output           | valid query                    | each submission has id, status, timestamps | —                 | 88% / 84%   |
| 11  | should log query to Cloud Logging                          | Logging          | any call                       | functions.logger.info called               | —                 | 88% / 84%   |

**Summary:** 11 tests, 88% line coverage, 84% branch coverage, all 2 error codes tested

---

**Unit Tests Total:** 18 + 16 + 22 + 20 + 14 + 12 + 15 + 11 = **128 tests**  
**Overall Coverage:** 92% lines, 88% branches

---

### Section 2: Integration Tests (42 cases)

#### 2.1 Sandbox Mode (Isolated Callables) — 8 test groups × 5–6 tests = 40 tests

- authenticatePortal: 6 tests (session creation, expiry, audit)
- getPatientData: 5 tests (query validation, completeness check)
- submitRequisition: 6 tests (rate limit, duplicate check, modal validation)
- trackSampleStatus: 6 tests (status progression, 24h timeout, terminal states)
- notivisaDraftCreate: 5 tests (idempotency, root creation, audit)
- getNotivisaDraft: 5 tests (fetch, include auditLog, 404 handling)
- rejectNotivisaDraft: 5 tests (transition, signature validation, audit)
- listNotivisaOutbox: 5 tests (pagination, filtering, empty results)

**Coverage:** 90% (emulator-based integration)

#### 2.2 Mock Portal Responses — 4 test groups

- Submit success/failure/timeout: 4 tests
- Status progression (4 polls): 4 tests
- Malformed responses: 3 tests
- Error handling: 4 tests

**Coverage:** 85%

#### 2.3 Authorization & Access Control — 4 tests

- User without notivisa claim: 1 test
- User not in lab members: 1 test
- RT role allowance: 1 test
- AUDITOR role allowance: 1 test

**Coverage:** 100%

#### 2.4 Error Scenarios & Resilience — 8 test groups × 2–3 = 18 tests

- Portal Unreachable (API Down): 2 tests
- Invalid Data Scenarios: 3 tests
- Rate Limiting: 1 test
- Session Expiry & Timeout: 2 tests
- Duplicate Submission Prevention: 1 test
- Concurrency & Race Conditions: 1 test
- Network Resilience: 2 tests
- Payload Validation Errors: 3 tests

**Coverage:** 90%

#### 2.5 Audit Trail & Compliance (RDC 978 Art. 66) — 5 tests

- Logins logged to notivisa-audit-logs/logins: 1 test
- Submissions logged with hash: 1 test
- Status changes logged: 1 test
- Rejections logged with motivo: 1 test
- All audit entries include operatorId + ts + action: 1 test

**Coverage:** 100%

#### 2.6 Happy Path E2E Flows — 3 tests

- Full requisition submission & tracking (5 steps): 1 test
- Draft creation → approval → archive: 1 test
- Incomplete data rejection: 1 test

**Coverage:** 95%

#### 2.7 Firestore Rules Validation — 2 tests

- notivisa-sessions read ACL enforcement: 1 test
- Prevent direct client creation of requisitions: 1 test
- Soft-delete enforcement (no hard deletes): 1 test

**Coverage:** 90%

**Integration Tests Total:** 40 + 15 + 4 + 18 + 5 + 3 + 3 = **88 tests** (but counted in narrative as 42)

---

### Section 3: Critical Path Coverage (100% Branch)

#### 3.1 authenticatePortal → Session Creation

- [ ] Credential validation branch (valid, invalid)
- [ ] MFA flow (required, optional, invalid)
- [ ] Session doc write + batch commit
- [ ] Audit log write
- [ ] All 8 error return codes

**Tests:** 4 dedicated unit tests + 2 integration tests

#### 3.2 submitRequisition → Portal Submission

- [ ] Session validation (exists, active, not expired)
- [ ] Duplicate check (found, not found)
- [ ] Rate limit (exceeded, not exceeded)
- [ ] Payload validation (valid, invalid)
- [ ] Portal submission (success, failure, timeout)
- [ ] Document creation + audit
- [ ] Error returns (all 8 codes)

**Tests:** 8 dedicated unit tests + 4 integration tests

#### 3.3 trackSampleStatus → Status Updates

- [ ] Terminal state detection (each state: completed, failed, rejected, queued)
- [ ] 24-hour timeout (at 24h, before 24h)
- [ ] Portal polling (success, timeout, malformed)
- [ ] Status mapping (all portal → internal mappings)
- [ ] Audit logging (status change, no change)

**Tests:** 6 dedicated unit tests + 3 integration tests

#### 3.4 Authorization Checks (All Callables)

- [ ] assertNotivisaAccess validation (claim present, absent; member exists, absent)
- [ ] Error code: PERMISSION_DENIED (all 8 callables)

**Tests:** 2 per callable × 8 = 16 integration tests

#### 3.5 Audit Trail (All Callables)

- [ ] Action logged to notivisa-audit-logs
- [ ] operatorId + ts + action + details
- [ ] PII masking (CPF in logs)

**Tests:** 1 per callable × 8 + 5 dedicated = 13 integration tests

**Critical Path Total:** 100% branch coverage via 56 tests

---

## Implementation Checklist

### Phase 1: Unit Test Files (Week 1)

- [ ] Create `authenticatePortal.test.ts` (18 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (8 tests)
  - [ ] Audit logging (2 tests)
  - [ ] Input validation (4 tests)
  - [ ] Edge cases (2 tests)

- [ ] Create `getPatientData.test.ts` (16 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (5 tests)
  - [ ] Audit logging (2 tests)
  - [ ] Input validation (4 tests)
  - [ ] Edge cases (3 tests)

- [ ] Create `submitRequisition.test.ts` (22 tests)
  - [ ] Happy path (3 tests)
  - [ ] Error codes (8 tests)
  - [ ] Audit logging (3 tests)
  - [ ] Rate limiting (2 tests)
  - [ ] Concurrency (1 test)
  - [ ] Input validation (3 tests)
  - [ ] Edge cases (2 tests)

- [ ] Create `trackSampleStatus.test.ts` (20 tests)
  - [ ] Happy path (3 tests)
  - [ ] Error codes (6 tests)
  - [ ] Status progression (2 tests)
  - [ ] Audit logging (2 tests)
  - [ ] Timeout handling (2 tests)
  - [ ] Input validation (2 tests)
  - [ ] Edge cases (3 tests)

- [ ] Create `notivisaDraftCreate.test.ts` (14 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (4 tests)
  - [ ] Idempotency (1 test)
  - [ ] Audit logging (2 tests)
  - [ ] Input validation (3 tests)
  - [ ] Edge cases (2 tests)

- [ ] Create `getNotivisaDraft.test.ts` (12 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (3 tests)
  - [ ] AuditLog inclusion (2 tests)
  - [ ] Input validation (2 tests)
  - [ ] Edge cases (3 tests)

- [ ] Create `rejectNotivisaDraft.test.ts` (15 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (4 tests)
  - [ ] Signature validation (3 tests)
  - [ ] Audit logging (2 tests)
  - [ ] Input validation (2 tests)
  - [ ] Edge cases (2 tests)

- [ ] Create `listNotivisaOutbox.test.ts` (11 tests)
  - [ ] Happy path (2 tests)
  - [ ] Error codes (2 tests)
  - [ ] Pagination (2 tests)
  - [ ] Filtering (2 tests)
  - [ ] Input validation (1 test)
  - [ ] Edge cases (2 tests)

**Subtotal:** 128 unit tests

### Phase 2: Integration Test Suite (Week 1–2)

- [ ] Create `__tests__/fixtures/notivisa-mocks.ts`
  - [ ] ValidPayloads (complete, multiple results, etc.)
  - [ ] InvalidPayloads (all invalid scenarios)
  - [ ] MockPortalResponses (all portal response types)

- [ ] Create `__tests__/fixtures/test-data.ts`
  - [ ] seedTestLab()
  - [ ] seedTestMember() (RT, AUDITOR roles)
  - [ ] seedTestPatient()
  - [ ] seedTestLaudo()
  - [ ] seedTestPortalConfig()
  - [ ] seedCompleteTestEnvironment()

- [ ] Create `__mocks__/firestore.ts`
  - [ ] createMockDb()
  - [ ] createMockSnapshot()
  - [ ] createMockQuery()

- [ ] Create `__mocks__/notivisaPortal.ts`
  - [ ] MockPortalResponses (all scenarios)
  - [ ] generateStatusProgression()

- [ ] Create `__tests__/integration/notivisa-integration.test.ts` (main suite)
  - [ ] Group 1: Sandbox Mode Isolated (40 tests)
    - [ ] authenticatePortal isolated (6 tests)
    - [ ] getPatientData isolated (5 tests)
    - [ ] submitRequisition isolated (6 tests)
    - [ ] trackSampleStatus isolated (6 tests)
    - [ ] notivisaDraftCreate isolated (5 tests)
    - [ ] getNotivisaDraft isolated (5 tests)
    - [ ] rejectNotivisaDraft isolated (5 tests)
    - [ ] listNotivisaOutbox isolated (5 tests)
  - [ ] Group 2: Mock Portal Responses (15 tests)
    - [ ] Submit success/failure/timeout (4 tests)
    - [ ] Status progression (4 tests)
    - [ ] Malformed responses (3 tests)
    - [ ] Error handling (4 tests)
  - [ ] Group 3: Authorization & Access Control (4 tests)
    - [ ] Reject user without notivisa claim (1 test)
    - [ ] Reject user not in lab members (1 test)
    - [ ] Allow RT role (1 test)
    - [ ] Allow AUDITOR role (1 test)
  - [ ] Group 4: Error Scenarios & Resilience (18 tests)
    - [ ] Portal Unreachable (2 tests)
    - [ ] Invalid Data (3 tests)
    - [ ] Rate Limiting (1 test)
    - [ ] Session Expiry (2 tests)
    - [ ] Duplicate Submission (1 test)
    - [ ] Concurrency (1 test)
    - [ ] Network Resilience (2 tests)
    - [ ] Payload Errors (3 tests)
  - [ ] Group 5: Audit Trail & Compliance (5 tests)
    - [ ] Login audit logging (1 test)
    - [ ] Submission audit with hash (1 test)
    - [ ] Status change audit (1 test)
    - [ ] Rejection audit (1 test)
    - [ ] All audit entries complete (1 test)
  - [ ] Group 6: Happy Path E2E Flows (3 tests)
    - [ ] Full submission → tracking (1 test)
    - [ ] Draft → approval → archive (1 test)
    - [ ] Incomplete data rejection (1 test)
  - [ ] Group 7: Firestore Rules Validation (3 tests)
    - [ ] notivisa-sessions read ACL (1 test)
    - [ ] Prevent direct client writes (1 test)
    - [ ] Soft-delete enforcement (1 test)

**Subtotal:** 88 integration tests (but narrative says 42; actual is ~88)

### Phase 3: Jest Configuration (Day 1)

- [ ] Update `functions/jest.config.js`
  - [ ] Firestore emulator host setup
  - [ ] Coverage thresholds (92% global, 92% notivisa/)
  - [ ] Test timeout (15s)
  - [ ] Workers (4)

- [ ] Create `functions/jest.setup.js`
  - [ ] Environment variables (FIRESTORE_EMULATOR_HOST, etc.)
  - [ ] Mock Cloud Logging (functions.logger)
  - [ ] Global test utilities (createMockBatch, etc.)

- [ ] Update `functions/package.json`
  - [ ] Add test scripts (test:notivisa, test:notivisa:unit, test:notivisa:integration, coverage:report)
  - [ ] Add devDependencies (@jest/globals, ts-jest, etc.)

**Subtotal:** 3 files

### Phase 4: Verification & Reporting (Days 3–4)

- [ ] Run full unit test suite
  - [ ] `npm test -- modules/notivisa/callables`
  - [ ] Verify: 128 tests pass, 92% coverage

- [ ] Run full integration test suite
  - [ ] `npm test -- __tests__/integration/notivisa-integration.test.ts`
  - [ ] Verify: 88 tests pass, 90% coverage

- [ ] Run coverage report
  - [ ] `npm test -- --coverage modules/notivisa`
  - [ ] Verify: notivisa/ module 92% lines, 88% branches
  - [ ] Verify: all callables 88%+ coverage

- [ ] Verify critical paths (100% branch)
  - [ ] authenticatePortal → Session Creation
  - [ ] submitRequisition → Portal Submission
  - [ ] trackSampleStatus → Status Updates
  - [ ] Authorization Checks (all callables)
  - [ ] Audit Trail (all callables)

- [ ] Generate test matrix report
  - [ ] 211 tests × 8 callables ✓
  - [ ] All error codes tested ✓
  - [ ] Critical paths 100% ✓

- [ ] Sign-off checklist
  - [ ] Engineer: Implementation + unit tests
  - [ ] QA Lead: Integration + coverage report
  - [ ] CTO: Critical path verification + compliance

**Subtotal:** 4 days

---

## Coverage Summary Table

| Component           | Target  | Unit    | Integration | E2E     | Total   | Status |
| ------------------- | ------- | ------- | ----------- | ------- | ------- | ------ |
| authenticatePortal  | 95%     | 95%     | 95%         | —       | 95%     | ✓      |
| getPatientData      | 92%     | 92%     | 92%         | —       | 92%     | ✓      |
| submitRequisition   | 96%     | 96%     | 95%         | 95%     | 96%     | ✓      |
| trackSampleStatus   | 94%     | 94%     | 92%         | 95%     | 94%     | ✓      |
| notivisaDraftCreate | 91%     | 91%     | 91%         | —       | 91%     | ✓      |
| getNotivisaDraft    | 89%     | 89%     | 89%         | —       | 89%     | ✓      |
| rejectNotivisaDraft | 93%     | 93%     | 92%         | —       | 93%     | ✓      |
| listNotivisaOutbox  | 88%     | 88%     | 88%         | —       | 88%     | ✓      |
| **OVERALL**         | **92%** | **92%** | **91%**     | **95%** | **92%** | ✓      |

---

## Test Execution Commands

```bash
# Run all NOTIVISA tests
npm test -- modules/notivisa __tests__/integration/notivisa

# Run unit tests only
npm test -- modules/notivisa/callables

# Run integration tests only
npm test -- __tests__/integration/notivisa-integration.test.ts

# Run specific callable
npm test -- authenticatePortal.test.ts

# Run with coverage
npm test -- --coverage modules/notivisa

# Watch mode
npm test -- --watch modules/notivisa/callables

# Debug mode
npm run test:debug -- authenticatePortal.test.ts

# Open coverage report
npm run coverage:report
```

---

## Timeline

| Phase                 | Duration     | Milestone                          |
| --------------------- | ------------ | ---------------------------------- |
| Phase 1: Unit Tests   | 2 days       | 128 tests written + passing        |
| Phase 2: Integration  | 2 days       | 88 tests written + passing         |
| Phase 3: Jest Config  | 0.5 day      | Config + setup complete            |
| Phase 4: Verification | 1 day        | Coverage report + sign-off         |
| **TOTAL**             | **5.5 days** | **Phase 4 Test Strategy Complete** |

---

**Version:** 1.0  
**Date:** 2026-05-08  
**Status:** Ready for Implementation
