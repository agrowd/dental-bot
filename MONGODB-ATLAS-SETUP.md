# ⚠️ IMPORTANTE - Configuración IP de MongoDB Atlas

Veo en la imagen que MongoDB Atlas requiere que agregues la IP del VPS a la lista de acceso.

## 📝 Pasos a seguir:

### 1. Obtener IP del VPS

**En el VPS, ejecutar:**
```bash
curl ifconfig.me
```

Esto te dará la IP pública del VPS (ejemplo: `45.123.45.67`)

---

### 2. Agregar IP en MongoDB Atlas

1. Ir a MongoDB Atlas → **Network Access**
2. Click en **"Add IP Address"**
3. Opciones:

**Opción A - Específica (más seguro):**
- Pegar la IP del VPS que obtuviste
- Descripción: "VPS OdontoBot"

**Opción B - Permitir todo (menos seguro pero más fácil):**
- IP: `0.0.0.0/0`
- Descripción: "Permitir todas las IPs"
- ⚠️ Solo recomendado para testing

---

### 3. URL Final de MongoDB

Tu URL completa es:
```
mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority
```

**⚠️ NOTA:** Agregué `/odontobot` al final para especificar el nombre de la base de datos.

---

### 4. Crear el archivo .env en el VPS

**En el VPS después de clonar el repo:**

```bash
cat > .env << 'EOF'
MONGODB_URI=mongodb+srv://federicomartinromero8_db_user:RjR8viaP3T5WobJe@odontobot.1v1bdcg.mongodb.net/odontobot?retryWrites=true&w=majority
JWT_SECRET=GENERAR-CON-OPENSSL-RAND-BASE64-32
ADMIN_EMAIL=admin@tuclinica.com
ADMIN_PASSWORD=TuPasswordSeguro123!
WHATSAPP_SESSION_PATH=/app/bot-runner/.wwebjs_auth
NODE_ENV=production
EOF
```

Luego editar y cambiar el JWT_SECRET:
```bash
nano .env
# Generar JWT secret:
openssl rand -base64 32
# Copiar el resultado y pegarlo en JWT_SECRET
```

---

## ✅ Checklist Final

- [ ] Agregar IP del VPS a MongoDB Atlas Network Access
- [ ] Crear archivo `.env` en el VPS con la URL de MongoDB Atlas
- [ ] Generar JWT_SECRET con `openssl rand -base64 32`
- [ ] `docker-compose up -d --build`
- [ ] `docker-compose exec nextjs node /app/scripts/seed-admin.js`
- [ ] Acceder a `http://IP-VPS:3000`
- [ ] Conectar WhatsApp

---

## 🔐 Seguridad

**IMPORTANTE:** La URL de MongoDB contiene tu password. **NO** la subas a GitHub.

El `.gitignore` ya está configurado para excluir `.env`, así que estás protegido.
