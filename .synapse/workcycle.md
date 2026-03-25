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
