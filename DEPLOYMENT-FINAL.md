# 🚀 DEPLOYMENT FINAL - PASO A PASO

Tu MongoDB Atlas URL: `mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority`

---

## 🔥 IMPORTANTE ANTES DE EMPEZAR

### Configurar MongoDB Atlas Network Access

**Tienes 2 opciones:**

#### Opción A: Permitir todas las IPs (más fácil)
En MongoDB Atlas → Network Access → Add IP Address:
- IP: `0.0.0.0/0`  
- Descripción: "Permitir todas"
- ⚠️ Menos seguro pero funciona de inmediato

#### Opción B: Solo IP del VPS (más seguro)
1. En el VPS: `curl ifconfig.me` para obtener tu IP
2. En MongoDB Atlas → Network Access → Add IP Address
3. Agregar esa IP específica

**Recomendación:** Empieza con Opción A para probar, luego cambia a Opción B.

---

## 📝 PASOS EN TU PC (Windows)

### 1. Subir a GitHub

```powershell
# En PowerShell dentro de la carpeta del proyecto
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

---

## 🖥️ PASOS EN EL VPS (SSH)

### 2. Conectar al VPS

```bash
ssh usuario@IP-DEL-VPS
```

### 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Desconectar y volver a conectar
exit
ssh usuario@IP-DEL-VPS
```

### 4. Clonar el proyecto

```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git odontobot
cd odontobot
```

### 5. Generar JWT Secret

```bash
openssl rand -base64 32
```

**Copiar el resultado** (ejemplo: `xK7mP9nQ2rS8tU3vW6yZ1aC4dF5gH8jK`)

### 6. Crear archivo .env

```bash
nano .env
```

**Pegar esto (reemplazando JWT_SECRET con el que generaste):**

```env
MONGODB_URI=mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority
JWT_SECRET=PEGAR-AQUI-EL-RESULTADO-DEL-OPENSSL
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!
WHATSAPP_SESSION_PATH=/app/bot-runner/.wwebjs_auth
NODE_ENV=production
```

**Guardar:** `Ctrl+X` → `Y` → `Enter`

### 7. Levantar todo con Docker

```bash
docker-compose up -d --build
```

**Esto tomará 5-7 minutos** mientras construye las imágenes.

Ver progreso:
```bash
docker-compose logs -f
```

(Presionar `Ctrl+C` para salir de los logs)

### 8. Crear usuario admin

```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

Deberías ver:
```
✅ Admin user created successfully!
Email: admin@tuclinica.com
```

### 9. Verificar que todo está corriendo

```bash
docker-compose ps
```

Deberías ver:
```
NAME          STATUS       PORTS
nextjs        Up          0.0.0.0:3000->3000/tcp
bot-runner    Up          0.0.0.0:4000->4000/tcp
```

---

## 🌐 ACCEDER AL PANEL

Abrir navegador: **`http://IP-DEL-VPS:3000`**

**Login:**
- Email: `admin@tuclinica.com`
- Password: El que pusiste en `.env`

---

## 📱 CONECTAR WHATSAPP

1. En el panel, ir a **WhatsApp** (sidebar izquierdo)
2. Click en **"🚀 Activar Bot"**
3. Esperar 5-10 segundos
4. **Aparecerá el código QR**
5. Abrir WhatsApp en tu teléfono
6. Ir a **⋮ → Dispositivos vinculados**
7. **Escanear el código QR**
8. ✅ ¡Listo! El bot estará conectado

---

## ✅ VERIFICAR QUE TODO FUNCIONA

1. El panel muestra **"🟢 Conectado"** en WhatsApp
2. Crear o editar un flujo en **Flow Builder**
3. Click en **"Publicar"**
4. Enviar un mensaje de prueba al número de WhatsApp
5. El bot debería responder automáticamente

---

## 🔧 COMANDOS ÚTILES

### Ver logs en tiempo real
```bash
docker-compose logs -f bot-runner    # Solo bot
docker-compose logs -f nextjs        # Solo frontend
docker-compose logs -f               # Todo
```

### Reiniciar un servicio
```bash
docker-compose restart bot-runner
docker-compose restart nextjs
```

### Parar todo
```bash
docker-compose down
```

### Actualizar código (después de hacer cambios)
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Ver uso de recursos
```bash
docker stats
```

---

## ⚠️ TROUBLESHOOTING

### El panel no carga
```bash
# Verificar que el contenedor está corriendo
docker-compose ps

# Ver logs de Next.js
docker-compose logs nextjs

# Verificar firewall
sudo ufw status
sudo ufw allow 3000
```

### El bot no se conecta
```bash
# Ver logs del bot
docker-compose logs bot-runner

# Reiniciar el bot
docker-compose restart bot-runner
```

### "Error connecting to MongoDB"
- Verificar que agregaste la IP en MongoDB Atlas Network Access
- Verificar que la URL en `.env` es correcta
- Logs: `docker-compose logs nextjs | grep mongo`

---

## 🎉 ¡LISTO!

Si seguiste todos los pasos, ahora tenés:
- ✅ Panel admin funcionando
- ✅ Bot de WhatsApp conectado
- ✅ Base de datos en la nube (MongoDB Atlas)
- ✅ Todo dockerizado y corriendo en producción

Para crear flujos personalizados, ir a **Flow Builder** y empezar a construir! 🚀
