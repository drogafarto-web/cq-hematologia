# ============================================================
# CQ Hematologia Labclin — Setup de Novo PC
# ============================================================
# Uso: clique com botão direito > "Executar com PowerShell"
#      ou: powershell -ExecutionPolicy Bypass -File setup.ps1
# ============================================================

$APP_DIR  = "$PSScriptRoot"
$NODE_MIN = 20

# URL lida do remote configurado no repo — nao edite aqui
$REPO_URL = (git -C $APP_DIR remote get-url origin 2>$null)

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================" -ForegroundColor Cyan
    Write-Host "   CQ Hematologia Labclin — Setup" -ForegroundColor White
    Write-Host "  ================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$msg)
    Write-Host "  >> $msg" -ForegroundColor Yellow
}

function Write-OK {
    param([string]$msg)
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Fail {
    param([string]$msg)
    Write-Host "  [ERRO] $msg" -ForegroundColor Red
}

function Pause-AndExit {
    Write-Host ""
    Write-Host "  Pressione qualquer tecla para sair..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ── 1. Node.js ───────────────────────────────────────────────
Write-Header
Write-Step "Verificando Node.js..."

$nodeVersion = $null
try { $nodeVersion = (node --version 2>$null) } catch {}

if (-not $nodeVersion) {
    Write-Fail "Node.js nao encontrado."
    Write-Host ""
    Write-Host "  Instale o Node.js 20 LTS em: https://nodejs.org/en/download" -ForegroundColor White
    Write-Host "  Depois, execute este script novamente." -ForegroundColor White
    Pause-AndExit
}

$nodeMajor = [int]($nodeVersion -replace "v(\d+)\..*", '$1')
if ($nodeMajor -lt $NODE_MIN) {
    Write-Fail "Node.js $nodeVersion encontrado, mas precisa ser v$NODE_MIN ou superior."
    Write-Host ""
    Write-Host "  Atualize em: https://nodejs.org/en/download" -ForegroundColor White
    Pause-AndExit
}

Write-OK "Node.js $nodeVersion"

# ── 2. Git ───────────────────────────────────────────────────
Write-Step "Verificando Git..."

$gitVersion = $null
try { $gitVersion = (git --version 2>$null) } catch {}

if (-not $gitVersion) {
    Write-Fail "Git nao encontrado."
    Write-Host ""
    Write-Host "  Instale o Git em: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "  Depois, execute este script novamente." -ForegroundColor White
    Pause-AndExit
}

Write-OK "$gitVersion"

# ── 3. Codigo — clone ou atualiza ───────────────────────────
Write-Step "Atualizando codigo..."

Set-Location $APP_DIR

$gitDir = Join-Path $APP_DIR ".git"
if (Test-Path $gitDir) {
    # Ja e um repo — apenas atualiza
    git pull --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falha ao fazer git pull. Verifique a conexao com a internet."
        Pause-AndExit
    }
    Write-OK "Codigo atualizado (git pull)"
} else {
    # Primeiro setup — clona
    if (-not $REPO_URL) {
        Write-Fail "Remote git nao configurado. Contate o administrador do sistema."
        Pause-AndExit
    }
    Write-Step "Clonando repositorio (primeira vez)..."
    $parent = Split-Path $APP_DIR -Parent
    $folder = Split-Path $APP_DIR -Leaf
    Set-Location $parent
    git clone $REPO_URL $folder --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falha ao clonar o repositorio. Verifique a conexao e as permissoes."
        Pause-AndExit
    }
    Set-Location $APP_DIR
    Write-OK "Repositorio clonado"
}

# ── 4. Variaveis de ambiente (.env) ──────────────────────────
$envFile     = Join-Path $APP_DIR ".env"
$envExample  = Join-Path $APP_DIR ".env.example"

if (-not (Test-Path $envFile)) {
    Write-Step "Arquivo .env nao encontrado. Criando a partir do template..."

    if (-not (Test-Path $envExample)) {
        Write-Fail ".env.example nao encontrado no projeto. Contate o suporte."
        Pause-AndExit
    }

    Copy-Item $envExample $envFile
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │  CONFIGURACAO NECESSARIA                    │" -ForegroundColor Cyan
    Write-Host "  │                                             │" -ForegroundColor Cyan
    Write-Host "  │  O arquivo .env vai abrir no Notepad.       │" -ForegroundColor Cyan
    Write-Host "  │  Preencha as credenciais Firebase e salve.  │" -ForegroundColor Cyan
    Write-Host "  │  Depois feche o Notepad para continuar.     │" -ForegroundColor Cyan
    Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Pressione qualquer tecla para abrir o .env..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    Start-Process notepad.exe -ArgumentList $envFile -Wait

    # Valida se as chaves foram preenchidas
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "VITE_FIREBASE_API_KEY=\s*$" -or
        $envContent -match "VITE_FIREBASE_API_KEY=$") {
        Write-Fail "VITE_FIREBASE_API_KEY esta vazio. Configure o .env e execute o setup novamente."
        Pause-AndExit
    }

    Write-OK ".env configurado"
} else {
    Write-OK ".env ja existe — mantendo configuracoes"
}

# ── 5. Dependencias ──────────────────────────────────────────
Write-Step "Instalando dependencias (npm install)..."
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao instalar dependencias."
    Pause-AndExit
}
Write-OK "Dependencias instaladas"

# ── 6. Build ─────────────────────────────────────────────────
Write-Step "Compilando aplicacao (npm run build)..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao compilar. Verifique os erros acima."
    Pause-AndExit
}
Write-OK "Build concluido"

# ── 7. Pronto ────────────────────────────────────────────────
Write-Host ""
Write-Host "  ================================================" -ForegroundColor Green
Write-Host "   Setup concluido com sucesso!" -ForegroundColor Green
Write-Host "  ================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para rodar o sistema:" -ForegroundColor White
Write-Host ""
Write-Host "    npm run dev" -ForegroundColor Cyan
Write-Host "    Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para atualizar o sistema no futuro:" -ForegroundColor White
Write-Host ""
Write-Host "    Execute este script novamente (faz git pull automatico)" -ForegroundColor Cyan
Write-Host ""

$resposta = Read-Host "  Deseja iniciar o sistema agora? (s/n)"
if ($resposta -eq "s" -or $resposta -eq "S") {
    Write-Host ""
    Write-Host "  Iniciando... Acesse http://localhost:3000 no navegador." -ForegroundColor Green
    Write-Host "  Para parar: pressione Ctrl+C" -ForegroundColor Gray
    Write-Host ""
    npm run dev
}
