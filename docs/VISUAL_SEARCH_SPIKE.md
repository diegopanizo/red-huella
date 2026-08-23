# Spike de búsqueda visual Node + ONNX

## Estado y veredicto

**Resultado: B — Node/ONNX viable con reservas.** El pipeline funciona de extremo a extremo en Windows 11, Node 24.11.1 y CPU, sin Python. La instalación, carga y salida son reproducibles, pero CLIP ViT-B/32 no demuestra por sí solo identificación fiable del mismo individuo. Antes de diseñar persistencia o producto hace falta un conjunto de evaluación representativo de animales, umbrales y falsos positivos.

Este documento describe exclusivamente el spike del Milestone 11. No existe API, persistencia, pgvector, worker ni búsqueda disponible para usuarios.

## Modelo evaluado

- Modelo fuente: `openai/clip-vit-base-patch32`.
- Exportación: `Xenova/clip-vit-base-patch32`, revisión `6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d`.
- Artefacto: `onnx/vision_model_quantized.onnx`.
- Tamaño: 89.117.001 bytes.
- SHA-256: `583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299`.
- Entrada inspeccionada: `pixel_values`, float32, `[batch, channels, height, width]`.
- Salida inspeccionada: `image_embeds`, float32, `[batch, 512]`.
- Dimensión: `VISUAL_EMBEDDING_DIMENSION = 512`.

Se eligió la variante visual cuantizada porque conserva la proyección CLIP de 512 dimensiones, reduce el artefacto de 352 MB a 89,1 MB y se ejecuta directamente con `onnxruntime-node`. El modelo no se guarda en Git ni se descarga automáticamente.

El repositorio y código original CLIP se publican bajo MIT. La exportación enlaza al modelo fuente, pero el repositorio de pesos ONNX no declara una licencia independiente visible; el uso académico de este spike es razonable, pero antes de producción debe quedar revisada y registrada expresamente la licencia aplicable a los pesos.

Fuentes:

- [ONNX cuantizado y hash](https://huggingface.co/Xenova/clip-vit-base-patch32/blob/main/onnx/vision_model_quantized.onnx)
- [configuración de preprocessing](https://huggingface.co/Xenova/clip-vit-base-patch32/blob/main/preprocessor_config.json)
- [preprocessing original CLIP](https://github.com/openai/CLIP/blob/main/clip/clip.py)
- [model card y limitaciones](https://github.com/openai/CLIP/blob/main/model-card.md)
- [licencia del repositorio CLIP](https://github.com/openai/CLIP/blob/main/LICENSE)
- [ONNX Runtime Node](https://github.com/microsoft/onnxruntime/blob/main/js/node/README.md)

## Dependencia y plataforma

- `onnxruntime-node@1.21.1` fijado como única dependencia nueva.
- `sharp@0.35.3`, ya existente.
- CPU Execution Provider y optimización de grafo `all`.
- Comprobado en Windows x64. ONNX Runtime distribuye binarios CPU para Windows y Linux x64/arm64.

Se evaluó inicialmente `1.27.0`, pero se descartó porque su dependencia runtime `adm-zip<0.6.0` producía dos avisos high en `npm audit --omit=dev`. La versión `1.21.1` carga el mismo artefacto correctamente en Node 24 y deja el audit runtime en cero. No se ejecutó un `audit fix --force` ni se alteraron otras dependencias.

Aunque el enunciado inicial citaba Node 18, el estado real del monorepo exige Node `>=24 <25`; el spike se validó con Node 24.11.1. No se afirma compatibilidad del repositorio actual con Node 18.

## Obtención y configuración

Crear `.data/models` y descargar una sola vez el artefacto desde la revisión fijada. Verificar siempre el SHA-256 anterior. `.data/models/` está ignorado por Git.

PowerShell:

```powershell
New-Item -ItemType Directory -Force .data/models
Invoke-WebRequest -Uri "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d/onnx/vision_model_quantized.onnx?download=true" -OutFile ".data/models/clip-vit-base-patch32-vision-quantized.onnx"
Get-FileHash -Algorithm SHA256 ".data/models/clip-vit-base-patch32-vision-quantized.onnx"
```

Configurar sin rutas personales:

```dotenv
VISUAL_MODEL_PATH=.data/models/clip-vit-base-patch32-vision-quantized.onnx
VISUAL_MODEL_ID=Xenova/clip-vit-base-patch32
VISUAL_MODEL_VERSION=6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d
```

`VISUAL_MODEL_ID` y `VISUAL_MODEL_VERSION` documentan la procedencia; el spike usa constantes revisadas y solo necesita `VISUAL_MODEL_PATH` para ejecutar.

## Preprocessing exacto

1. Límite de 8 MiB, 25 MP, 10.000 px por eje y una sola página.
2. Decodificación real con Sharp; solo JPEG, PNG y WebP.
3. Autorrotación según orientación.
4. Conversión sRGB de tres canales, sin alpha ni metadata en el tensor.
5. Resize bicúbico preservando aspecto hasta cubrir 224 × 224 y center crop 224 × 224. Equivale a resize del lado corto a 224 seguido de crop central.
6. Rescale por `1/255`.
7. Normalización por canal:
   - mean: `[0.48145466, 0.4578275, 0.40821073]`
   - std: `[0.26862954, 0.26130258, 0.27577711]`
8. Layout float32 NCHW `[1,3,224,224]`, longitud 150.528.

El Buffer de entrada queda acotado a 8 MiB y se materializa una sola imagen raw 224 × 224 más el tensor float32. No se conserva original ni EXIF.

## Embedding y similitud

`VisualEmbeddingGenerator.generateImageEmbedding(buffer)` devuelve exclusivamente `Float32Array(512)`. Valida nombre, shape, dimensión, longitud y valores finitos; después aplica normalización L2. No expone `ort.Tensor`.

`normalizeL2` rechaza vectores vacíos, nulos, NaN e Infinity. `cosineSimilarity` valida ambos operandos, dimensiones y normas, y limita el resultado numérico a `[-1,1]`. Aunque los embeddings generados están normalizados, el helper calcula la similitud completa para ser seguro ante otros callers.

Errores estables: `MODEL_NOT_CONFIGURED`, `MODEL_LOAD_FAILED`, `INVALID_IMAGE`, `INVALID_MODEL_OUTPUT` y `EMBEDDING_GENERATION_FAILED`. Los detalles de Sharp/ONNX quedan como causa interna y no forman un contrato HTTP.

## Sesión, concurrencia y rendimiento

La sesión se inicializa mediante una promesa lazy compartida por proceso y no se recrea por imagen. Las inicializaciones concurrentes comparten la misma promesa. ONNX Runtime documenta `Run` como thread-safe y permite llamadas concurrentes sobre una sesión ya inicializada; no se implementa cola en este spike. Antes de producción debe medirse carga concurrente real y decidir límites/worker para evitar saturar CPU y memoria.

Una comprobación local con dos `generateImageEmbedding` simultáneos sobre la misma instancia y sesión devolvió correctamente dos vectores de 512 dimensiones. Es una prueba de compatibilidad, no un benchmark de concurrencia.

Medición local CPU, proceso nuevo, tres imágenes WebP:

| Medición                  | Ejecución 1 | Ejecución 2 |
| ------------------------- | ----------: | ----------: |
| Carga modelo              |    242,3 ms |    225,5 ms |
| Inferencia A              |     31,0 ms |     23,4 ms |
| Inferencia B              |     27,4 ms |     22,5 ms |
| Inferencia C              |     25,3 ms |     23,5 ms |
| Incremento RSS aproximado |   201,9 MiB |   202,6 MiB |

Son medidas orientativas de una máquina de desarrollo, no un benchmark ni SLO.

## Smoke test visual

Ejecución:

```powershell
$env:VISUAL_MODEL_PATH = ".data/models/clip-vit-base-patch32-vision-quantized.onnx"
npm run visual:spike -- imageA.webp imageB.webp imageC.webp
```

No imprime embeddings ni bytes. Informa modelo, dimensión, carga, inferencias, similitudes y delta RSS.

Resultados:

- Duplicado exacto A/B frente a otro animal: `A/B = 1,0000`, `A/C = 0,8406`; se cumple A/B > A/C.
- Dos fotografías de gatos blancos frente a un gato atigrado: `A/B = 0,8892`, `A/C = 0,8723`; se cumple A/B > A/C con margen pequeño.

Las dos fotografías blancas no están verificadas como el mismo individuo, por lo que la segunda ejecución no evalúa identidad; además, el margen de `0,0169` es insuficiente para cualquier conclusión. CLIP captura semántica y apariencia general, no está entrenado como reidentificador de mascotas. No deben inferirse umbrales ni eficacia de matching con estas tres imágenes.

## Tests y límites del spike

Los unit tests generan imágenes en memoria y cubren tensor, finitud, orientación, corrupción, tamaño, normalización, coseno, output inválido, configuración ausente, encapsulación de errores y sesión lazy concurrente. `npm test` no necesita modelo, red ni descarga.

Los Bloques 1–5 incorporan PostgreSQL/pgvector, persistencia versionada, processor, API multipart y frontend. Python, entrenamiento, ANN y afirmaciones de identidad permanecen fuera de alcance.

El Bloque 2 posterior implementa backfill manual y lifecycle interno, manteniendo inferencia fuera del upload. No modifica las conclusiones de viabilidad ni convierte CLIP en identificador individual.

El Bloque 3 añade un processor interno opt-in y un CLI run-once. El flujo queda `upload → PENDING → processor → READY/FAILED`; el backfill permanece como mantenimiento explícito. No se añaden brokers, Python, índices ANN ni búsqueda de usuario.

El Bloque 4 expone la primera API autenticada de recuperación visual. La consulta se preprocesa con el pipeline validado, permanece efímera y se compara en PostgreSQL mediante coseno exacto. El score CLIP solo ordena candidatos visualmente similares; no identifica animales ni expresa probabilidad.

El Bloque 6 confirmó el recorrido HTTP real con ONNX: aproximadamente 305 ms cold y 31–35 ms warm, con dos búsquedas concurrentes sin crash. RSS de la API pasó de unos 87 MiB antes del modelo a 295 MiB tras las búsquedas y 301 MiB tras otro lote. Un caso idéntico obtuvo 1,000000 y la misma foto reencodeada 0,988438. El dataset es insuficiente para Recall@K o threshold; la UI visual completa en navegador sigue pendiente.

La calibración final amplió la observación a nueve casos resumidos en ADR-025: exactos `1,0`, reencodes `0,989867/0,978845`, otra foto de gato `0,799005` y un gato distinto observado manualmente `0,885872`. Tres casos `1,0` eran archivos visuales reutilizados, no animales independientes. No hubo muestra local de distinta especie. La distribución no separa identidad y confirma que CLIP recupera atributos generales —especie, pose, fondo, composición, textura y color—; se mantiene top-K sin threshold.

En desarrollo el processor permanece deshabilitado por defecto. Una imagen nueva queda PENDING hasta ejecutar `npm run visual:process-pending`, `npm run visual:backfill` cuando corresponda, o habilitar explícitamente `VISUAL_EMBEDDING_PROCESSOR_ENABLED=true`. Producción debe configurar y supervisar el processor de forma explícita.
