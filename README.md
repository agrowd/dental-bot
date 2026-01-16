# OdontoBot - WhatsApp Bot for Dental Clinics

Sistema completo de bot de WhatsApp para clínicas dentales con panel de administración.

## 🚀 Características

- ✅ Bot de WhatsApp Inteligente con flujos personalizables
- ✅ Panel de Administración Web (Next.js)
- ✅ Gestión de Leads y Conversaciones
- ✅ Flow Builder Visual
- ✅ Reglas de Activación Automática
- ✅ Detección de Loops y Auto-Handoff
- ✅ Simulación de Comportamiento Humano (delays 10-15s)
- ✅ Sistema de QR Manual (WhatsApp Web)
- ✅ Base de Datos MongoDB
- ✅ Deploy con Docker

---

## 📋 Requisitos

- Docker y Docker Compose
- VPS con al menos 2GB RAM
- Puerto 3000 (frontend) y 4000 (bot) disponibles

---

## 🛠️ Instalación Local (Desarrollo)

### 1. Clonar repositorio
```bash
git clone https://github.com/tu-repo/dental-response.git
cd dental-response
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
```

Editar `.env.local` con tus valores:
```env
MONGODB_URI=mongodb://localhost:27017/odontobot
JWT_SECRET=tu-secret-super-seguro-cambia-esto
ADMIN_EMAIL=admin@clinica.com
ADMIN_PASSWORD=admin123456
```

### 3. Instalar dependencias
```bash
# Frontend
npm install

# Bot Runner
cd bot-runner
npm install
cd ..
```

### 4. Iniciar MongoDB
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

### 5. Crear admin inicial
```bash
node scripts/seed-admin.js
```

### 6. Iniciar desarrollo
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Bot Runner
cd bot-runner
npm start
```

Acceder a: http://localhost:3000

---

## 🚢 Deploy en VPS con Docker

### 1. Conectar al VPS
```bash
ssh user@tu-vps-ip
```

### 2. Instalar Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
```

### 3. Clonar repositorio en VPS
```bash
git clone https://github.com/tu-repo/dental-response.git
cd dental-response
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env

# Editar con nano o vim
nano .env
```

**⚠️ IMPORTANTE: Cambiar JWT_SECRET y ADMIN_PASSWORD!**

### 5. Construir y levantar servicios
```bash
docker-compose up -d --build
```

### 6. Crear admin inicial
```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

### 7. Ver logs
```bash
docker-compose logs -f
```

---

## 📱 Conectar WhatsApp

### 1. Acceder al panel de admin
```
http://tu-vps-ip:3000
```

### 2. Login
- Email: el configurado en `.env`
- Password: el configurado en `.env`

### 3. Ir a "WhatsApp" en el sidebar

### 4. Presionar "Activar Bot"

### 5. Escanear QR Code
- Abrir WhatsApp en tu teléfono
- Ir a "Dispositivos vinculados"
- Escanear el QR que aparece en pantalla

### 6. ¡Listo!
El bot está conectado y listo para recibir mensajes.

---

## 🎨 Uso del Flow Builder

### Crear Flujo

1. Ir a "Flow Builder" en el sidebar
2. Click en "Crear nuevo flujo"
3. Configurar:
   - Nombre del flujo
   - Descripción
   - **Reglas de Activación:**
     - Origen: Meta Ads / Orgánico
     - Estado en WhatsApp: Agendado / No agendado
     - Prioridad (mayor = más prioridad)

### Editar Pasos

1. Usar la pestaña "Constructor de Menús"
2. Agregar/eliminar pasos con el botón +
3. Para cada paso:
   - Escribir mensaje del bot
   - Agregar opciones (A, B, C...)
   - Seleccionar a dónde va cada opción
   - Ver vista previa en tiempo real

### Publicar

1. Click en "Publicar" cuando esté listo
2. El flujo publicado se activa automáticamente
3. El bot usará la versión publicada (no el draft)

---

## 🔒 Seguridad

### Producción HTTPS

Para usar HTTPS (recomendado):

1. Instalar Nginx
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

2. Configurar Nginx como reverse proxy
```nginx
server {
    server_name tudominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

3. Obtener certificado SSL
```bash
sudo certbot --nginx -d tudominio.com
```

### Cambiar password de admin

1. Login en el panel
2. Ir a configuración
3. Cambiar password

---

## 🐛 Troubleshooting

### Bot no se conecta

1. Verificar logs:
```bash
docker-compose logs bot-runner
```

2. Revisar que MongoDB esté corriendo:
```bash
docker-compose ps
```

3. Reiniciar bot:
```bash
docker-compose restart bot-runner
```

### QR no aparece

1. Verificar que el bot no está en cooldown (esperar 2 minutos)
2. Revisar logs del bot-runner
3. Intentar desconectar y volver a activar

### Mensajes no se procesan

1. Verificar que hay flujos publicados
2. Verificar reglas de activación del flujo
3. Ver logs del bot para errores

---

## 🔄 Backup

### Backup de MongoDB
```bash
docker-compose exec mongo mongodump --out /data/backup
docker cp $(docker-compose ps -q mongo):/data/backup ./backup
```

### Restaurar
```bash
docker cp ./backup $(docker-compose ps -q mongo):/data/backup
docker-compose exec mongo mongorestore /data/backup
```

---

## 📊 Mantenimiento

### Ver uso de recursos
```bash
docker stats
```

### Limpiar logs viejos
```bash
docker-compose logs --tail=100
```

### Actualizar código
```bash
git pull
docker-compose down
docker-compose up -d --build
```

---

## 📞 Soporte

Para preguntas o problemas, contactar al equipo de desarrollo.

---

## ⚖️ Licencia

Propietario - Todos los derechos reservados
