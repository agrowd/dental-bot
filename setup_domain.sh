#!/bin/bash

# Script de Configuración Automática de Dominio y SSL
# Uso: sudo bash setup_domain.sh

echo "🚀 INICIANDO CONFIGURACIÓN DE DOMINIO..."

if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, corré este script como root (sudo bash setup_domain.sh)"
  exit 1
fi

# 1. Solicitar Dominio
read -p "📝 Ingresá tu dominio (ej: midominio.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo "❌ Tenés que escribir un dominio."
    exit 1
fi

echo "✅ Dominio seleccionado: $DOMAIN_NAME"

# 2. Instalar Nginx y Certbot
echo "⬇️  Instalando Nginx y Certbot..."
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# 3. Crear Configuración de Nginx
echo "⚙️  Configurando Nginx..."
CONFIG_FILE="/etc/nginx/sites-available/$DOMAIN_NAME"

cat > $CONFIG_FILE <<EOF
server {
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 4. Activar Sitio
echo "🔌 Activando sitio..."
sudo ln -sf $CONFIG_FILE /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 5. Obtener Certificado SSL
echo "🔒 Obteniendo certificado SSL (HTTPS)..."
sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME --non-interactive --agree-tos --email admin@$DOMAIN_NAME --redirect

echo " "
echo "✅ ¡LISTO! Tu bot debería estar accesible en: https://$DOMAIN_NAME"
echo " "
