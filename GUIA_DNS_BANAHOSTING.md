# PASO A PASO: Apuntar Dominio en BanaHosting

Hola Salva, para que el dominio `lookingfor.com.ar` funcione con el sistema nuevo (que ya está instalado y esperando), necesitamos hacer un pequeño cambio en el panel de **BanaHosting**.

No hay que subir archivos por FTP, solo cambiar una configuración de "dirección".

---

## 1. Entrar al cPanel
Ingresá al panel de control de tu hosting (cPanel). Usualmente es `tudominio.com/cpanel` o desde el área de clientes de BanaHosting.

## 2. Buscar "Zone Editor" (Editor de Zona)
En la pantalla principal, buscá la sección **DOMINIOS** y hacé clic en el ícono que dice **Zone Editor** (o Editor de Zona DNS).

## 3. Administrar el dominio
Vas a ver una lista de tus dominios. Buscá `lookingfor.com.ar` y hacé clic en el botón que dice **ADMINISTRAR** (o MANAGE).

## 4. Editar el Registro "A"
Verás una lista de registros. Buscá el que en la columna **TIPO** dice **"A"** y en **NOMBRE** dice `lookingfor.com.ar.` (o simplemente un punto `.`).

1.  Hacé clic en **EDITAR** al lado de ese registro.
2.  Donde dice **RECORD** (o Destino/IP), borrá lo que hay y poné esta IP (que es la de mi servidor):
    👉 **[IP-DEL-VPS]** *(Fede: Reemplazá esto con la IP real antes de enviarlo)*
3.  Hacé clic en **GUARDAR RECORD**.

---

## ¡Listo!
Con eso ya está. En un par de horas, cuando alguien escriba `lookingfor.com.ar`, internet sabrá que tiene que ir a buscar la info a mi servidor nuevo en lugar de al hosting compartido.

Avísame cuando quede y yo activo el certificado de seguridad (el candadito verde).
