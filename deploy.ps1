# deploy.ps1
# Compila el frontend y sube los cambios (codigo + build) a GitHub,
# listos para hacer pull/deploy desde cPanel.
#
# Uso: desde la carpeta raiz del proyecto (AraratSpa), correr:
#   .\deploy.ps1
#   .\deploy.ps1 "mensaje de commit personalizado"

param(
    [string]$Mensaje = "build frontend"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "== 1/4 Compilando frontend ==" -ForegroundColor Cyan
Set-Location frontend
npm run build
Set-Location ..

Write-Host ""
Write-Host "== 2/4 Agregando cambios a git ==" -ForegroundColor Cyan
git add .

Write-Host ""
Write-Host "== 3/4 Creando commit ==" -ForegroundColor Cyan
git commit -m "$Mensaje"

Write-Host ""
Write-Host "== 4/4 Subiendo a GitHub ==" -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "Listo. Ahora entra a cPanel -> Git Version Control -> Update from Remote -> Deploy." -ForegroundColor Green