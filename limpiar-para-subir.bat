@echo off
echo ========================================
echo LIMPIEZA DE NODE_MODULES PARA SUBIR
echo ========================================
echo.
echo Borrando node_modules...
echo.

if exist "node_modules" (
    echo Borrando /node_modules
    rmdir /s /q node_modules
)

if exist "bot-runner\node_modules" (
    echo Borrando /bot-runner/node_modules
    rmdir /s /q bot-runner\node_modules
)

if exist ".next" (
    echo Borrando /.next
    rmdir /s /q .next
)

echo.
echo ========================================
echo LIMPIEZA COMPLETADA
echo ========================================
echo.
echo Carpetas borradas:
echo - /node_modules (si existia)
echo - /bot-runner/node_modules (si existia)
echo - /.next (si existia)
echo.
echo Ahora podes subir la carpeta con WinSCP!
echo.
pause
