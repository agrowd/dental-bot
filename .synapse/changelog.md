# Changelog

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
