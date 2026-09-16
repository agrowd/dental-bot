# Decisions

| ID | Decisión Técnica | La Razón (The Why) | Estado |
|:---|:---|:---|:---|
| D-07 | **Invariante `messagesInCurrentStep: 1` tras envíos directos de navegación (M/V/Hola)** | Si un comando de navegación envía directamente el mensaje del menú, `messagesInCurrentStep` debe guardarse como 1 para que el siguiente mensaje del usuario sea evaluado de inmediato como opción y no dispare un re-envío del menú. | 🔒 LOCKED |
| D-08 | **Invariante de Pausa Estricta (Inviolabilidad de Pausa)** | El estado `paused` es absoluto e inviolable: el bot NUNCA debe reanudarse automáticamente por saludos ('hola', 'buen dia'), opciones, números o tiempo transcurrido (>12h). Solo un operador humano desde el CRM puede reanudar la automatización. | 🔒 LOCKED |
| D-09 | **Preservación de Globos 'No Leído' en WhatsApp y CRM** | Al recibir mensajes en un chat pausado o derivado a humano, el bot NUNCA debe enfocar o abrir el chat en Puppeteer (`window.Store.Cmd.openChatAt`), para evitar emitir `sendSeen` y borrar los globos verdes del celular de Salvador. Debe marcar activamente `chat.markUnread()` en WhatsApp Web y reflejar `hasUnread: true` con `unreadCount` en el CRM. | 🔒 LOCKED |
