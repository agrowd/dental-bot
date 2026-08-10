# Decisions

| ID | Decisión Técnica | La Razón (The Why) | Estado |
|:---|:---|:---|:---|
| D-07 | **Invariante `messagesInCurrentStep: 1` tras envíos directos de navegación (M/V/Hola)** | Si un comando de navegación envía directamente el mensaje del menú, `messagesInCurrentStep` debe guardarse como 1 para que el siguiente mensaje del usuario sea evaluado de inmediato como opción y no dispare un re-envío del menú. | 🔒 LOCKED |
