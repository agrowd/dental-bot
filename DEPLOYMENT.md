# 🚀 CHECKLIST DE DEPLOYMENT A VPS

Este es el listado de pasos que necesitás hacer para subir OdontoBot al VPS.

---

## ✅ Pre-requisitos

- [ ] VPS con Ubuntu/Debian (mínimo 2GB RAM)
- [ ] Acceso SSH al VPS
- [ ] Git instalado en el VPS
- [ ] Puerto 3000 abierto en el firewall del VPS

---

## 📝 Pasos a Seguir

### 1. Conectar al VPS

```bash
ssh usuario@IP-DEL-VPS
```

---

### 2. Instalar Docker en el VPS

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Luego salir y volver a conectar para que el grupo docker se aplique:**
```bash
exit
ssh usuario@IP-DEL-VPS
```

---

### 3. Subir el código al VPS

**Opción A - Con Git (RECOMENDADO):**

```bash
# En tu computadora, commitear todo
git add .
git commit -m "Backend completo listo para producción"
git push

# En el VPS
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO
```

**Opción B - Con SCP (sin Git):**

```bash
# En tu computadora (PowerShell)
scp -r C:\Users\Try Hard\Desktop\Nexte\dental-response usuario@IP-DEL-VPS:/home/usuario/
```

---

### 4. **⚠️ CONFIGURAR .env (CRÍTICO)**

En el VPS, dentro de la carpeta del proyecto:

```bash
cp .env.example .env
nano .env
```

**Completar con estos valores:**

```env
# MongoDB (dejar como está, Docker lo maneja)
MONGODB_URI=mongodb://mongo:27017/odontobot

# JWT Secret - GENERAR UNO NUEVO Y FUERTE
JWT_SECRET=PEGAR-TU-JWT-SECRET-AQUI

# Credenciales del Admin
ADMIN_EMAIL=TU-EMAIL-AQUI
ADMIN_PASSWORD=TU-PASSWORD-SEGURO-AQUI

# WhatsApp
WHATSAPP_SESSION_PATH=/app/bot-runner/.wwebjs_auth

# Entorno
NODE_ENV=production
```

**Para generar JWT_SECRET seguro:**
```bash
# En el VPS, ejecutar:
openssl rand -base64 32
# Copiar el resultado y pegarlo en JWT_SECRET
```

**Guardar y salir:** `Ctrl+X` → `Y` → `Enter`

---

### 5. Levantar Todo con Docker

```bash
docker-compose up -d --build
```

Este comando:
- Descarga MongoDB
- Construye la imagen de Next.js
- Construye la imagen del bot-runner
- Levanta los 3 servicios en segundo plano

**Esperar 2-3 minutos** para que se construyan las imágenes.

---

### 6. Crear Usuario Admin

```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

Deberías ver:
```
✅ Admin user created successfully!
Email: tu-email@ejemplo.com
Password: tu-password
```

---

### 7. Verificar que Todo Esté Corriendo

```bash
docker-compose ps
```

Deberías ver 3 servicios "Up":
- `mongo`
- `nextjs`
- `bot-runner`

**Ver logs si hay problemas:**
```bash
docker-compose logs -f
```

---

### 8. Acceder al Panel

Abrir en el navegador:
```
http://IP-DEL-VPS:3000
```

**Login con:**
- Email: El que pusiste en `.env`
- Password: El que pusiste en `.env`

---

### 9. Conectar WhatsApp

1. En el panel, ir a **WhatsApp** (sidebar izquierdo)
2. Click en **"🚀 Activar Bot"**
3. Aparecerá un código QR
4. Abrir WhatsApp en tu teléfono
5. Ir a **Dispositivos vinculados**
6. **Escanear el código QR**
7. ¡Listo! El bot queda conectado

---

### 10. Crear Primer Flujo

1. Ir a **Flow Builder**
2. Editar el flujo existente o crear uno nuevo
3. Configurar pasos y opciones
4. Click en **"Publicar"**

---

### 11. (OPCIONAL) Configurar HTTPS

Para usar un dominio con HTTPS:

```bash
# Instalar Nginx y Certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# Configurar Nginx como reverse proxy
sudo nano /etc/nginx/sites-available/odontobot
```

**Contenido del archivo:**
```nginx
server {
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Activar el sitio:**
```bash
sudo ln -s /etc/nginx/sites-available/odontobot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Obtener certificado SSL:**
```bash
sudo certbot --nginx -d tudominio.com
```

Ahora podés acceder por: `https://tudominio.com`

---

## 🔧 Comandos Útiles

### Ver logs en tiempo real
```bash
docker-compose logs -f
```

### Reiniciar todo
```bash
docker-compose restart
```

### Parar todo
```bash
docker-compose down
```

### Actualizar código
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Backup de MongoDB
```bash
docker-compose exec mongo mongodump --out /data/backup
docker cp $(docker-compose ps -q mongo):/data/backup ./backup-$(date +%Y%m%d)
```

### Ver uso de recursos
```bash
docker stats
```

---

## ⚠️ Troubleshooting

### Bot no se conecta
```bash
docker-compose logs bot-runner
docker-compose restart bot-runner
```

### Frontend no carga
```bash
docker-compose logs nextjs
# Verificar que puerto 3000 esté libre
sudo netstat -tulpn | grep 3000
```

### MongoDB no responde
```bash
docker-compose logs mongo
docker-compose restart mongo
```

---

## 🎉 ¡Listo!

Si seguiste todos los pasos, ahora deberías tener:
- ✅ Panel admin funcionando en `http://IP-VPS:3000`
- ✅ Bot de WhatsApp conectado
- ✅ Base de datos MongoDB corriendo
- ✅ Todo dockerizado y listo para producción

---

## 📞 Soporte

Si algo no funciona:
1. Revisar logs: `docker-compose logs -f`
2. Verificar firewall del VPS
3. Verificar que el puerto 3000 esté abierto
4. Revisar el `.env` que esté bien configurado
