# Product

## Register

product

## Users

**Técnicos/Operadores de Laboratório:**

- Registram e analisam resultados de tiras reagentes uroanálise diariamente
- Trabalham em condições variáveis de iluminação (bancadas de laboratório)
- Precisam de velocidade (ciclos rápidos de entrada/validação) mas sem compromiso de acurácia
- Contexto: bancada ocupada, pressão por throughput, foco em uma tira/corrida por vez

**Gerentes de Qualidade / RT (Responsável Técnico):**

- Revisam, validam e assinam dados de conformidade regulatória (RDC 978/2025)
- Geram relatórios, identificam tendências e não-conformidades
- Precisam de visibilidade sobre múltiplas corridas, lotes, histórico
- Contexto: desk, análise agregada, rastreabilidade de auditoria

## Product Purpose

Sistema de CIQ (Controle Interno de Qualidade) especializado em uroanálise para laboratórios clínicos. Captura, valida e rastreia resultados de tiras reagentes conforme RDC 978/2025, RDC 302/2005 e diretrizes CLSI. Permite operadores rápidos e confiáveis registrarem dados, com supervisão regulatória transparente de RTs e gestores.

Sucesso = operadores registram com confiança, RTs assinam com segurança, auditorias encontram trilha completa.

## Brand Personality

**Especialista científico.** Sem decoração, sem casualidade. Interface que parece feita por quem entende uroanálise, não por template SaaS.

- **Tom:** Preciso, sem folga. Assume conhecimento técnico do usuário.
- **Visual:** Dark-first (ambientes de lab com luz variável), alto contraste, tipografia editorial, números tabulares em tabelas.
- **Confiança vem de:** precisão das informações, estrutura clara, rastreabilidade explícita, assinatura visível.

## Anti-references

❌ **Nada genérico/template SaaS:**

- Sem card grids idênticas
- Sem "big number + label + supporting stats" cliché
- Sem gradientes decorativos
- Sem interface que pudesse ser qualquer ferramenta

❌ **Nada light/casual (consumer-friendly):**

- Sem cores pastel
- Sem microinterações lúdicas
- Sem tone of voice descontraído
- Sem interface que pareça "amigável" em detrimento de precisão

🎯 **Referências implícitas:** Bloomberg, Stripe, Linear (professional data), + especialista clínico (não: SaaS-cream, crypto-neon, startup-energy).

## Design Principles

1. **Expertise as foundation** — design é para especialistas. Operadores e RTs sabem uroanálise. Interface assume competência, não o contrário. Zero "educação" na UI.

2. **Precision in hierarchy** — dados complexos (níveis, frequências, analitos, status) devem ser legíveis à primeira vista. Sem ambiguidade. Números tabulares, contraste WCAG AA+.

3. **Speed without compromise** — operadores precisam registrar rápido mas jamais com cliques ambíguos. Teclado-nativo, fluxos diretos, atalhos onde faz sentido.

4. **Compliance is the structure** — RDC 978 não é overlay. Assinatura, trilha de auditoria, soft-delete, rastreabilidade de origem estão na arquitetura visual desde o começo.

5. **Dark mode for labs** — ambiente de laboratório com iluminação variável. Dark-first reduz fadiga ocular. Alto contraste é obrigatório.

## Accessibility & Inclusion

**WCAG AA mínimo:**

- Contraste 4.5:1 texto normal, 3:1 texto grande
- Navegação por teclado funcional (sem dependência de mouse)
- Aria labels em botões só com ícone
- Foco visível sempre

**Lab-specific:**

- Alto contraste ainda mais elevado quando possível (lab pode ter iluminação ruim)
- Respeito a `prefers-reduced-motion` (operadores às vezes estressados, acelerar microinterações pode aumentar erro)
- Espaçamento generoso (dedos cansados, digitação rápida, possível tremor)
- Tipografia legível em telas menores ou de longe (certa distância da bancada)
