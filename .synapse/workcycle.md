# Workcycle

### 02/03/2026 - UI/UX Leads y Lógica de Bot
- **Frontend Leads:** Se incorporaron columnas fixed (*sticky*) en la tabla de leads para facilitar el scroll horizontal. Se agregó un botón *Pausar Bot* en la fila de acciones (D-05).
- **Frontend Conversations:** Se modificó el `useEffect` para el chat; ahora *no* hace auto-scroll al fondo al cargar el historial, sino que solo scrollea si llega un *nuevo* mensaje activamente.
- **Backend Bot Engine:** Se removió la autonomía del bot para pausarse solo (eliminada la pausa al enviar media, al caer en lockouts y mediante detectores de handoff). Solo se pausa si viene explícitamente desde el Flow Builder o si el humano apreta el botón físico en el CRM.
- **Bug Fix (Force Start):** El lead forzado (ej. `5491133640291`) se inyectaba solo como Conversation y no como Contact. Se agregó la lógica en `POST /bot/force-start` para asegurar la creación del documento *Contact* inmediatamente, visibilizándolo al instante en la lista de Leads del CRM.

> Se pusheó todo a GitHub (commit `30c5378`).

### 17/03/2026 - Notificaciones WhatsApp y Auto-Tagging
- **Bot-Runner (Sticky Unread)**: Se implementó un delay de 2.5s para `markUnread()` tras la respuesta del bot. Esto soluciona el problema de que el chat se marcaba como leído instantáneamente al enviar el bot su mensaje (D-06).
- **Bot-Runner (Auto-Tagging Info)**: Se agregó un detector de palabras clave (tienda, pdf, prótesis) que etiqueta automáticamente al lead como `solicito-info` en el CRM y le pone la etiqueta WA `ℹ️ SOLICITÓ INFO`.
- **CRM Leads UI**: Se actualizó la leyenda de etiquetas y se añadió el filtro rápido para la nueva etiqueta `solicito-info`.

> Se pusheó todo a GitHub (commit `4d4d6e6`).

### 24/03/2026 - Correcciones Críticas del Bot
- **P1 (System Message Filter)**: El bot enviaba bienvenida+fallback a contactos que cambiaban de número (WhatsApp emite `notification`). Se agregó filtro por `msg.type` — solo procesa `chat`, `image`, `ptt`, `audio`, `video`, `document`, `sticker`.
- **P2 (Lead Form)**: Después de completar el formulario (nombre+email), el bot no avanzaba al siguiente paso por desincronización entre el objeto en memoria y la DB. Se fuerza un `findById()` antes de la llamada recursiva a `handleStepLogic()`.
- **P4 (Persistent Unread)**: Se agregó campo `forceUnread` (default: true) al modelo Conversation. Cada vez que el bot envía un mensaje (`message_create`, `fromMe`), verifica este flag y re-marca como no leído con 3s de delay. Solo se apaga desde el CRM.
- **P5 (Paused en Leads)**: Se agregó card "Pausados (Derivados)" en la vista de Leads con contador y filtro rápido.


> Se pusheó todo a GitHub (commits `7d04c28`, `77f6b7b`).

### 24/03/2026 - Trazabilidad y Refactor Agendados
- **Bot-Runner (Contact Status)**: Se cambió la lógica de `status` en el modelo Contact. Ahora el bot lee `isMyContact` directamente desde la libreta de direcciones de WhatsApp Web (`msg.getContact()`) y asigna estrictamente `agendado` o `no_agendado`. 'Pendiente' queda deprecado.
- **Bot-Runner (Trazabilidad)**: Se agregó un array `events` al modelo Contact. Cada vez que el lead recibe una etiqueta (`solicito-info`, `intento-pagar`, `pago-enviado`) o cambia de estado, se pushea un evento inmutable con fecha y hora exacta. 
- **Bot-Runner (Force Start Segura)**: Se modificó la API `/bot/force-start`. Ahora el bot envía primero el mensaje (`client.sendMessage`) contenido en un bloque `try/catch`. Si el envío falla (ej. número inexiste en WA), se revierte el estado de Conversación en DB para no dejar leads huérfanos con status activo falso.
- **CRM Leads UI**: Se actualizó el componente frontal de leads para que renderice badges coloridos para los nuevos tags (`intento-pagar`, `datos-completos`, `solicito-info`) y se limpiaron contadores para mapear a la nueva lógica de 'agendados'.
- **Inline Action (Destrabar Bot)**: Se agregó la nueva API `/bot/retry-step` y un botón rápido morado (🔄) en cada fila de Leads. Sirve para forzar al bot a **reenviar el mensaje del paso actual exacto** sin tener que reiniciar la charla completa (Forzar Bot). Útil para destrabar usuarios perdidos.

### 01/04/2026 - Búsqueda Global y Simulación de Ops (CRM)
- **Backend Search**: Se agregó la funcionalidad Server-Side a las APIs `/api/contacts` y `/api/conversations`. Al recibir `?search=`, buscan mediante `$or` en teléfono, nombre, mail y alias sin aplicar el límite inicial, permitiendo encontrar usuarios fuera de los 200 en caché.
- **Frontend Search**: Se conectaron los inputs de búsqueda de Leads y Conversations con las llamadas asíncronas vía `useEffect` y con *debounce*.
- **Bot-Runner (Force Transition)**: Se creó un endpoint POST que permite saltar a cualquier opción dentro del flujo sin requerir la intervención del paciente. Dispara las etiquetas y automatizaciones (formulario de datos) de forma orgánica, simulando el click del usuario en esa opción.
- **CRM Chat UI**: En el panel de cada Conversation, se agregó un recuadro interactivo "Acciones de Bot" que parsea el esquema del paso actual y permite "Forzar" dinámicamente un salto a la opción deseada.
" F i x :   I n f i n i t e   l o o p   c a u s e d   b y   n o t   u p d a t i n g   c o n v e r s a t i o n   o b j e c t   i n   m e m o r y   b e f o r e   r e c u r s i v e   h a n d l e S t e p L o g i c   c a l l "

### 09/06/2026 - Parcheo Temporal y Análisis de OdontoBot
- **Análisis del Sistema**: Se realizó un análisis profundo de la arquitectura de la base de datos (schemas Mongoose como `Conversation`, `Contact`, `Flow`) y del ciclo de vida del procesamiento de mensajes, documentándolo en [system_analysis.md](file:///C:/Users/Try%20Hard/.gemini/antigravity/brain/4ba45882-b2f5-4bc6-833d-a242861ef478/system_analysis.md).
- **Extracción de VPS**: Se recuperaron y consolidaron las instrucciones de modificación de datos y despliegue del bot en el VPS desde los registros de la conversación histórica "WhatsApp Unread Labels".
- **Parche Whitelist de Test**: Se implementó una whitelist en [bot-runner/index.js](file:///c:/Users/Try%20Hard/Desktop/Nexte/dental-response/bot-runner/index.js) (en los controladores de llamadas, logs de mensajes y respuestas del bot) para limitar su ejecución exclusivamente al número de prueba `5491126642674`.
- **Reversión del Parche**: Tras el test exitoso del usuario, se revirtió el parche para restablecer el bot a su comportamiento normal para todos los usuarios.
- **Persistencia**: Se documentó toda la conversación y procedimientos en [chat.md](file:///c:/Users/Try%20Hard/Desktop/Nexte/dental-response/chat.md).
- **Solución de Búsqueda de Leads (Resolución de LID)**: Se implementó un mapeo de identificadores LID a números de teléfono reales en [bot-runner/index.js](file:///c:/Users/Try%20Hard/Desktop/Nexte/dental-response/bot-runner/index.js) usando `client.getContactLidAndPhone` (y fallback a `client.getContactById`), integrándolo en los listeners de `call`, `message_create` y `message`. Se programó la rutina `runLidMigration` ejecutada en la conexión del bot (`ready`) para limpiar, unificar y migrar automáticamente los 16 contactos, conversaciones y mensajes corruptos que estaban almacenados bajo formato LID en MongoDB Atlas.
- **Corrección de Script de Despliegue (Compatibilidad Compose)**: Se modificó [deploy-vps.sh](file:///c:/Users/Try%20Hard/Desktop/Nexte/dental-response/deploy-vps.sh) para detectar dinámicamente si el comando `docker-compose` (V1) o `docker compose` (V2) está disponible en el servidor host, solucionando el error `Command 'docker-compose' not found` en el VPS.

### 09/06/2026 - Corrección Definitiva de Resolución de LIDs (LidUtils)
- **Diagnóstico del Fallo**: Se determinó que `client.getContactLidAndPhone` no existe en la versión instalada de `whatsapp-web.js`, lo que provocaba que fallara de forma silenciosa y cayera al fallback `getContactById`. Sin embargo, `getContactById` no devolvía el número de teléfono real porque `contact.phoneNumber` es undefined o inaccesible directamente en el modelo de contacto inyectado de esa versión, lo que hacía que fallara la validación de longitud `<= 13` y devolviera el LID original intacto.
- **Solución Propuesta**: Modificar `resolveLidToPhone` y `runLidMigration` en [bot-runner/index.js](file:///c:/Users/Try%20Hard/Desktop/Nexte/dental-response/bot-runner/index.js) para obtener el número de teléfono real directamente desde el contexto de la página del navegador evaluando `window.Store.LidUtils.getPhoneNumber(wid)` (método interno que usa `whatsapp-web.js` para grupos). Esto es 100% compatible y robusto.