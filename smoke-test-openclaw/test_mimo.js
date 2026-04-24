const MiMoOrchestrator = require('./mimo_orchestrator');

const orchestrator = new MiMoOrchestrator('MOCK_KEY');

// Simulação de Testes de Roteamento
console.log('--- Iniciando Testes de Roteamento MiMo ---');

// Caso 1: Heartbeat (Deve usar Flash)
const route1 = orchestrator.route({ isHeartbeat: true });
console.log(`Teste 1 (Heartbeat): Esperado FLASH, Obtido: ${route1 === 'xiaomi/mimo-v2-flash' ? 'OK' : 'FAIL'}`);

// Caso 2: Edição simples de 1 arquivo (Deve usar Flash)
const route2 = orchestrator.route({ fileCount: 1 });
console.log(`Teste 2 (1 Arquivo): Esperado FLASH, Obtido: ${route2 === 'xiaomi/mimo-v2-flash' ? 'OK' : 'FAIL'}`);

// Caso 3: Multi-file refactor (Deve usar Pro)
const route3 = orchestrator.route({ fileCount: 5 });
console.log(`Teste 3 (5 Arquivos): Esperado PRO, Obtido: ${route3 === 'xiaomi/mimo-v2-pro' ? 'OK' : 'FAIL'}`);

// Caso 4: Complex Reasoning (Deve usar Pro)
const route4 = orchestrator.route({ isComplex: true });
console.log(`Teste 4 (Complexo): Esperado PRO, Obtido: ${route4 === 'xiaomi/mimo-v2-pro' ? 'OK' : 'FAIL'}`);

console.log('--- Testes de Roteamento Concluídos ---');

// Teste 5: Conectividade Real (Opcional - Requer Chave Válida)
(async () => {
    console.log('\n--- Testando Conectividade Real com OpenRouter ---');
    const realOrchestrator = new MiMoOrchestrator(); // Puxa do .env
    try {
        const result = await realOrchestrator.runTask('Responda apenas "CONECTADO"', { isHeartbeat: true });
        console.log(`Resultado da API: ${result.content}`);
        console.log(`Modelo utilizado: ${result.model}`);
        console.log('--- Sucesso End-to-End ---');
    } catch (e) {
        console.error('Falha no teste real:', e.message);
    }
})();
