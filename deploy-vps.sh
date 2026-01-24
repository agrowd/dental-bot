#!/bin/bash

# Script de Despliegue Seguro para VPS (Compatible con Docker antiguo)
# Uso: bash deploy-vps.sh

echo "🚀 INICIANDO DESPLIEGUE SEGURO..."

# 1. Configurar Modo Compatibilidad (CRUCIAL para evitar error ContainerConfig)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
echo "✅ Modo compatibilidad activado"

# 2. Limpieza Profunda (Anti-Ghost Containers)
echo "🧹 Limpiando contenedores antiguos..."
docker-compose down --remove-orphans || true
docker container prune -f || true

# Kill any process using port 4000 (just in case PM2 or Node is running outside Docker)
echo "🗡️  Liberando puerto 4000..."
fuser -k 4000/tcp || true

# 3. Actualizar Código
echo "⬇️  Bajando última versión del código..."
git pull

# 4. Reconstruir y Levantar
echo "🏗️  Construyendo y levantando servicios..."
docker-compose up -d --build

# 5. Verificación
echo "✅ Despliegue completado."
echo "📜 Mostrando logs en vivo (Presiona Ctrl+C para salir)..."
echo "-----------------------------------------------------"
sleep 2
docker logs -f dental-bot-runner
