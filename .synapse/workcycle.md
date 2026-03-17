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
