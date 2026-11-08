# Gölge · contexto para Claude

App web (PWA) para practicar idiomas con **shadowing**. Versión actual: **turco A1–C1**. Idea futura: versión en **español para Spanish Grows** (niños de 6–17 años de Hong Kong, interfaz en chino tradicional).

Responde y escribe en **español**. El dueño es profesor de ELE: cambios quirúrgicos, herramientas gratuitas o baratas, nada de complejidad innecesaria.

## Dónde está todo
- **Web publicada:** https://spanishgrows.github.io/turco-shadowing/ (GitHub Pages, rama `main`, repo **público** `spanishgrows/turco-shadowing`). Cada `git push` la publica en ~1 min.
- `index.html`: toda la app (HTML + CSS + JS en un solo archivo).
- `sw.js` + `manifest.webmanifest` + `icon-*.png`: app instalable y modo sin conexión. Si cambias archivos cacheados, sube la versión de `CACHE` en `sw.js`.
- `worker.js`: copia del servidor de IA. **El que funciona está en Cloudflare**, no aquí (ver abajo).

## Piezas y servicios (todos gratis)
| Pieza | Cómo funciona |
|---|---|
| Voz IA | **Piper** (código abierto) dentro del navegador: librería `@mintplex-labs/piper-tts-web@1.0.4` desde jsDelivr, voces turcas Fahrettin, Fettah y DFKI (masculinas) descargadas de Hugging Face (~63 MB, una vez). Alternativa: voces del sistema. |
| Puntuación | **Web Speech API** del navegador (`tr-TR`). Funciona bien en Chrome; en iPhone, mejor en Safari que como app instalada. |
| Generador de frases | Cloudflare Worker **`golge-ia`** → https://golge-ia.spanishgrows.workers.dev/ · Workers AI, modelo **`@cf/openai/gpt-oss-120b`** (por defecto) con una **segunda pasada de revisión** y un reintento. Llama 3.3 70B queda como alternativa (`model: "llama"`). Solo acepta peticiones del origen `https://spanishgrows.github.io` (y `http://localhost:8766` para pruebas). Body: `{topic, level}`. |
| Datos del usuario | `localStorage` con prefijo `golge:` (progreso, racha, temas, nivel). Copia de seguridad con código «GOLGE1:…» exportable/importable. |

**Desplegar el Worker:** no hay Node ni Wrangler en este PC. Se edita en el panel de Cloudflare (dash.cloudflare.com → Workers & Pages → golge-ia → Edit code → pegar `worker.js` → Deploy), desde Chrome con sesión del usuario. Tiene un binding de Workers AI llamado `AI`. Después, guardar la misma versión en `worker.js` del repo.

**Límites:** Workers AI gratis = 10.000 neuronas/día (se renueva a las 00:00 UTC); estimado ~40–50 generaciones/día entre todos (no medido). Sin tarjeta, así que nunca cobra: si se agota, falla hasta el día siguiente (la app muestra un error genérico; pendiente mostrar «cupo agotado»).

**Probar en local:** no hay Python ni Node. Servidor mínimo con PowerShell (`System.Net.HttpListener` en `http://localhost:8766/`, con tipos MIME para .js/.webmanifest/.png). El navegador integrado bloquea el micrófono: la puntuación real solo se prueba en Chrome del usuario.

## Funciones actuales
- Un tema a la vez con flechas ◀ ▶; los temas generados van primero.
- Nivel A1–C1 en la cabecera (afecta solo a las frases generadas; los 9 temas fijos son A2).
- Botones: Escuchar, **Shadowing en 2 pasos** (1: hablar a la vez que la voz y se graba; 2: pitido, decir la frase solo, puntuación por palabra verde/rojo), Mi voz, Manos libres.
- «Mis textos»: escribir un tema → 8 frases del nivel elegido con traducción.

## Decisiones tomadas (no cambiar sin preguntar)
- Se quitaron los botones Lento y Repetir, y la casilla de auriculares.
- Frases personales del dueño sustituidas por genéricas (Ali, Ayşe…); el repo es público.
- Voz de Google Translate y Pollinations descartados (no oficiales / exigen verificación anti-bots).

## Ideas para la versión en español (Spanish Grows), sin empezar
- **Puntuación:** Microsoft Azure Pronunciation Assessment (admite es-ES, es-MX, zh-HK, zh-TW; **no** turco). 5 h de audio gratis al mes (~3.600 evaluaciones); luego ~1–1,3 US$/hora. La clave iría en el Worker, nunca en la app.
- **Niveles:** alinear con el **PCIC** (Instituto Cervantes) y los descriptores para jóvenes del Volumen complementario del MCER; ficha por nivel con lo permitido y lo prohibido, y verificación automática + revisión humana con la rúbrica de 6 criterios.
- **Seguridad infantil:** temas cerrados para 6–12 años; para 13–17, texto libre con lista de palabras prohibidas (incluidas las variantes regionales: «coger», «concha»…) + Llama Guard en Workers AI antes y después de generar; botón «Reportar frase». Sin datos personales (COPPA, PDPO de Hong Kong); requisitos de Google Play para familias.
- **Android/cobro:** envolver la PWA con Trusted Web Activity (PWABuilder/Bubblewrap); cuenta de Google Play 25 US$; comisión 15 %; cerrar o limitar la web gratuita; verificar las licencias de las voces Piper antes de cobrar.
- **Competencia** (2026-11-08): no hay ninguna app de español con interfaz en chino tradicional, shadowing y puntuación. Ver `segundo-cerebro/OUTPUTS/2026-11-08-apps-espanol-chino-tradicional.md`.
