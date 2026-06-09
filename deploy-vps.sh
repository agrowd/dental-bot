#!/bin/bash

# Script de Despliegue Seguro para VPS (Compatible con Docker antiguo)
# Uso: bash deploy-vps.sh

echo "🚀 INICIANDO DESPLIEGUE SEGURO..."

# 1. Configurar Modo Compatibilidad (CRUCIAL para evitar error ContainerConfig)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
echo "✅ Modo compatibilidad activado"

# Detectar comando docker compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi
echo "✅ Comando detectado: $DOCKER_COMPOSE"

# 2. Limpieza Agresiva (Safe Mode)
echo "🧹 Limpiando contenedores y procesos previos..."
$DOCKER_COMPOSE down --remove-orphans || true
docker system prune -f || true
echo "✅ Limpieza completada"

# 3. Actualizar Código
echo "⬇️  Bajando última versión del código..."
git pull

# 4. Reconstruir y Levantar
echo "🏗️  Construyendo y levantando servicios..."
$DOCKER_COMPOSE up -d --build

# 5. Verificación
echo "✅ Despliegue completado."
echo "📜 Mostrando logs en vivo (Presiona Ctrl+C para salir)..."
echo "-----------------------------------------------------"
sleep 2
docker logs -f dental-bot-runner
