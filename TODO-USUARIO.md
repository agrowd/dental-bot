# 📋 LO QUE TENÉS QUE HACER VOS

Todo el código está listo. Solo necesitás hacer ESTOS 3 PASOS:

---

## 1️⃣ Configurar .env para Producción

Cuando subas el proyecto al VPS, tenés que crear el archivo `.env` con estos datos:

```env
# MongoDB (NO cambiar)
MONGODB_URI=mongodb://mongo:27017/odontobot

# JWT Secret - COMPLETAR CON UN VALOR ALEATORIO FUERTE
# Podés generar uno en el VPS con: openssl rand -base64 32
JWT_SECRET=CAMBIAR-POR-UN-STRING-ALEATORIO-SUPER-SECRETO-DE-32-CARACTERES-MINIMO

# Credenciales del Admin - COMPLETAR
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!

# WhatsApp (NO cambiar)
WHATSAPP_SESSION_PATH=/app/bot-runner/.wwebjs_auth

# Entorno (NO cambiar)
NODE_ENV=production
```

**Para generar JWT_SECRET seguro en el VPS:**
```bash
openssl rand -base64 32
```

---

## 2️⃣ Subir al VPS y Deploy

### Opción A: Con Git (Recomendado)

**En tu PC:**
```bash
git add .
git commit -m "Backend completo para producción"
git push
```

**En el VPS:**
```bash
# Conectar
ssh usuario@IP-DEL-VPS

# Instalar Docker (si no lo tenés)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Salir y volver a conectar
exit
ssh usuario@IP-DEL-VPS

# Clonar proyecto
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO

# Crear .env con los valores que elegiste arriba
nano .env
# Pegar la config y guardar (Ctrl+X, Y, Enter)

# Levantar todo
docker-compose up -d --build

# Crear admin
docker-compose exec nextjs node /app/scripts/seed-admin.js

# Ver logs (opcional)
docker-compose logs -f
```

### Opción B: Con SCP (Sin Git)

**En tu PC (PowerShell):**
```powershell
scp -r "C:\Users\Try Hard\Desktop\Nexte\dental-response" usuario@IP-VPS:/home/usuario/
```

**En el VPS:**
```bash
ssh usuario@IP-DEL-VPS
cd dental-response
# Seguir desde "Crear .env" de la opción A
```

---

## 3️⃣ Conectar WhatsApp

1. Abrir navegador: `http://IP-DEL-VPS:3000`
2. Login con el email/password que pusiste en `.env`
3. Ir a **WhatsApp** en el sidebar
4. Click **"Activar Bot"**
5. Escanear el QR con WhatsApp (Dispositivos vinculados)
6. ¡Listo!

---

## ✅ RESUMEN

**Lo que YA está hecho:**
- ✅ Todo el código backend
- ✅ Modelos de MongoDB
- ✅ API completa
- ✅ Bot de WhatsApp
- ✅ Panel de control
- ✅ Docker configurado
- ✅ Dependencias instaladas

**Lo que VOS tenés que hacer:**
1. Configurar `.env` en el VPS con tus datos
2. Ejecutar `docker-compose up -d --build`
3. Ejecutar `docker-compose exec nextjs node /app/scripts/seed-admin.js`
4. Conectar WhatsApp escaneando el QR

---

## 📖 Guías Completas

- [DEPLOYMENT.md](file:///C:/Users/Try%20Hard/Desktop/Nexte/dental-response/DEPLOYMENT.md) - Guía paso a paso detallada
- [README.md](file:///C:/Users/Try%20Hard/Desktop/Nexte/dental-response/README.md) - Documentación completa
- [walkthrough.md](file:///C:/Users/Try%20Hard/.gemini/antigravity/brain/d1e0edf7-ee1c-430b-8d96-3271cffddba3/walkthrough.md) - Todo lo implementado

---

## 🆘 Si Algo Falla

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Reiniciar todo
docker-compose restart

# Ver estado de los contenedores
docker-compose ps
```
