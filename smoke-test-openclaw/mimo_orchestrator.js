const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');

const MODELS = {
    PRO: 'xiaomi/mimo-v2-pro',
    FLASH: 'xiaomi/mimo-v2-flash'
};

/**
 * Orquestrador MiMo-V2
 * Implementa as regras de roteamento entre os modelos Pro e Flash.
 */
class MiMoOrchestrator {
    constructor(apiKey) {
        this.apiKey = apiKey || OPENROUTER_API_KEY;
        if (!this.apiKey) {
            console.warn('AVISO: OPENROUTER_API_KEY não encontrada. O script falhará em chamadas reais.');
        }
        this.client = axios.create({
            baseURL: 'https://openrouter.ai/api/v1',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': 'https://github.com/google-deepmind/antigravity', // Exemplo
                'X-Title': 'OpenClaw MiMo Orchestrator',
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Determina qual modelo usar baseado na tarefa.
     * Regras:
     * 1. Multi-file (>3) -> PRO
     * 2. Single-file/Heartbeat/Search -> FLASH
     */
    route(taskDetails) {
        const { fileCount, isHeartbeat, isComplex } = taskDetails;

        if (isHeartbeat) return MODELS.FLASH;
        if (fileCount > 3 || isComplex) return MODELS.PRO;
        
        return MODELS.FLASH;
    }

    async runTask(prompt, taskDetails = {}) {
        const model = this.route(taskDetails);
        console.log(`[MiMo] Roteando para: ${model}`);

        try {
            const response = await this.client.post('/chat/completions', {
                model: model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ]
            });

            return {
                model,
                content: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        } catch (error) {
            console.error(`[MiMo] Erro na chamada ao modelo ${model}:`, error.message);
            
            // Regra 3: Escalonamento automático se o Flash falhar
            if (model === MODELS.FLASH) {
                console.log('[MiMo] Escalonando para PRO devido a falha...');
                return this.runTask(prompt, { ...taskDetails, isComplex: true });
            }
            
            throw error;
        }
    }
}

module.exports = MiMoOrchestrator;
