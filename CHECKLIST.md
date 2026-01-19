# ✅ CHECKLIST DEPLOYMENT - WINSCP

## 🎯 LO QUE TENÉS QUE HACER

### EN TU PC (Windows)

#### 1. Limpiar node_modules
```
Hacer doble click: limpiar-para-subir.bat
```
Esto borra:
- `/node_modules`
- `/bot-runner/node_modules`
- `/.next`

#### 2. Copiar .env
```powershell
Copy-Item .env.example .env
```

#### 3. Editar .env
Abrir `.env` con notepad y cambiar:

**a) JWT_SECRET:**
Generar en el VPS con SSH:
```bash
ssh root@149.50.128.73
openssl rand -base64 32
```
Copiar el resultado y pegar en .env

**b) ADMIN_EMAIL y ADMIN_PASSWORD:**
```env
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!
```

#### 4. MongoDB Atlas - Permitir IPs
- Ir a https://cloud.mongodb.com
- Network Access → Add IP Address
- IP: `0.0.0.0/0`
- Comment: "Permitir todas"
- Confirm

#### 5. Subir con WinSCP
- Conectar a `149.50.128.73` (ya lo tenés)
- Crear carpeta `/root/odontobot`
- Arrastrar TODA la carpeta `dental-response` a `odontobot`
- Esperar 5-10 minutos

---

### EN EL VPS (SSH)

#### 6. Conectar
```bash
ssh root@149.50.128.73
```

#### 7. Ir a carpeta
```bash
cd odontobot
ls -la
```

#### 8. Verificar .env
```bash
cat .env
```
Debería mostrar MongoDB URL y tus valores.

#### 9. Instalar Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

#### 10. Levantar todo
```bash
docker-compose up -d --build
```
Esperar 8-12 minutos.

#### 11. Ver logs
```bash
docker-compose logs -f
```
Buscar: "Ready in" y "Bot API running"
Ctrl+C para salir.

#### 12. Crear admin
```bash
docker-compose exec nextjs node /app/scripts/seed-admin.js
```

#### 13. Verificar
```bash
docker-compose ps
```
Debería ver "Up" en ambos servicios.

---

### EN EL NAVEGADOR

#### 14. Acceder al panel
```
http://149.50.128.73:3000
```

Login con el email/password de .env

#### 15. Conectar WhatsApp
1. WhatsApp (sidebar)
2. "Activar Bot"
3. Esperar QR (10 segundos)
4. Escanear con tu teléfono
5. ✅ Listo!

---

## 🚨 SI ALGO FALLA

### MongoDB error
```bash
# Verificar que agregaste 0.0.0.0/0 en Atlas
# Ver logs:
docker-compose logs nextjs | grep -i mongo
```

### Bot no conecta
```bash
docker-compose logs bot-runner
docker-compose restart bot-runner
```

### Panel no carga
```bash
docker-compose ps
docker-compose logs nextjs
```

---

## ✅ ARCHIVOS IMPORTANTES

📄 **WINSCP-DEPLOY.md** - Guía completa detallada
📄 **limpiar-para-subir.bat** - Script para borrar node_modules
📄 **.env.example** - Template (ya tiene MongoDB Atlas URL)

---

## 🎉 AL TERMINAR

Deberías tener:
- ✅ Panel en http://149.50.128.73:3000
- ✅ Login funcionando
- ✅ WhatsApp conectado (QR escaneado)
- ✅ Base de datos en MongoDB Atlas
- ✅ Todo corriendo en Docker

**Próximo paso:** Crear flujos en Flow Builder!
