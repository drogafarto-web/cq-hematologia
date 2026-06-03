import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();
const bucket = admin.storage().bucket();

const GenerateAuditPDFInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  sessaoId: z.string().min(1),
});

async function isActiveMemberOfLab(labId: string, uid: string): Promise<boolean> {
  try {
    const snap = await db.collection('users').doc(uid).collection('labs').doc(labId).get();
    return snap.exists && snap.data()?.ativo === true;
  } catch {
    return false;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function severityColor(sev: string): string {
  switch (sev) {
    case 'critica':
      return '#dc2626';
    case 'grave':
      return '#ea580c';
    case 'moderada':
      return '#d97706';
    case 'leve':
      return '#2563eb';
    default:
      return '#6b7280';
  }
}

export const generateAuditInternaPDF = onCall(
  { region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 120 },
  async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária');

    const parsed = GenerateAuditPDFInput.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message);
    const { labId, auditoriaId, sessaoId } = parsed.data;

    const uid = request.auth.uid;
    if (!(await isActiveMemberOfLab(labId, uid))) {
      throw new HttpsError('permission-denied', 'Sem acesso ao laboratório');
    }

    // Fetch data
    const basePath = `labs/${labId}/auditorias-internas/${auditoriaId}`;
    const [auditoriaSnap, sessaoSnap] = await Promise.all([
      db.doc(basePath).get(),
      db.doc(`${basePath}/sessoes/${sessaoId}`).get(),
    ]);

    if (!auditoriaSnap.exists || !sessaoSnap.exists) {
      throw new HttpsError('not-found', 'Auditoria ou sessão não encontrada');
    }

    const auditoria = auditoriaSnap.data()!;
    const sessao = sessaoSnap.data()!;

    // Fetch checklist items
    const itemsSnap = await db
      .collection(`${basePath}/sessoes/${sessaoId}/checklist-items`)
      .orderBy('numero', 'asc')
      .get();
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fetch achados
    const achadosSnap = await db.collection(`${basePath}/sessoes/${sessaoId}/achados`).get();
    const achados = achadosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Calculate stats
    const total = items.length;
    const conforme = items.filter((i: any) => i.resposta === 'conforme').length;
    const nc = items.filter((i: any) => i.resposta === 'nao-conforme').length;
    const na = items.filter((i: any) => i.resposta === 'N/A').length;
    const aplicaveis = total - na;
    const score = aplicaveis > 0 ? Math.round((conforme / aplicaveis) * 100) : 0;

    // Group by bloco
    const blocos: Record<string, any[]> = {};
    items.forEach((item: any) => {
      const bloco = item.bloco || 'X';
      if (!blocos[bloco]) blocos[bloco] = [];
      blocos[bloco].push(item);
    });

    const blocoLabels: Record<string, string> = {
      A: 'Documentação Legal',
      B: 'Contratos',
      C: 'Tecnologia e Equipamentos',
      D: 'Gestão',
      E: 'Infraestrutura',
      F: 'Fase Pré-Analítica',
      G: 'Fase Analítica',
      H: 'Fase Pós-Analítica',
      I: 'Informática',
      J: 'Qualidade',
    };

    const dataFormatada = new Date().toLocaleDateString('pt-BR');
    const labSnap = await db.doc(`labs/${labId}`).get();
    const labName = labSnap.data()?.nome || 'Laboratório';

    // Generate HTML
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; font-size: 11px; line-height: 1.5; }
  .cover { text-align: center; padding: 100px 0; page-break-after: always; }
  .cover h1 { font-size: 28px; color: #0f172a; margin-bottom: 8px; }
  .cover h2 { font-size: 16px; color: #475569; font-weight: normal; }
  .cover .meta { margin-top: 60px; font-size: 12px; color: #64748b; }
  h2 { color: #0f172a; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin-top: 30px; font-size: 14px; }
  h3 { color: #334155; font-size: 12px; margin-top: 20px; }
  .summary-grid { display: flex; gap: 16px; margin: 16px 0; }
  .summary-card { flex: 1; padding: 12px; border-radius: 8px; text-align: center; }
  .score-card { background: #f0fdf4; border: 1px solid #86efac; }
  .nc-card { background: #fef2f2; border: 1px solid #fca5a5; }
  .na-card { background: #f8fafc; border: 1px solid #e2e8f0; }
  .conf-card { background: #ecfeff; border: 1px solid #67e8f9; }
  .big-number { font-size: 24px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10px; }
  th { background: #f1f5f9; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; color: white; }
  .badge-conforme { background: #10b981; }
  .badge-nc { background: #ef4444; }
  .badge-na { background: #94a3b8; }
  .severity { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; color: white; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
  .signature-block { margin-top: 60px; display: flex; gap: 40px; }
  .sig-line { flex: 1; text-align: center; padding-top: 40px; border-top: 1px solid #334155; font-size: 10px; }
</style></head><body>`;

    // Cover
    html += `<div class="cover">
      <h1>RELATÓRIO DE AUDITORIA INTERNA</h1>
      <h2>${escapeHtml(labName)}</h2>
      <div class="meta">
        <p><strong>Data:</strong> ${dataFormatada}</p>
        <p><strong>Escopo:</strong> ${escapeHtml(auditoria.escopo || 'Auditoria completa - RDC 978/2025')}</p>
        <p><strong>Auditor:</strong> ${escapeHtml(sessao.auditor || 'N/D')}</p>
        <p><strong>Referência:</strong> FR-043 | PQ-24</p>
      </div>
    </div>`;

    // Executive Summary
    html += `<h2>1. Resumo Executivo</h2>
    <div class="summary-grid">
      <div class="summary-card score-card"><div class="big-number">${score}%</div><div>Score Geral</div></div>
      <div class="summary-card conf-card"><div class="big-number">${conforme}</div><div>Conforme</div></div>
      <div class="summary-card nc-card"><div class="big-number">${nc}</div><div>Não Conforme</div></div>
      <div class="summary-card na-card"><div class="big-number">${na}</div><div>N/A</div></div>
    </div>
    <p><strong>Total de itens avaliados:</strong> ${total} | <strong>Aplicáveis:</strong> ${aplicaveis}</p>
    <p><strong>Nível de risco:</strong> ${score >= 80 ? 'Baixo' : score >= 60 ? 'Médio' : 'Alto'}</p>`;

    // Results by Block
    html += `<div class="page-break"></div><h2>2. Resultados por Bloco</h2>`;
    Object.entries(blocos)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([bloco, blocoItems]) => {
        const blocoConf = blocoItems.filter((i: any) => i.resposta === 'conforme').length;
        const blocoNcCount = blocoItems.filter((i: any) => i.resposta === 'nao-conforme').length;
        const blocoScore =
          blocoItems.length > 0 ? Math.round((blocoConf / blocoItems.length) * 100) : 0;

        html += `<h3>Bloco ${bloco} — ${blocoLabels[bloco] || bloco} (${blocoScore}% · ${blocoNcCount} NC)</h3>
      <table><tr><th>#</th><th>Indicador</th><th>Resultado</th><th>Severidade</th></tr>`;
        blocoItems.forEach((item: any) => {
          const badge =
            item.resposta === 'conforme'
              ? 'badge-conforme'
              : item.resposta === 'nao-conforme'
                ? 'badge-nc'
                : 'badge-na';
          const label =
            item.resposta === 'conforme'
              ? 'Conforme'
              : item.resposta === 'nao-conforme'
                ? 'NC'
                : 'N/A';
          html += `<tr>
          <td>${item.numero || ''}</td>
          <td>${escapeHtml(item.indicador || item.descricao || '')}</td>
          <td><span class="badge ${badge}">${label}</span></td>
          <td>${item.severidade ? `<span class="severity" style="background:${severityColor(item.severidade)}">${item.severidade}</span>` : '—'}</td>
        </tr>`;
        });
        html += `</table>`;
      });

    // Non-Conformities
    if (achados.length > 0) {
      html += `<div class="page-break"></div><h2>3. Não Conformidades</h2>
      <table><tr><th>#</th><th>Indicador</th><th>Severidade</th><th>Descrição</th></tr>`;
      achados.forEach((achado: any, idx: number) => {
        html += `<tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(achado.itemId || '')}</td>
          <td><span class="severity" style="background:${severityColor(achado.severidade)}">${achado.severidade || ''}</span></td>
          <td>${escapeHtml(achado.descricao || '')}</td>
        </tr>`;
      });
      html += `</table>`;
    }

    // Conclusion & Signatures
    html += `<div class="page-break"></div><h2>${achados.length > 0 ? '4' : '3'}. Conclusão</h2>
    <p>A auditoria interna foi conduzida conforme procedimento PQ-24, abrangendo ${total} indicadores 
    baseados na RDC 978/2025. O score geral de <strong>${score}%</strong> ${score >= 80 ? 'atende' : 'não atende'} 
    o requisito mínimo de 80% para acreditação DICQ.</p>
    ${nc > 0 ? `<p>Foram identificadas <strong>${nc} não conformidade(s)</strong> que requerem plano de ação corretiva com prazos definidos.</p>` : ''}
    
    <div class="signature-block">
      <div class="sig-line">Auditor Líder<br/>${escapeHtml(sessao.auditor || '')}</div>
      <div class="sig-line">Responsável Técnico<br/>${escapeHtml(auditoria.responsavelTecnico || '')}</div>
    </div>`;

    html += `<div class="footer">
      Documento gerado automaticamente pelo HC Quality em ${dataFormatada}. 
      Referência: FR-043 v01 | Hash: ${sessao.assinatura?.hash || 'N/D'}
    </div></body></html>`;

    // Convert HTML to PDF using Puppeteer (if available) or store as HTML
    const fileName = `relatorio-auditoria-${sessaoId}-${Date.now()}.html`;
    const filePath = `labs/${labId}/audit-reports/${auditoriaId}/${fileName}`;
    const file = bucket.file(filePath);

    await file.save(Buffer.from(html, 'utf-8'), {
      metadata: { contentType: 'text/html', metadata: { auditoriaId, sessaoId, generatedBy: uid } },
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    // Save reference in Firestore
    await db.collection(`${basePath}/reports`).add({
      sessaoId,
      tipo: 'auditoria-interna',
      url,
      filePath,
      geradoEm: admin.firestore.FieldValue.serverTimestamp(),
      geradoPor: uid,
      score,
      totalNC: nc,
    });

    return { success: true, pdfUrl: url, score, totalNC: nc };
  },
);
