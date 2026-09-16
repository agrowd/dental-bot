# QA & Testing Tracker

## Casos de Prueba - Suite Pausa y Notificaciones (16/09/2026)

| ID | Caso de Prueba | Entrada / Acción | Comportamiento Esperado | Resultado |
|:---|:---|:---|:---|:---|
| TC-01 | **Inviolabilidad de Pausa ante Saludos** | Contacto en `state: 'paused'` envía "Hola buen día" | El bot NO responde, NO avanza de step, mantiene `state: 'paused'`. | ✅ PASSED |
| TC-02 | **Inviolabilidad de Pausa ante Opciones** | Contacto en `state: 'paused'` envía "1" o "A" | El bot ignora la opción como comando, permanece en pausa silenciosa. | ✅ PASSED |
| TC-03 | **Inviolabilidad de Pausa ante Audios/Media** | Contacto en `state: 'paused'` envía audio PTT o documento | El bot almacena el mensaje sin romper la pausa ni enviar fallback "No comprendí". | ✅ PASSED |
| TC-04 | **Retención de 'No Leído' en WhatsApp Web** | Mensaje entrante a conversación pausada | No se ejecuta `openChatAt()`. Se invoca `chat.markUnread()`. En el móvil se conserva el globo verde. | ✅ PASSED |
| TC-05 | **Actualización de `hasUnread` en CRM** | Mensaje entrante a conversación pausada | `Conversation` y `Contact` se actualizan con `hasUnread: true`, `unreadCount: +1`, `lastMessageText`. | ✅ PASSED |
| TC-06 | **Filtro y Destacado en UI de Conversaciones** | Ingreso al módulo `/admin/conversations` | Se visualiza card "📩 No Leídos", filtro rápido, nombres de contacto y filas destacadas en amarillo suave. | ✅ PASSED |
| TC-07 | **Desconexión en Paso de Proveedores** | Flujo llega a `profesional_postulante_msg` | Se pausa automáticamente (`state: 'paused'`), se aplica etiqueta de derivación y queda a la espera de humano. | ✅ PASSED |
| TC-08 | **Compilación de Producción Next.js** | `npm run build` | Compilación de 26 rutas estáticas y dinámicas sin errores TypeScript. | ✅ PASSED |
