# 🚀 DEPLOYMENT CON WINSCP - GUÍA COMPLETA

Veo que ya tenés WinSCP conectado. ¡Perfecto!

---

## 📋 PASOS A SEGUIR

### 1️⃣ PREPARAR LA CARPETA EN TU PC

#### A. Limpiar node_modules (para que pese menos)

**Opción A - Con script automático:**
```
Hacer doble click en: limpiar-para-subir.bat
```

**Opción B - Manual:**
```powershell
# En PowerShell dentro de la carpeta del proyecto
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force bot-runner\node_modules
Remove-Item -Recurse -Force .next
```

#### B. Renombrar .env.example a .env

```powershell
Copy-Item .env.example .env
```

#### C. Editar .env y generar JWT_SECRET

**En tu PC (PowerShell):**
```powershell
# Abrir archivo
notepad .env
```

**Generar JWT Secret en el VPS:**
Vas a tener que conectarte por SSH para esto:
```bash
ssh root@149.50.128.73
openssl rand -base64 32
# Copiar el resultado
```

**Pegar el resultado en .env donde dice:**
```env
JWT_SECRET=PEGAR-AQUI-EL-RESULTADO
```

**Cambiar también:**
```env
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!
```

Guardar y cerrar.

---

### 2️⃣ SUBIR CON WINSCP

#### A. Configuración WinSCP (ya lo tenés)
- Host: `149.50.128.73`
- User: `root`
- ✅ Ya conectado

#### B. Crear carpeta en el VPS

En WinSCP, en el panel derecho (VPS):
1. Navegar a `/root/` o `/home/`
2. Click derecho → **New** → **Directory**
3. Nombre: `odontobot`
4. Enter

#### C. Subir la carpeta

**En WinSCP:**
1. Panel izquierdo: Navegar a `C:\Users\Try Hard\Desktop\Nexte\dental-response`
2. Seleccionar **TODOS** los archivos y carpetas (Ctrl+A)
3. Arrastrar al panel derecho a la carpeta `odontobot`
4. **Esperar** (puede tardar 5-10 minutos)

**Archivos a subir:**
- ✅ src/
- ✅ bot-runner/
- ✅ scripts/
- ✅ .env (el que editaste)
- ✅ docker-compose.yml
- ✅ Dockerfile.nextjs
- ✅ package.json
- ✅ tsconfig.json
- ✅ tailwind.config.ts
- ✅ next.config.ts
- ✅ Todos los .md

**NO subir:**
- ❌ node_modules/ (ya lo borraste)
- ❌ .next/ (ya lo borraste)
- ❌ .git/ (opcional, no es necesario)

---

### 3️⃣ CONFIGURAR MONGODB ATLAS

**IMPORTANTE:** Antes de continuar, ir a MongoDB Atlas:

1. **Network Access** → **Add IP Address**
2. Opción más fácil:
   - IP Address: `0.0.0.0/0`
   - Comment: "Permitir todas las IPs"
   - Click **Confirm**

(Más adelante podés cambiar a solo la IP del VPS)

---

### 4️⃣ EN EL VPS (SSH)

#### A. Conectar por SSH

```bash
ssh root@149.50.128.73
```

#### B. Ir a la carpeta

```bash
cd odontobot
ls -la
```

Deberías ver todos los archivos que subiste.

#### C. Verificar que .env existe

```bash
cat .env
```

Debería mostrar la configuración con MongoDB Atlas URL.

**Si NO existe .env:**
```bash
cp .env.example .env
nano .env
# Editar los valores
# Ctrl+X → Y → Enter para guardar
```

#### D. Instalar Docker (si no está)

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

#### E. Levantar todo con Docker

```bash
docker-compose up -d --build
```

**Esto va a:**
1. Descargar las imágenes base
2. Instalar todos los node_modules automáticamente
3. Construir Next.js
4. Construir bot-runner
5. Levantar todo

**Tiempo estimado:** 8-12 minutos

#### F. Ver progreso

```bash
docker-compose logs -f
```

Buscar líneas como:
```
nextjs      | ✓ Ready in Xms
bot-runner  | Bot API running on port 4000
```

Presionar `Ctrl+C` para salir.

#### G. Crear usuario admin

```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

Deberías ver:
```
✅ Admin user created successfully!
Email: admin@tuclinica.com
```

---

### 5️⃣ VERIFICAR

```bash
docker-compose ps
```

Deberías ver:
```
NAME          STATUS
nextjs        Up
bot-runner    Up
```

---

### 6️⃣ ACCEDER AL PANEL

Abrir navegador: **`http://149.50.128.73:3000`**

**Login:**
- Email: El que pusiste en .env
- Password: El que pusiste en .env

---

### 7️⃣ CONECTAR WHATSAPP

1. Ir a **WhatsApp** en el sidebar
2. Click **"Activar Bot"**
3. **Esperar 10 segundos** - El QR aparecerá
4. Escanear con WhatsApp (Dispositivos vinculados)
5. ✅ Listo!

---

## 🔧 COMANDOS ÚTILES

### Ver logs
```bash
cd odontobot
docker-compose logs -f
docker-compose logs -f bot-runner  # Solo bot
docker-compose logs -f nextjs      # Solo frontend
```

### Reiniciar
```bash
docker-compose restart
```

### Parar todo
```bash
docker-compose down
```

### Actualizar código (si haces cambios)
Volver a subir con WinSCP y luego:
```bash
cd odontobot
docker-compose down
docker-compose up -d --build
```

---

## ✅ CHECKLIST

- [ ] Ejecutar `limpiar-para-subir.bat`
- [ ] Copiar `.env.example` a `.env`
- [ ] Generar JWT_SECRET y editar `.env`
- [ ] Agregar `0.0.0.0/0` en MongoDB Atlas Network Access
- [ ] Subir carpeta con WinSCP a `/root/odontobot`
- [ ] SSH al VPS
- [ ] `docker-compose up -d --build`
- [ ] `docker-compose exec nextjs node /app/scripts/seed-admin.js`
- [ ] Acceder a `http://149.50.128.73:3000`
- [ ] Conectar WhatsApp

---

## 🎉 ¡LISTO!

Todo debería estar funcionando. Los node_modules se instalan automáticamente cuando Docker construye las imágenes (están en los Dockerfiles).
