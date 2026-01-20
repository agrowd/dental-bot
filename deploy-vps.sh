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
docker-compose down --remove-orphans
docker container prune -f

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
docker logs -f dental-bot_nextjs_1
