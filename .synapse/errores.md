# Errores

## ERR-04: Lead Form Desync (24/03/2026)
**Síntoma:** El bot dejaba de responder tras completar el formulario de captura.
**Root Cause:** Desbloqueo de estado en memoria vs base de datos durante la recursión de `handleStepLogic`.
**Solución:** Se agregó un `findById()` forzado para refrescar el objeto `conversation` antes de la llamada recursiva tras completar el formulario.
**Commit:** `77f6b7b`
**Estado:** ✅ FIXED

## ERR-05: Bot Stalling on Navigation ESC (25/03/2026)
**Síntoma:** Tras un bloqueo por reintentos fallidos, el comando 'M' mostraba el menú pero la siguiente opción (ej. 'A') no respondía.
**Root Cause:** "Sticky formState". El comando 'M' reiniciaba el step pero no limpiaba el flag `formState.active`. Al mandar 'A', el bot intentaba procesarla como un "Nombre" en lugar de una opción del menú. Además, las transiciones recursivas no disparaban el formulario de captura.
**Solución:** Los comandos universales (M/V) ahora limpian `formState.active`, `freeTextState.active` y `handoffAckSent`. Se agregó lógica para disparar el formulario de captura inmediatamente durante transiciones de opciones.
**Commit:** `pending`
**Estado:** ✅ FIXED

## ERR-06: Menú Repetido al Seleccionar Opción tras Navegación (10/08/2026)
**Síntoma:** Al escribir 'hola' o 'M' y luego elegir una opción ('A', 'B', 'C'), el bot repetía el menú de bienvenida en lugar de avanzar al paso correspondiente.
**Root Cause:** Los manejadores de `isMenuOrGreeting` y `Universal Back` enviaban el mensaje de navegación pero dejaban `messagesInCurrentStep: 0`. Al recibir el siguiente mensaje del usuario, la máquina de estados interpretaba que aún no había mostrado el paso y lo reenviaba consumiendo el input sin evaluar opciones.
**Solución:** Se estableció `messagesInCurrentStep: 1` al enviar los mensajes en `isMenuOrGreeting` y `Universal Back`.
**Estado:** ✅ FIXED

## ERR-07: Auto-unpause Arbitrario y Ruptura de Pausa por Media (16/09/2026)
**Síntoma:** Un contacto en pausa por derivación humana (Jorge Ferrer con urgencia médica familiar) escribió "Buen día..." y el bot lo despausó automáticamente y le respondió tres veces "No comprendí tu mensaje", silenciando la urgencia operativa.
**Root Cause:** En `bot-runner/index.js` existía un bloque `ALLOW ESCAPE FROM PAUSE` que despausaba conversaciones si el mensaje contenía saludos ("hola", "buen dia"), dígitos, o si habían pasado >12h (`isStalePause`). Además, el chequeo de pausa tenía una cláusula `!msg.hasMedia`, lo que permitía que mensajes de voz o archivos eludieran la pausa y dispararan respuestas automatizadas.
**Solución:** Se eliminó por completo el bloque de auto-unpause `ALLOW ESCAPE FROM PAUSE`. Se blindó la compuerta de pausa para abarcar TODOS los mensajes (texto, audios, documentos, imágenes). Ahora cualquier chat pausado permanece inmutablemente pausado, marca `chat.markUnread()` en WhatsApp Web, sincroniza la etiqueta `Derivado con Personal` y notifica al CRM con `hasUnread: true`, incrementando `unreadCount`.
**Estado:** ✅ FIXED

## ERR-08: Pérdida de Globos Verdes "No Leído" en el Móvil por openChatAt (16/09/2026)
**Síntoma:** Cuando un contacto derivado o en pausa escribía por WhatsApp, en el celular de Salvador el mensaje no quedaba destacado ni con globo verde de "no leído", perdiendo visibilidad operativa.
**Root Cause:** La función `sendTyping` ejecutaba `window.Store.Cmd.openChatAt(c)` y se ejecutaba prematuramente antes de verificar si el chat estaba pausado. Abrir el chat en Puppeteer enfoca la ventana y WhatsApp Web emite internamente un `sendSeen` (marca como leído), borrando el contador de no leídos en todos los dispositivos vinculados.
**Solución:** Se retiró `window.Store.Cmd.openChatAt(c)` de `sendTyping` y se eliminó el disparo de typing prematuro antes del gate de pausa. Si el chat está pausado, el bot ejecuta activamente `chat.markUnread()` en WhatsApp Web y actualiza el contador `hasUnread: true` en la base de datos de MongoDB.
**Estado:** ✅ FIXED

