# Módulo: Controle de Temperatura

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/controle-temperatura/`.
Não leia nem acesse outros módulos de `src/features/` sem autorização.

Escopo funcional: monitoramento térmico e hidrotérmico de salas, geladeiras,
freezers e equipamentos críticos. Suporta leitura manual (mobile-first) e
automática via ESP32/sensores IoT. Gera FR-11 mensal fiel ao formulário papel
e mantém rastreabilidade completa (5 anos) via deleção lógica.

## Referências regulatórias

FR-11 · PQ-06 · RDC 978/2025 · ISO 15189:2022 cl. 5.3 · ANVISA — Gestão de Materiais e Infraestrutura.

## Dependências externas

- `src/shared/services/firebase.ts` — única porta de entrada do SDK.
- `src/store/useAuthStore.ts` — `useActiveLabId()`, `useActiveLab()`, `useUser()`.
- `src/utils/logicalSignature.ts` — contrato global (não consumido diretamente,
  mas `services/ctSignatureService.ts` herda o mesmo algoritmo).
- `src/features/educacao-continuada/services/ecExportService.ts` — referência
  arquitetural (padrão `react-to-print` + payload tipado).
- `firebase`, `recharts`, `react-to-print`, `qrcode.react`, `zod` — já no root.

## Multi-tenant (paths Firestore)

```
controleTemperatura/{labId}/
├── equipamentos/{id}         EquipamentoMonitorado
├── leituras/{id}             LeituraTemperatura (manual + IoT)
├── leituras-previstas/{id}   LeituraPrevista (scheduler gera)
├── ncs/{id}                  NaoConformidadeTemp (auto + manual)
├── termometros/{id}          Termometro + calibração
└── dispositivos-iot/{id}     DispositivoIoT (ESP32)
```

Storage: `labs/{labId}/controle-temperatura/calibracoes/{file}`.

## Regras invioláveis (RN-*)

- **RN-01** — `createLeituraComNC` (service) deriva `foraDosLimites` e, se
  fora, cria NC em batch atômico. `avaliarForaDosLimites` exportada para uso
  visual imediato no `LeituraRapidaForm`.
- **RN-02** — `useSaveLeitura` exige `user.uid` para `origem === 'manual'`
  e gera `LogicalSignature` via `generateCtSignature`. Leituras IoT são
  assinadas server-side (`operatorId: "iot:{dispositivoId}"`).
- **RN-03** — `scheduledGenerateLeiturasPrevistas` (Cloud Function, 01:00 SP)
  lê o calendário de cada equipamento ativo e gera as previsões do dia
  seguinte.
- **RN-04** — `scheduledMarcarLeiturasPerdidas` (cada 30min) marca previsões
  com >1h de atraso como `perdida`.
- **RN-05** — `useTermometros().proximosAVencer` filtra termômetros com
  `proximaCalibracao ≤ 30 dias` e alimenta o KPI do dashboard.
- **RN-06** — `computarOnline` deriva `online` no mapper a partir de
  `ultimaTransmissao` + 2× intervalo. Rastreado também pelo trigger IoT que
  grava `online: true` a cada transmissão.
- **RN-07** — Nenhum service chama `deleteDoc`. Sempre `deletadoEm`.
- **RN-08** — `montarRelatorioFR11` agrupa leituras por dia + turno,
  sinaliza valores fora dos limites com `*`, justificadas com `J`, lista NCs
  do mês e calcula `hashDocumento` SHA-256 para auditoria.

## Componentes principais

- `CTDashboard` — KPIs + cards por equipamento com status em tempo real.
- `LeituraRapidaForm` — modal mobile-first com validação visual inline.
- `LeituraListaPendentes` — leituras previstas do dia com indicador de atraso.
- `EquipamentoForm` — cadastro com limites e grid de calendário.
- `NCForm` / `NCList` — tratamento de NCs abertas → resolvidas.
- `TermometroForm` + `TermometrosList` — cadastro + calibração.
- `DispositivoIoTForm` + `DispositivosIoTList` — provisionamento ESP32 com
  token plain-text exibido uma única vez + QR code de config.
- `GraficoTemperatura` — linha histórica recharts com banda de aceitabilidade.
- `CTRelatorioPrint` — preview FR-11 idêntico ao papel (react-to-print).
- `CTIndicadores` — gráfico de conformidade mensal por equipamento.
- `ControlTemperaturaView` — entry point com 6 tabs (lazy load do PDF).

## Cloud Functions exportadas

Registradas em `functions/src/index.ts`:

- `registrarLeituraIoT` (HTTP) — endpoint do ESP32.
- `scheduledGenerateLeiturasPrevistas` (cron 01:00 SP).
- `scheduledMarcarLeiturasPerdidas` (cron 30min).

---

## Status atual

**Fase:** módulo em desenvolvimento — ainda não deployado em prod (firestore.rules do bloco `/controleTemperatura/{labId}/**` pendente — ver CT-04).
**Próximo passo prioritário:** escrever rules + deploy (CT-04) para habilitar acesso; em seguida migração de assinatura para Cloud Function (CT-01).

## Débitos técnicos

- **CT-01** — Assinatura ainda gerada client-side. Migrar para callable Admin
  SDK (mesmo caminho do módulo EC na Fase 0b). Arquivo:
  `services/ctSignatureService.ts`.
- **CT-02** — Token de dispositivo gerado client-side. Aceitável pra MVP,
  upgrade drop-in via callable `ct_mintDeviceToken` (não muda contrato de
  `DispositivoInput`).
- **CT-03** — Calendário ignora feriados (cai no bucket `diasUteis`).
  Integrar lookup de feriados nacionais/municipais antes de ir pra produção
  em labs 24/7.
- **CT-04** — firestore.rules **não foi atualizado** nesta sessão (fora do
  escopo autorizado). Adicionar antes do deploy:

  ```
  match /controleTemperatura/{labId}/{document=**} {
    allow read, write: if isSuperAdmin() || isActiveMemberOf(labId);
  }
  ```

  Sem isso, clientes levam `permission-denied` em qualquer leitura/escrita.

- **CT-05** — Firestore pode exigir índice composto para a query do IoT
  (`equipamentoId + status + dataHoraPrevista` em `leituras-previstas`).
  Conferir no primeiro deploy via Firebase Console.
- **CT-06** — Filtro client-side em `subscribeLeituras` por equipamentoId
  + janela de datas. Rever se algum tenant ultrapassar ~10k leituras/mês
  por equipamento.

## Roadmap IoT

1. Integração com Home Assistant como bridge para sensores Zigbee/Z-Wave
   (alternativa ao ESP32).
2. Webhook reverso: notificar `responsavel` via WhatsApp/Email quando NC
   de temperatura for aberta (integrar com emailBackup).
3. Dashboard público em TV do setor (modo kiosk).
4. Import de planilhas Excel de calibração externa (aceitar PDF do
   laboratório de metrologia).

---

## Dever de atualização do contexto raiz

Após cada milestone (deploy das rules, primeira leitura IoT em prod, migração de assinatura para callable), atualizar:

1. **A seção "Status atual" acima** (data + fase + próximo passo)
2. **A linha `controle-temperatura` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md)** — formato `{módulo} | {status 1 frase} | {data}`

Protocolo completo em [`.claude/CONTEXT_PROTOCOL.md`](../../../.claude/CONTEXT_PROTOCOL.md).
