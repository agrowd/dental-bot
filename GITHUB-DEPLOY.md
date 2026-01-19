# Guía de Despliegue con GitHub y VPS

Esta guía detalla los pasos para desplegar **OdontoBot** utilizando GitHub para el control de versiones, lo cual facilita actualizaciones futuras.

## 1. Preparación Local

Primero, asegurate de que todos los cambios estén guardados y la versión local funcione correctamente.

### Inicializar Repositorio (Solo la primera vez)
Abre una terminal en `dental-response` y ejecuta:

```bash
# Inicializar git
git init

# Agregar todos los archivos
git add .

# Crear primer commit
git commit -m "Initial commit - Production Ready"

# Crear rama main
git branch -M main
```

### Crear Repositorio en GitHub
1. Ve a [GitHub.com](https://github.com/new) y crea un nuevo repositorio (privado recomendado).
2. Copia la URL del repositorio (ej: `https://github.com/usuario/odontobot.git`).

### Conectar y Subir
```bash
# Agregar remoto (reemplaza URL)
git remote add origin https://github.com/TU_USUARIO/odontobot.git

# Subir código
git push -u origin main
```

---

## 2. Preparación del VPS

Conéctate a tu VPS vía SSH:
```bash
ssh root@149.50.128.73
# Ingresa tu contraseña
```

### Primera Instalación

1. **Clonar el repositorio:**
   *(Necesitarás un token de acceso personal de GitHub o una clave SSH configurada en el VPS)*
   ```bash
   cd /var/www
   git clone https://github.com/TU_USUARIO/odontobot.git
   cd odontobot
   ```

2. **Configurar Variables de Entorno:**
   Crea el archivo `.env.production`:
   ```bash
   cp .env.example .env.production
   nano .env.production
   ```
   *Edita las variables con los valores reales:*
   - `MONGODB_URI`: Tu conexión de Atlas
   - `JWT_SECRET`: Una clave segura
   - `NEXT_PUBLIC_BOT_URL`: `http://149.50.128.73:4000`
   - `NEXT_PUBLIC_API_URL`: `http://149.50.128.73:3000`

   *(Guarda con Ctrl+O, Enter, Ctrl+X)*

### Construir e Iniciar

```bash
# Construir y levantar contenedores
docker-compose -f docker-compose.yml up -d --build
```

---

## 3. Actualizaciones Futuras

Cuando hagas cambios en tu código local:

1. **Local:**
   ```bash
   git add .
   git commit -m "Descripción de cambios"
   git push
   ```

2. **VPS:**
   ```bash
   ssh root@149.50.128.73
   cd /var/www/odontobot
   
   # Bajar cambios
   git pull
   
   # Reconstruir (solo si hubo cambios en dependencias o estructura)
   docker-compose up -d --build
   
   # O reiniciar simple (si fue solo código)
   docker-compose restart nextjs
   ```

## 4. Verificación

- **Frontend:** http://149.50.128.73:3000/admin
- **Bot:** http://149.50.128.73:4000/bot/status

---

## Solución de Problemas

**Si el bot no conecta:**
- Verifica que el puerto 4000 esté abierto en el firewall: `ufw status`
- Revisa logs: `docker-compose logs -f bot-runner`

**Si la web no carga:**
- Verifica logs de nextjs: `docker-compose logs -f nextjs`
