#!/usr/bin/env bash
# ============================================================
# CQ Hematologia Labclin — Setup de Novo PC (Linux/macOS)
# ============================================================
# Uso: chmod +x setup.sh && ./setup.sh
# ============================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# URL lida do remote configurado no repo — nao edite aqui
REPO_URL="$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || true)"
NODE_MIN=20

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; WHITE='\033[1;37m'; RESET='\033[0m'

header() {
    clear
    echo ""
    echo -e "${CYAN}  ================================================${RESET}"
    echo -e "${WHITE}   CQ Hematologia Labclin — Setup${RESET}"
    echo -e "${CYAN}  ================================================${RESET}"
    echo ""
}

step()  { echo -e "${YELLOW}  >> $1${RESET}"; }
ok()    { echo -e "${GREEN}  [OK] $1${RESET}"; }
fail()  { echo -e "${RED}  [ERRO] $1${RESET}"; exit 1; }

# ── 1. Node.js ───────────────────────────────────────────────
header
step "Verificando Node.js..."

if ! command -v node &>/dev/null; then
    fail "Node.js nao encontrado. Instale em: https://nodejs.org/en/download"
fi

NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt "$NODE_MIN" ]; then
    fail "Node.js v$NODE_VER encontrado, precisa ser v$NODE_MIN+. Atualize em nodejs.org"
fi
ok "Node.js v$NODE_VER"

# ── 2. Git ───────────────────────────────────────────────────
step "Verificando Git..."
if ! command -v git &>/dev/null; then
    fail "Git nao encontrado. Instale via: sudo apt install git  (ou brew install git no Mac)"
fi
ok "$(git --version)"

# ── 3. Codigo — clone ou atualiza ───────────────────────────
step "Atualizando codigo..."
cd "$APP_DIR"

if [ -d ".git" ]; then
    git pull --quiet
    ok "Codigo atualizado (git pull)"
else
    [ -z "$REPO_URL" ] && fail "Remote git nao configurado. Contate o administrador do sistema."
    step "Clonando repositorio (primeira vez)..."
    PARENT="$(dirname "$APP_DIR")"
    FOLDER="$(basename "$APP_DIR")"
    cd "$PARENT"
    git clone "$REPO_URL" "$FOLDER" --quiet
    cd "$APP_DIR"
    ok "Repositorio clonado"
fi

# ── 4. Variaveis de ambiente (.env) ──────────────────────────
if [ ! -f ".env" ]; then
    step "Arquivo .env nao encontrado. Criando a partir do template..."

    [ ! -f ".env.example" ] && fail ".env.example nao encontrado. Contate o suporte."

    cp .env.example .env

    echo ""
    echo -e "${CYAN}  ┌─────────────────────────────────────────────┐${RESET}"
    echo -e "${CYAN}  │  CONFIGURACAO NECESSARIA                    │${RESET}"
    echo -e "${CYAN}  │                                             │${RESET}"
    echo -e "${CYAN}  │  Preencha as credenciais Firebase no .env   │${RESET}"
    echo -e "${CYAN}  │  e salve. Depois feche o editor.            │${RESET}"
    echo -e "${CYAN}  └─────────────────────────────────────────────┘${RESET}"
    echo ""

    # Abre no editor disponivel
    if command -v code &>/dev/null; then
        code --wait .env
    elif command -v nano &>/dev/null; then
        nano .env
    else
        vi .env
    fi

    # Valida
    if grep -qE "^VITE_FIREBASE_API_KEY=\s*$" .env; then
        fail "VITE_FIREBASE_API_KEY esta vazio. Configure o .env e execute o setup novamente."
    fi

    ok ".env configurado"
else
    ok ".env ja existe — mantendo configuracoes"
fi

# ── 5. Dependencias ──────────────────────────────────────────
step "Instalando dependencias (npm install)..."
npm install --silent
ok "Dependencias instaladas"

# ── 6. Build ─────────────────────────────────────────────────
step "Compilando aplicacao (npm run build)..."
npm run build
ok "Build concluido"

# ── 7. Pronto ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ================================================${RESET}"
echo -e "${GREEN}   Setup concluido com sucesso!${RESET}"
echo -e "${GREEN}  ================================================${RESET}"
echo ""
echo -e "${WHITE}  Para rodar o sistema:${RESET}"
echo ""
echo -e "${CYAN}    npm run dev${RESET}"
echo -e "${CYAN}    Acesse: http://localhost:3000${RESET}"
echo ""
echo -e "${WHITE}  Para atualizar no futuro:${RESET}"
echo -e "${CYAN}    Execute este script novamente (faz git pull automatico)${RESET}"
echo ""

read -rp "  Deseja iniciar o sistema agora? (s/n): " RESP
if [[ "$RESP" == "s" || "$RESP" == "S" ]]; then
    echo ""
    echo -e "${GREEN}  Iniciando... Acesse http://localhost:3000 no navegador.${RESET}"
    echo -e "${GRAY}  Para parar: Ctrl+C${RESET}"
    echo ""
    npm run dev
fi
