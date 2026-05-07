/**
 * PrivacyPage Component — Privacy policy display with acceptance tracking
 *
 * Features:
 * - Display current privacy policy (markdown)
 * - Version history dropdown
 * - Acceptance checkbox and button
 * - Shows acceptance confirmation if already accepted
 * - LGPD Art. 9 (transparência) + user consent tracking
 */

import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { usePrivacyPolicy } from '../hooks/usePrivacyPolicy';
import { getAllPolicyVersions, getUserCurrentAcceptance, recordAceite } from '../services/lgpdService';
import type { PolicyVersion, PrivacyAceite } from '../types';

interface PrivacyPageProps {
  labId: string;
  userId: string;
}

/**
 * Sanitize and escape user-provided content before rendering
 * Prevents XSS attacks via HTML/script injection
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Simple markdown-to-HTML renderer with XSS protection (bold, italic, links, headers)
 * All user input is escaped before being converted to HTML
 */
function renderMarkdown(markdown: string): string {
  const html = markdown
    .split('\n')
    .map((line) => {
      // Escape the line first to prevent injection
      let escaped = escapeHtml(line);

      // Bold (safe: only affects already-escaped content)
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Links (only allow http/https/mailto)
      escaped = escaped.replace(/\[(.*?)\]\((https?:\/\/.*?|mailto:.*?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');

      // Headers (safe: content already escaped)
      if (line.startsWith('### ')) {
        return `<h3 class="text-lg font-semibold mt-4 mb-2">${escaped.substring(4)}</h3>`;
      }
      if (line.startsWith('## ')) {
        return `<h2 class="text-xl font-semibold mt-6 mb-3">${escaped.substring(3)}</h2>`;
      }
      if (line.startsWith('# ')) {
        return `<h1 class="text-2xl font-bold mt-8 mb-4">${escaped.substring(2)}</h1>`;
      }
      // List items
      if (line.startsWith('- ')) {
        return `<li class="ml-6 mb-1">${escaped.substring(2)}</li>`;
      }
      return escaped;
    })
    .join('\n');

  // Final sanitization with DOMPurify to remove any remaining vectors
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'strong', 'em', 'a', 'li', 'ul', 'ol', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

export function PrivacyPage({ labId, userId }: PrivacyPageProps) {
  const { policy, loading } = usePrivacyPolicy(labId);
  const [allVersions, setAllVersions] = useState<PolicyVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PolicyVersion | null>(null);
  const [currentAcceptance, setCurrentAcceptance] = useState<PrivacyAceite | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Load all versions
  useEffect(() => {
    const loadVersions = async () => {
      try {
        const versions = await getAllPolicyVersions(labId);
        setAllVersions(versions);
      } catch (err) {
        console.error('[PrivacyPage] Error loading versions:', err);
      }
    };
    loadVersions();
  }, [labId]);

  // Set selected version when policy loads
  useEffect(() => {
    if (policy) {
      setSelectedVersion(policy);
      checkCurrentAcceptance();
    }
  }, [policy]);

  // Check if user already accepted current version
  const checkCurrentAcceptance = async () => {
    if (!policy) return;
    try {
      const acceptance = await getUserCurrentAcceptance(userId, policy.id);
      setCurrentAcceptance(acceptance);
      setIsAccepted(acceptance !== null);
    } catch (err) {
      console.error('[PrivacyPage] Error checking acceptance:', err);
    }
  };

  const handleAccept = async () => {
    if (!policy) return;

    setIsRecording(true);
    setRecordError(null);

    try {
      // Get user's IP and UA (approximate)
      const ipAddr = 'browser-client'; // Browser cannot reliably get own IP
      const userAgent = navigator.userAgent;

      await recordAceite(userId, labId, policy.id, policy.versao, ipAddr, userAgent);

      setIsAccepted(true);
      setCurrentAcceptance({
        id: 'just-created',
        labId,
        userId,
        policyVersionId: policy.id,
        policyVersao: policy.versao,
        aceiteEm: new (require('firebase/firestore').Timestamp)(),
        ipAddr,
        userAgent,
      });
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Erro ao registrar aceitação');
    } finally {
      setIsRecording(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="animate-pulse w-12 h-12 bg-white/10 rounded-lg mx-auto" />
          <p>Carregando Política de Privacidade...</p>
        </div>
      </div>
    );
  }

  const displayPolicy = selectedVersion || policy;

  return (
    <div className="min-h-screen bg-[#141417] text-white/90">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#141417]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-3xl font-semibold mb-2">Política de Privacidade</h1>
          <p className="text-white/60">
            Versão {displayPolicy.versao} • Publicada em{' '}
            {displayPolicy.criadoEm?.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Version History */}
        {allVersions.length > 1 && (
          <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-lg">
            <label className="block text-sm font-medium mb-3">Histórico de Versões</label>
            <select
              value={displayPolicy.id}
              onChange={(e) => {
                const selected = allVersions.find((v) => v.id === e.target.value);
                if (selected) setSelectedVersion(selected);
              }}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white focus:outline-none focus:border-violet-500"
            >
              {allVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versao} ({v.criadoEm?.toDate().toLocaleDateString('pt-BR')})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Policy Content */}
        <div
          className="prose prose-invert max-w-none mb-8 prose-p:text-white/90 prose-headings:text-white prose-a:text-blue-400 prose-li:text-white/90 space-y-4"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(displayPolicy.conteudo) }}
        />

        {/* Acceptance Section */}
        <div className="p-6 bg-white/5 border border-white/10 rounded-lg space-y-4">
          {isAccepted && currentAcceptance ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Você aceitou esta versão</span>
              </div>
              <p className="text-sm text-white/60">
                Aceito em {currentAcceptance.aceiteEm?.toDate().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ) : (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAccepted}
                  onChange={(e) => setIsAccepted(e.target.checked)}
                  disabled={isRecording}
                  className="w-5 h-5 mt-1 rounded bg-white/10 border border-white/20 cursor-pointer accent-violet-500 disabled:opacity-50"
                />
                <span className="text-sm leading-relaxed">
                  Li e aceito a Política de Privacidade acima
                </span>
              </label>

              {recordError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  ✗ {recordError}
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={!isAccepted || isRecording}
                className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {isRecording ? 'Registrando aceitação...' : 'Aceitar'}
              </button>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-white/10 text-xs text-white/40">
          <p>
            Para mais informações sobre como seus dados são processados, entre em contato com nosso
            Responsável Técnico.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPage;
