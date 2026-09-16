# Changelog

### 16/09/2026 - Blindaje de Pausa Estricta y Preservación de No Leídos
- **Bot-Runner (Invariante de Pausa Estricta - D-08)**: Eliminado el auto-unpause arbitrario (`ALLOW ESCAPE FROM PAUSE`) por saludos, números o inactividad prolongada (>12h). Ningún mensaje de texto, audio, imagen o documento puede reactivar un chat pausado.
- **Bot-Runner (Protección de Globos 'No Leído' - D-09)**: Eliminado `window.Store.Cmd.openChatAt(c)` y typing prematuro que disparaba `sendSeen` en WhatsApp Web. Implementado `chat.markUnread()` activo ante mensajes en chats pausados.
- **Bot-Runner (Canales Silenciados)**: Filtro para ignorar transmisiones de canales de WhatsApp (`@newsletter`).
- **Bot-Runner (Derivación de Proveedores)**: Desconexión y pausa inmediata en el paso `profesional_postulante_msg`.
- **Database & Modelos**: Agregados `hasUnread`, `unreadCount`, `lastMessageText`, `lastMessageAt` a `Conversation` y `Contact`.
- **CRM Admin UI**: Añadida métrica "📩 No Leídos", filtro rápido, nombres de contacto en lista, previsualización de último mensaje y botón interactivo para marcar como leído/no leído.

### 25/03/2026 - Fix Navegación y Captura de Datos
- **Bot-Runner (Reset Global)**: Los comandos de navegación universal (M, V) ahora fuerzan el reseteo de estados de formulario (`formState`) y texto libre (`freeTextState`). Esto evita que el bot quede "trabado" en un modo si el usuario decide volver al inicio.
- **Bot-Runner (Recursive Capture)**: Se habilitó el disparo inmediato del formulario de captura cuando se transiciona a un paso que requiere datos mediante una opción del menú (arregla el bug de "A" tras "M").
- **Bot-Runner (Emergency ACK)**: Se resetea el flag de `handoffAckSent` al navegar, permitiendo que el usuario reciba confirmaciones de derivación si vuelve a entrar en un flujo de asesor.

### 24/03/2026 - Trazabilidad y Refactor Agendados
- **Bot-Runner (Contact Status)**: Refactor de lógica de agendados según agenda física de WA.
- **Bot-Runner (Traceability)**: Implementación de array `events` para auditoría de cambios en leads.
- **Bot-Runner (Force Bot Segura)**: Manejo de errores en `/bot/force-start` para evitar estados huérfanos.
- **CRM Leads UI**: Soporte visual para tags `intento-pagar`, `solicito-info` y `datos-completos`.
- **Inline Action (Destrabar Bot)**: Nuevo botón morado 🔄 para reintentar el paso actual sin reiniciar todo el flujo.
