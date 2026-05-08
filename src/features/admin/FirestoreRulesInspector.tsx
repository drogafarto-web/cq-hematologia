/**
 * Firestore Rules Inspector — Admin Dashboard
 * Wave 4 Agent 11 — Rules Validation & Monitoring
 *
 * Features:
 * - Visual rule tree (nested match paths)
 * - Permission matrix heatmap (collection × role × action)
 * - Interactive rule tester (form: select collection + action + role)
 *
 * Compliance: RDC 978 Art. 134, DICQ 4.5 (audit trail)
 */

import React, { useState, useMemo } from 'react';

// ── Type Definitions ────────────────────────────────────────────────────────

interface FirestoreRule {
  path: string;
  condition: string;
  action: 'read' | 'create' | 'update' | 'delete';
  requiresRole?: string[];
  requiresHmac?: boolean;
  requiresSupervisor?: boolean;
  description: string;
}

interface RuleTreeNode {
  name: string;
  path: string;
  rules: FirestoreRule[];
  children: RuleTreeNode[];
}

interface PermissionMatrixCell {
  collection: string;
  role: 'member' | 'rt' | 'admin' | 'auditor' | 'superadmin';
  action: 'read' | 'create' | 'update' | 'delete';
  allowed: boolean;
  reason: string;
}

// ── Rule Database ────────────────────────────────────────────────────────────

const FIRESTORE_RULES_DATABASE: FirestoreRule[] = [
  // ADR 0003 — Non-Conformidade
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}',
    action: 'read',
    condition: 'isActiveMemberOfLab(labId)',
    description: 'All lab members can read NCs for compliance visibility',
  },
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && hmac.size() == 64',
    requiresHmac: true,
    requiresRole: ['member', 'rt', 'admin'],
    description: 'Lab members can create NCs with HMAC signature',
  },
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}',
    action: 'update',
    condition: 'isActiveMemberOfLab(labId) && (isRT || isAdmin) && hmac.size() == 64',
    requiresRole: ['rt', 'admin'],
    requiresHmac: true,
    description: 'Only RT/admin can update NC status (CAPA workflow)',
  },
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}',
    action: 'delete',
    condition: 'false',
    description: 'Hard delete never allowed (immutable audit trail)',
  },

  // ADR 0003 — NC Status History (append-only)
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}/statusHistory/{entryId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && hmac.size() == 64',
    requiresHmac: true,
    description: 'Append-only status history with HMAC',
  },
  {
    path: '/labs/{labId}/nao-conformidades/{ncId}/statusHistory/{entryId}',
    action: 'update',
    condition: 'false',
    description: 'Status history immutable (append-only pattern)',
  },

  // ADR 0004 — POP (Procedimentos Operacionais Padrão)
  {
    path: '/labs/{labId}/pops/{popId}',
    action: 'read',
    condition: 'isActiveMemberOfLab(labId)',
    description: 'All members can read POPs (operational necessity)',
  },
  {
    path: '/labs/{labId}/pops/{popId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && (isAdmin || isSuperAdmin)',
    requiresRole: ['admin', 'superadmin'],
    description: 'Only admins can create POPs (document control)',
  },
  {
    path: '/labs/{labId}/pops/{popId}',
    action: 'delete',
    condition: 'false',
    description: 'Hard delete never allowed (immutable audit trail)',
  },

  // ADR 0004 — POP Versions
  {
    path: '/labs/{labId}/pops/{popId}/versoes/{vId}',
    action: 'read',
    condition: 'isActiveMemberOfLab(labId)',
    description: 'All members can check POP version status',
  },
  {
    path: '/labs/{labId}/pops/{popId}/versoes/{vId}',
    action: 'update',
    condition: 'isActiveMemberOfLab(labId) && isRT && hmac.size() == 64',
    requiresRole: ['rt'],
    requiresHmac: true,
    description: 'Only RT can sign (activate) POP versions',
  },

  // ADR 0005 — CIQ Runs (Supervisor enforcement)
  {
    path: '/labs/{labId}/lots/{lotId}/runs/{runId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && hasActiveSupervisor(labId)',
    requiresSupervisor: true,
    description: 'CIQ runs require active supervisor (RDC 978 Art. 122)',
  },
  {
    path: '/labs/{labId}/ciq-imuno/{lotId}/runs/{runId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && hasActiveSupervisor(labId)',
    requiresSupervisor: true,
    description: 'Imunologia CIQ runs require active supervisor',
  },
  {
    path: '/labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId) && hasActiveSupervisor(labId)',
    requiresSupervisor: true,
    description: 'Uroanalise CIQ runs require active supervisor',
  },

  // Audit Trail (Immutable)
  {
    path: '/labs/{labId}/*/audit/{auditId}',
    action: 'create',
    condition: 'isActiveMemberOfLab(labId)',
    description: 'Members can create audit entries',
  },
  {
    path: '/labs/{labId}/*/audit/{auditId}',
    action: 'update',
    condition: 'false',
    description: 'Audit entries immutable (append-only)',
  },
  {
    path: '/labs/{labId}/*/audit/{auditId}',
    action: 'delete',
    condition: 'false',
    description: 'Audit entries never deleted (regulatory requirement)',
  },
];

// ── Permission Matrix ────────────────────────────────────────────────────────

const PERMISSION_MATRIX: PermissionMatrixCell[] = [
  // nao-conformidades
  {
    collection: 'nao-conformidades',
    role: 'member',
    action: 'read',
    allowed: true,
    reason: 'isActiveMemberOfLab',
  },
  {
    collection: 'nao-conformidades',
    role: 'member',
    action: 'create',
    allowed: true,
    reason: 'isActiveMemberOfLab + HMAC',
  },
  {
    collection: 'nao-conformidades',
    role: 'member',
    action: 'update',
    allowed: false,
    reason: 'Only RT/admin can update',
  },
  {
    collection: 'nao-conformidades',
    role: 'member',
    action: 'delete',
    allowed: false,
    reason: 'Hard delete blocked',
  },
  {
    collection: 'nao-conformidades',
    role: 'rt',
    action: 'read',
    allowed: true,
    reason: 'isActiveMemberOfLab',
  },
  {
    collection: 'nao-conformidades',
    role: 'rt',
    action: 'update',
    allowed: true,
    reason: 'isRT && HMAC + status transition gate',
  },
  {
    collection: 'nao-conformidades',
    role: 'rt',
    action: 'delete',
    allowed: false,
    reason: 'Hard delete blocked',
  },
  {
    collection: 'nao-conformidades',
    role: 'admin',
    action: 'update',
    allowed: true,
    reason: 'isAdmin && HMAC',
  },

  // pops
  {
    collection: 'pops',
    role: 'member',
    action: 'read',
    allowed: true,
    reason: 'Operational necessity',
  },
  {
    collection: 'pops',
    role: 'member',
    action: 'create',
    allowed: false,
    reason: 'Only admin',
  },
  {
    collection: 'pops',
    role: 'admin',
    action: 'create',
    allowed: true,
    reason: 'Document control',
  },
  {
    collection: 'pops/versoes',
    role: 'rt',
    action: 'update',
    allowed: true,
    reason: 'RT signature authority',
  },
  {
    collection: 'pops/versoes',
    role: 'admin',
    action: 'update',
    allowed: false,
    reason: 'Only RT can sign',
  },

  // CIQ runs with supervisor
  {
    collection: 'ciq-imuno/runs',
    role: 'member',
    action: 'create',
    allowed: false,
    reason: 'Requires supervisor + RT',
  },
  {
    collection: 'ciq-imuno/runs',
    role: 'rt',
    action: 'create',
    allowed: true,
    reason: 'isRT + hasActiveSupervisor',
  },

  // Audit immutable
  {
    collection: 'audit',
    role: 'member',
    action: 'create',
    allowed: true,
    reason: 'Append-only audit trail',
  },
  {
    collection: 'audit',
    role: 'member',
    action: 'update',
    allowed: false,
    reason: 'Immutable',
  },
  {
    collection: 'audit',
    role: 'superadmin',
    action: 'delete',
    allowed: false,
    reason: 'Never delete audit trail',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export const FirestoreRulesInspector: React.FC = () => {
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [selectedAction, setSelectedAction] = useState<'read' | 'create' | 'update' | 'delete'>('read');
  const [treeExpanded, setTreeExpanded] = useState<boolean>(true);

  // Evaluate permission for selected combination
  const permission = useMemo(() => {
    const matching = PERMISSION_MATRIX.find(
      (cell) => cell.collection === selectedCollection && cell.role === (selectedRole as any) && cell.action === selectedAction
    );
    return matching;
  }, [selectedCollection, selectedRole, selectedAction]);

  // Build unique collections
  const collections = useMemo(() => {
    return Array.from(new Set(PERMISSION_MATRIX.map((p) => p.collection)));
  }, []);

  return (
    <div className="p-8 bg-[#0f0f11] text-white min-h-screen dark-first">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Firestore Rules Inspector</h1>
        <p className="text-gray-400">Wave 4 Agent 11 — Consolidated Rules (ADR 0003, 0004, 0005, 0007)</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-8">
        {/* Left: Rule Tree */}
        <div className="bg-[#1a1a1f] rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-500">Rule Tree</h2>
          <div className="text-sm font-mono space-y-1 text-gray-300 max-h-96 overflow-y-auto">
            <div className="ml-0">
              <div className="text-emerald-400">match /databases/</div>
              <div className="ml-4">
                <div className="text-emerald-400">match /labs/{'{'} labId {'}'}</div>
                <div className="ml-8 text-blue-300">
                  <div>match /nao-conformidades/{'{'} ncId {'}'}</div>
                  <div className="ml-4 text-gray-400">
                    allow read: isActiveMemberOfLab
                    <br />
                    allow create: isActiveMemberOfLab + HMAC
                    <br />
                    allow update: (isRT || isAdmin) + HMAC
                    <br />
                    allow delete: false
                  </div>
                </div>
                <div className="ml-8 text-blue-300">
                  <div>match /pops/{'{'} popId {'}'}</div>
                  <div className="ml-4 text-gray-400">
                    allow read: isActiveMemberOfLab
                    <br />
                    allow create: isAdmin
                    <br />
                    allow update: (isRT || isAdmin)
                    <br />
                    match /versoes/{'{'} vId {'}'} allow update: isRT + HMAC
                  </div>
                </div>
                <div className="ml-8 text-blue-300">
                  <div>match /*/runs/{'{'} runId {'}'}</div>
                  <div className="ml-4 text-gray-400">
                    allow create: isActiveMemberOfLab + hasActiveSupervisor (RDC 978 Art. 122)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Permission Matrix Heatmap */}
        <div className="bg-[#1a1a1f] rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-500">Permission Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-gray-400">Collection</th>
                  <th className="text-center p-2 text-gray-400">Read</th>
                  <th className="text-center p-2 text-gray-400">Create</th>
                  <th className="text-center p-2 text-gray-400">Update</th>
                  <th className="text-center p-2 text-gray-400">Delete</th>
                </tr>
              </thead>
              <tbody>
                {['nao-conformidades', 'pops', 'pops/versoes', 'ciq-imuno/runs', 'audit'].map(
                  (col) => (
                    <tr key={col} className="border-b border-gray-800 hover:bg-gray-900/50">
                      <td className="p-2 text-blue-400 font-mono">{col}</td>
                      {(['read', 'create', 'update', 'delete'] as const).map((action) => {
                        const cell = PERMISSION_MATRIX.find(
                          (c) => c.collection === col && c.role === 'rt' && c.action === action
                        );
                        return (
                          <td
                            key={`${col}-${action}`}
                            className={`text-center p-2 font-semibold ${
                              cell?.allowed ? 'text-emerald-400 bg-emerald-900/20' : 'text-red-400 bg-red-900/20'
                            }`}
                          >
                            {cell?.allowed ? '✓' : '✗'}
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">*Matrix shows RT role (most permissive non-admin)</p>
          </div>
        </div>
      </div>

      {/* Rule Tester */}
      <div className="mt-8 bg-[#1a1a1f] rounded-lg border border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4 text-emerald-500">Interactive Rule Tester</h2>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Collection Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Collection</label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f11] border border-gray-700 rounded text-white text-sm"
            >
              <option value="">Select collection...</option>
              {collections.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Role Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f11] border border-gray-700 rounded text-white text-sm"
            >
              {['member', 'rt', 'admin', 'auditor', 'superadmin'].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#0f0f11] border border-gray-700 rounded text-white text-sm"
            >
              {['read', 'create', 'update', 'delete'].map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Result</label>
            <div
              className={`w-full px-3 py-2 rounded text-sm font-semibold text-center ${
                permission?.allowed
                  ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                  : 'bg-red-900/50 text-red-400 border border-red-700'
              }`}
            >
              {permission ? (permission.allowed ? 'ALLOW ✓' : 'DENY ✗') : 'Select options'}
            </div>
          </div>
        </div>

        {/* Reason */}
        {permission && (
          <div className="bg-[#0f0f11] rounded p-4 border-l-4 border-emerald-500">
            <p className="text-sm text-gray-300">
              <strong>Reason:</strong> {permission.reason}
            </p>
          </div>
        )}
      </div>

      {/* Key Enforcement Points */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold text-blue-400 mb-2">ADR 0003: NC Global Spine</h3>
          <p className="text-sm text-gray-400">
            All labs can track NCs. RT/admin update status. HMAC on create/update. Append-only statusHistory.
          </p>
        </div>
        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
          <h3 className="font-semibold text-purple-400 mb-2">ADR 0004: POP Versionado</h3>
          <p className="text-sm text-gray-400">
            Admin creates, RT signs versions. All members read. Training records immutable. DICQ 4.3 compliant.
          </p>
        </div>
        <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
          <h3 className="font-semibold text-orange-400 mb-2">RDC 978 Art. 122: Supervisor</h3>
          <p className="text-sm text-gray-400">
            Critical CIQ runs require active supervisor. hasActiveSupervisor gate on create. Enforcement via rules.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-gray-500 text-center">
        <p>Firestore Rules Inspector v1.0 — Wave 4 Agent 11 (2026-05-08)</p>
        <p>Rules version: See firestore.rules in codebase | Last sync: 2026-05-08</p>
      </div>
    </div>
  );
};

export default FirestoreRulesInspector;
