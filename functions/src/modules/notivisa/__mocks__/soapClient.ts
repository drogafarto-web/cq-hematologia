/**
 * Mock NOTIVISA SOAP Client
 * Phase 4 (sandbox) implementation
 *
 * Simulates common NOTIVISA API responses for testing:
 *   - Success: instant receipt with ANVISA code
 *   - Validation error (4xx): invalid CPF format
 *   - Timeout (5xx): slow network simulation
 *   - Network down: connection refused
 *   - Malformed response: invalid XML
 *
 * Phase 12: swap for real mTLS cert + WSDL integration
 */

export interface NotivisaSoapResponse {
  success: boolean;
  receiptCode?: string;
  errorCode?: string;
  errorMessage?: string;
  roundTripMs: number;
  xmlResponse?: string;
}

export interface NotivisaSoapRequest {
  labId: string;
  diseaseCodes: string[];
  patientCpf: string;
  resultDate: number;
  resultValue: string;
  idempotencyKey: string;
}

export enum SoapMockScenario {
  SUCCESS = 'success',
  VALIDATION_ERROR = 'validation-error',
  TIMEOUT = 'timeout',
  NETWORK_DOWN = 'network-down',
  MALFORMED_RESPONSE = 'malformed-response',
}

/**
 * Mock SOAP client for Phase 4 testing
 */
export class NotivisaMockSoapClient {
  private scenario: SoapMockScenario;
  private latencyMs: number;

  constructor(scenario: SoapMockScenario = SoapMockScenario.SUCCESS, latencyMs: number = 100) {
    this.scenario = scenario;
    this.latencyMs = latencyMs;
  }

  /**
   * Simulate network latency
   */
  private async delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  /**
   * Generate mock ANVISA receipt code
   */
  private generateReceiptCode(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 12).toUpperCase();
    const checksum = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `ANVISA-${timestamp}-${random}-${checksum}`;
  }

  /**
   * Generate deterministic idempotency hash
   */
  private generateIdempotencyHash(cpf: string, resultDate: number): string {
    const crypto = require('crypto');
    const input = `${cpf}:${resultDate}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Submit NOTIVISA report to mock SOAP API
   */
  async submit(request: NotivisaSoapRequest): Promise<NotivisaSoapResponse> {
    const startTime = Date.now();

    try {
      await this.delay();

      const response = this.getResponseForScenario(request);

      const roundTripMs = Date.now() - startTime;
      return { ...response, roundTripMs };
    } catch (error) {
      return {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: String(error),
        roundTripMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Route to appropriate mock response
   */
  private getResponseForScenario(
    request: NotivisaSoapRequest,
  ): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    switch (this.scenario) {
      case SoapMockScenario.SUCCESS:
        return this.successResponse(request);

      case SoapMockScenario.VALIDATION_ERROR:
        return this.validationErrorResponse();

      case SoapMockScenario.TIMEOUT:
        return this.timeoutResponse();

      case SoapMockScenario.NETWORK_DOWN:
        return this.networkDownResponse();

      case SoapMockScenario.MALFORMED_RESPONSE:
        return this.malformedResponse();

      default:
        return this.successResponse(request);
    }
  }

  /**
   * Scenario: Success (200 OK)
   * Returns ANVISA receipt code
   */
  private successResponse(request: NotivisaSoapRequest): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    const receiptCode = this.generateReceiptCode();

    return {
      success: true,
      receiptCode,
      xmlResponse: this.generateSuccessXmlResponse(receiptCode, request.idempotencyKey),
    };
  }

  /**
   * Scenario: Validation Error (400 Bad Request)
   * Invalid CPF format or missing required fields
   */
  private validationErrorResponse(): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    return {
      success: false,
      errorCode: 'INVALID_CPF',
      errorMessage: 'CPF format inválido — deve conter 11 dígitos',
      xmlResponse: this.generateErrorXmlResponse('INVALID_CPF', 'CPF format error'),
    };
  }

  /**
   * Scenario: Timeout (504 Gateway Timeout)
   * Simulates slow/unresponsive API
   */
  private timeoutResponse(): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    return {
      success: false,
      errorCode: 'TIMEOUT',
      errorMessage: 'Request timeout — Anvisa API not responding',
    };
  }

  /**
   * Scenario: Network Down (ECONNREFUSED)
   * Connection refused — service unavailable
   */
  private networkDownResponse(): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    return {
      success: false,
      errorCode: 'ECONNREFUSED',
      errorMessage: 'Connection refused — Anvisa API unavailable',
    };
  }

  /**
   * Scenario: Malformed Response (5xx)
   * Server returns invalid XML
   */
  private malformedResponse(): Omit<NotivisaSoapResponse, 'roundTripMs'> {
    return {
      success: false,
      errorCode: 'MALFORMED_RESPONSE',
      errorMessage: 'Server returned invalid XML response',
      xmlResponse: '<invalid>{{corrupted}}></invalid>',
    };
  }

  /**
   * Generate mock XML success response (SOAP envelope)
   */
  private generateSuccessXmlResponse(receiptCode: string, idempotencyKey: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://anvisa.gov.br/notivisa/api/v1">
  <soap:Body>
    <ns:SubmitReportResponse>
      <ns:receiptNumber>${receiptCode}</ns:receiptNumber>
      <ns:idempotencyKey>${idempotencyKey}</ns:idempotencyKey>
      <ns:status>ACCEPTED</ns:status>
      <ns:timestamp>${new Date().toISOString()}</ns:timestamp>
    </ns:SubmitReportResponse>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Generate mock XML error response
   */
  private generateErrorXmlResponse(errorCode: string, errorMessage: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://anvisa.gov.br/notivisa/api/v1">
  <soap:Body>
    <soap:Fault>
      <ns:faultCode>${errorCode}</ns:faultCode>
      <ns:faultString>${errorMessage}</ns:faultString>
      <ns:timestamp>${new Date().toISOString()}</ns:timestamp>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Change mock scenario (for testing different behaviors)
   */
  setScenario(scenario: SoapMockScenario): void {
    this.scenario = scenario;
  }

  /**
   * Set custom latency for performance testing
   */
  setLatency(latencyMs: number): void {
    this.latencyMs = latencyMs;
  }
}

/**
 * Factory function for creating mock clients in tests
 */
export function createMockSoapClient(
  scenario: SoapMockScenario = SoapMockScenario.SUCCESS,
  latencyMs: number = 100,
): NotivisaMockSoapClient {
  return new NotivisaMockSoapClient(scenario, latencyMs);
}

/**
 * Test helpers for common scenarios
 */
export const SoapTestHelpers = {
  /**
   * Create request with valid structure
   */
  createValidRequest(overrides?: Partial<NotivisaSoapRequest>): NotivisaSoapRequest {
    return {
      labId: 'lab-test-001',
      diseaseCodes: ['SYPHILIS'],
      patientCpf: '12345678901',
      resultDate: Math.floor(Date.now() / 1000),
      resultValue: 'POSITIVE',
      idempotencyKey: 'key-' + Date.now(),
      ...overrides,
    };
  },

  /**
   * Create request with invalid CPF
   */
  createInvalidCpfRequest(): NotivisaSoapRequest {
    return {
      labId: 'lab-test-001',
      diseaseCodes: ['SYPHILIS'],
      patientCpf: '123', // Invalid: not 11 digits
      resultDate: Math.floor(Date.now() / 1000),
      resultValue: 'POSITIVE',
      idempotencyKey: 'key-' + Date.now(),
    };
  },

  /**
   * Assert response structure
   */
  assertValidSuccessResponse(response: NotivisaSoapResponse): void {
    if (!response.success) {
      throw new Error('Expected successful response');
    }
    if (!response.receiptCode) {
      throw new Error('Missing receiptCode in response');
    }
    if (response.roundTripMs < 0) {
      throw new Error('Invalid roundTripMs');
    }
  },

  /**
   * Assert error response structure
   */
  assertValidErrorResponse(response: NotivisaSoapResponse): void {
    if (response.success) {
      throw new Error('Expected error response');
    }
    if (!response.errorCode) {
      throw new Error('Missing errorCode in response');
    }
    if (!response.errorMessage) {
      throw new Error('Missing errorMessage in response');
    }
  },
};
