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

