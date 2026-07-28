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

# Si CUALQUIER comando falla (ej. el build tira un error de sintaxis),
# el script se detiene aqui mismo y NO sigue con commit/push.
# Esto evita subir a producción un frontend a medio compilar o roto.
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "== 1/4 Compilando frontend ==" -ForegroundColor Cyan
# Entra a la carpeta frontend/ (donde vive el package.json de Vite/React)
Set-Location frontend
# Corre el build: regenera la carpeta dist/ con los archivos nuevos
# (JS/CSS con hash nuevo en el nombre, ej. index-BRs3r-2F.js).
# Este hash nuevo es justamente lo que ayuda a que el navegador
# no siga sirviendo el bundle viejo desde el Service Worker/caché.
npm run build
# Vuelve a la raiz del repo para que los siguientes comandos de git
# operen sobre todo el proyecto, no solo sobre frontend/.
Set-Location ..

Write-Host ""
Write-Host "== 2/4 Agregando cambios a git ==" -ForegroundColor Cyan
# Agrega TODOS los cambios pendientes del repo (incluye dist/ nuevo,
# archivos borrados del build viejo, y cualquier otro cambio de código
# que tengas, ej. backend). El .gitignore ya protege venv/, .env,
# node_modules/, etc., asi que no hay riesgo de subir algo sensible.
git add .

Write-Host ""
Write-Host "== 3/4 Creando commit ==" -ForegroundColor Cyan
# Crea el commit con el mensaje que pasaste (o el default).
git commit -m "$Mensaje"

Write-Host ""
Write-Host "== 4/4 Subiendo a GitHub ==" -ForegroundColor Cyan
# Sube el commit al repo remoto (GitHub). Desde aca, cPanel puede
# hacer "Update from Remote" para traer estos cambios.
git push

Write-Host ""
Write-Host "Listo. Ahora entra a cPanel -> Git Version Control -> Update from Remote -> Deploy." -ForegroundColor Green
# IMPORTANTE: este script llega hasta el push. El paso de cPanel
# (Update from Remote + Deploy HEAD Commit) sigue siendo manual —
# este script no lo dispara automaticamente.