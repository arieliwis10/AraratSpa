# deploy.ps1
# Compila el frontend y sube los cambios (codigo + build) a GitHub,
# listos para hacer pull/deploy desde cPanel.
#
# Uso: desde la carpeta raiz del proyecto (AraratSpa), correr:
#   .\deploy.ps1
#   .\deploy.ps1 "mensaje de commit personalizado"

# Permite pasar un mensaje de commit como argumento al llamar el script.
# Si no se pasa nada, usa "build frontend" por defecto.
param(
    [string]$Mensaje = "build frontend"
)

# NOTA IMPORTANTE sobre $ErrorActionPreference:
# Esto SOLO detiene el script ante errores de cmdlets de PowerShell.
# NO detiene el script si un programa externo (npm, git, vite) termina
# con codigo de salida distinto de 0 - eso hay que chequearlo a mano
# con $LASTEXITCODE despues de cada comando externo. Por eso este script
# lo hace explicitamente en cada paso, en vez de confiar solo en esto.
$ErrorActionPreference = "Stop"

# Pequenia funcion para no repetir la misma verificacion varias veces:
# corta el script con mensaje claro si el ultimo comando externo fallo.
function Detener-SiFallo {
    param([string]$Paso)
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "DEPLOY ABORTADO - fallo: $Paso (codigo de salida $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "No se subio nada a git. Revisa el error de arriba, corregilo, y volve a correr .\deploy.ps1" -ForegroundColor Yellow
        Set-Location $PSScriptRoot
        exit 1
    }
}

Write-Host ""
Write-Host "== 1/4 Compilando frontend ==" -ForegroundColor Cyan
# Entra a la carpeta frontend/ (donde vive el package.json de Vite/React)
Set-Location frontend
# Corre el build: regenera la carpeta dist/ con los archivos nuevos
# (JS/CSS con hash nuevo en el nombre, ej. index-BRs3r-2F.js).
npm run build
Detener-SiFallo "npm run build"

# Chequeo extra, ademas del codigo de salida: confirmar que el build
# realmente genero un index.html con contenido. Si por algun motivo
# vite termino con codigo 0 pero el archivo quedo vacio o no se genero,
# esto lo agarra igual antes de subir nada roto.
$indexPath = "dist\index.html"
if (-not (Test-Path $indexPath) -or (Get-Item $indexPath).Length -eq 0) {
    Write-Host ""
    Write-Host "DEPLOY ABORTADO - dist\index.html no existe o esta vacio despues del build." -ForegroundColor Red
    Write-Host "El build no genero lo esperado. No se subio nada a git." -ForegroundColor Yellow
    Set-Location $PSScriptRoot
    exit 1
}

Write-Host "Build OK - dist\index.html generado correctamente." -ForegroundColor Green

# Vuelve a la raiz del repo para que los siguientes comandos de git
# operen sobre todo el proyecto, no solo sobre frontend/.
Set-Location ..

Write-Host ""
Write-Host "== 2/4 Agregando cambios a git ==" -ForegroundColor Cyan
git add .
Detener-SiFallo "git add ."

# Si no hay ningun cambio real para commitear (por ejemplo, corriste el
# build de nuevo sin haber tocado codigo), 'git commit' fallaria con un
# error confuso. Lo detectamos antes y avisamos con un mensaje claro,
# en vez de que se vea como si algo se hubiera roto.
$cambiosPendientes = git diff --cached --name-only
if (-not $cambiosPendientes) {
    Write-Host ""
    Write-Host "No hay cambios nuevos para subir (todo ya estaba al dia)." -ForegroundColor Yellow
    Write-Host "Nada que commitear ni pushear. Deploy terminado sin cambios." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "== 3/4 Creando commit ==" -ForegroundColor Cyan
git commit -m "$Mensaje"
Detener-SiFallo "git commit"

Write-Host ""
Write-Host "== 4/4 Subiendo a GitHub ==" -ForegroundColor Cyan
git push
Detener-SiFallo "git push"

Write-Host ""
Write-Host "Listo. Ahora entra a cPanel -> Git Version Control -> Update from Remote -> Deploy." -ForegroundColor Green
# IMPORTANTE: este script llega hasta el push. El paso de cPanel
# (Update from Remote + Deploy HEAD Commit) sigue siendo manual -
# este script no lo dispara automaticamente.