# 🚀 DEPLOYMENT VÍA SSH

El código está en Git y listo. Seguí estos pasos:

---

## 1️⃣ Subir a GitHub

```bash
# En tu PC (PowerShell en la carpeta del proyecto)
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

---

## 2️⃣ En el VPS (vía SSH)

### Paso A: Conectar al VPS
```bash
ssh usuario@IP-DEL-VPS
```

### Paso B: Instalar Docker (si no está)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Salir y volver a conectar
exit
ssh usuario@IP-DEL-VPS
```

### Paso C: Clonar y configurar
```bash
# Clonar proyecto
git clone https://github.com/TU-USUARIO/TU-REPO.git odontobot
cd odontobot

# Generar JWT secret
openssl rand -base64 32
# Copiar el resultado

# Crear .env
nano .env
```

**Pegar esto en .env:**
```env
MONGODB_URI=TU-MONGODB-ATLAS-URL-AQUI
JWT_SECRET=el-resultado-del-openssl-aqui
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!
WHATSAPP_SESSION_PATH=/app/bot-runner/.wwebjs_auth
NODE_ENV=production
```

Guardar: `Ctrl+X` → `Y` → `Enter`

### Paso D: Actualizar docker-compose.yml para MongoDB Atlas

```bash
nano docker-compose.yml
```

**Cambiar la sección de mongo** a:
```yaml
version: '3.8'

services:
  # Next.js Frontend + API
  nextjs:
    build:
      context: .
      dockerfile: Dockerfile.nextjs
    restart: always
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production

  # WhatsApp Bot Runner
  bot-runner:
    build:
      context: ./bot-runner
      dockerfile: Dockerfile
    restart: always
    ports:
      - "4000:4000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - WHATSAPP_SESSION_PATH=/app/.wwebjs_auth
    volumes:
      - whatsapp-session:/app/.wwebjs_auth

volumes:
  whatsapp-session:
```

**Nota:** Eliminamos el servicio `mongo` ya que usás MongoDB Atlas externo.

### Paso E: Levantar todo
```bash
docker-compose up -d --build
```

Esperar 3-5 minutos para que se construyan las imágenes.

### Paso F: Crear admin
```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

### Paso G: Ver logs
```bash
docker-compose logs -f
```

Presionar `Ctrl+C` para salir de los logs.

---

## 3️⃣ Acceder y Conectar WhatsApp

1. Abrir: `http://IP-DEL-VPS:3000`
2. Login con el email/password del `.env`
3. Ir a **WhatsApp** → **Activar Bot**
4. Escanear QR con WhatsApp
5. ¡Listo!

---

## 🔄 Actualizar Código

```bash
# En el VPS
cd odontobot
git pull
docker-compose down
docker-compose up -d --build
```

---

## ⚠️ IMPORTANTE

- **QR funciona:** ✅ Probado localmente y se genera correctamente
- **MongoDB:** Usar la URL de MongoDB Atlas que me pases
- **Firewall:** Asegurarte que el puerto 3000 esté abierto
- **HTTPS:** Opcional pero recomendado (ver DEPLOYMENT.md)

---

## 📞 Si algo falla

```bash
# Ver qué contenedores están corriendo
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs nextjs
docker-compose logs bot-runner

# Reiniciar todo
docker-compose restart
```
