/**
 * ctIoTService.ts
 *
 * Helpers CLIENT-SIDE do contrato IoT. O endpoint HTTP que recebe dados do
 * ESP32 vive em `functions/src/modules/ctIoT/index.ts` — aqui ficam:
 *
 *   1. `gerarTokenDispositivo()` — cria token plain + hash SHA-256. O token
 *      plain é exibido uma única vez ao operador na UI (pra flashear no
 *      firmware); só o hash é persistido em `DispositivoIoT.tokenAcesso`.
 *
 *   2. `gerarPayloadConfigESP32()` — monta o texto/JSON de configuração
 *      embarcado no QR code do DispositivoIoTForm, usado pelo instalador
 *      pra programar o ESP32 sem digitar manualmente.
 *
 *   3. `iotEndpointUrl()` — URL da Cloud Function registrarLeituraIoT.
 *      Override via env `VITE_CT_IOT_URL` (dev / preview channels).
 *
 * Mantemos a geração do token no cliente mesmo sabendo que token server-side
 * seria mais robusto. Motivo: alinhar com a política de gerar token na mesma
 * action de criar o dispositivo, exibir uma vez, e nunca guardar o plain.
 * Upgrade pra callable futura é drop-in — interface `DispositivoInput` não
 * muda. Ver débito técnico CT-02.
 */

// URL oficial Gen2 (Cloud Run) — deploy 2026-04-24.
// Firebase também publica proxy legacy em `cloudfunctions.net` mas o canônico
// Gen2 é `*-rj.a.run.app`. Override por ambiente via `VITE_CT_IOT_URL`.
const DEFAULT_IOT_URL =
  'https://registrarleituraiot-qqkrnjryaq-rj.a.run.app';

export function iotEndpointUrl(): string {
  const env = (import.meta as { env?: { VITE_CT_IOT_URL?: string } }).env;
  return env?.VITE_CT_IOT_URL ?? DEFAULT_IOT_URL;
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera 32 bytes aleatórios → base64url (sem padding). Token é exibido ao
 * operador uma vez e persistido como hash — reemitir requer criar outro
 * dispositivo (ou recriar; o token antigo fica inválido).
 */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let b64 = '';
  // btoa precisa de binary string.
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface TokenDispositivo {
  /** Plain-text — exibir UMA vez ao operador, flashear no ESP32. Não persistir. */
  plain: string;
  /** SHA-256 hex — persistido em `DispositivoIoT.tokenAcesso`. */
  hash: string;
}

export async function gerarTokenDispositivo(): Promise<TokenDispositivo> {
  const plain = randomToken();
  const hash = await sha256Hex(plain);
  return { plain, hash };
}

/**
 * Payload embarcado no QR code do DispositivoIoTForm. Texto plano legível
 * para o operador conferir e compatível com apps "ESP32 Provisioner" que
 * leem JSON via QR. Não inclui WiFi — credenciais de rede são sensíveis
 * demais pra um QR compartilhável.
 */
export interface ConfigESP32 {
  endpoint: string;
  token: string;
  intervaloSegundos: number;
  equipamento: string;
}

export function gerarPayloadConfigESP32(
  cfg: Omit<ConfigESP32, 'endpoint'> & { endpoint?: string },
): string {
  const full: ConfigESP32 = {
    endpoint: cfg.endpoint ?? iotEndpointUrl(),
    token: cfg.token,
    intervaloSegundos: cfg.intervaloSegundos,
    equipamento: cfg.equipamento,
  };
  return JSON.stringify(full);
}

/**
 * Snippet de código Arduino/ESP32 que o operador copia pra IDE. Substituições
 * (`{{TOKEN}}`, etc.) ficam marcadas pra review humano — nada é impresso com
 * credenciais reais no snippet público.
 */
export function gerarSnippetArduino(params: {
  token: string;
  intervaloMinutos: number;
  equipamentoNome: string;
}): string {
  return `// HC Quality — ESP32 registrarLeituraIoT
// Equipamento: ${params.equipamentoNome}
// Intervalo nominal: ${params.intervaloMinutos} min
// ⚠️ Substitua WIFI_SSID e WIFI_PASSWORD pelas credenciais da rede do lab.

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* WIFI_SSID = "SEU_SSID";
const char* WIFI_PASSWORD = "SUA_SENHA";
const char* ENDPOINT = "${iotEndpointUrl()}";
const char* DEVICE_TOKEN = "${params.token}";
const uint32_t INTERVALO_MS = ${params.intervaloMinutos * 60 * 1000}UL;

DHT dht(4 /* GPIO */, DHT22);
float tMax = -1000, tMin = 1000;

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) {
    if (t > tMax) tMax = t;
    if (t < tMin) tMin = t;
  }

  if (WiFi.status() == WL_CONNECTED && !isnan(t)) {
    HTTPClient http;
    http.begin(ENDPOINT);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    String body = "{\\"temperatura\\":" + String(t, 2)
      + ",\\"umidade\\":" + String(h, 1)
      + ",\\"temperaturaMax\\":" + String(tMax, 2)
      + ",\\"temperaturaMin\\":" + String(tMin, 2) + "}";
    http.POST(body);
    http.end();
  }
  delay(INTERVALO_MS);
}
`;
}
