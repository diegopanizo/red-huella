# ADR-025 — Búsqueda por similitud visual

## Estado

Aceptada e implementada parcialmente. Milestone 11, Bloques 1–5: persistencia, pipeline, procesamiento asíncrono, API exacta y experiencia frontend; evaluación de calidad y escalado permanecen pendientes.

## Contexto

El spike Node + ONNX confirmó que CLIP ViT-B/32 puede producir embeddings normalizados de 512 dimensiones sin Python. Deben persistirse sin incorporarlos a aggregates públicos, mezclar espacios incompatibles ni confundir similitud con identificación individual.

## Decisión

- Un embedding por `publication_image`, `model_id` y `model_version`.
- Modelo `Xenova/clip-vit-base-patch32`, revisión `6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d`.
- pgvector `vector(512)`, normalización L2 y futura distancia coseno mediante `<=>`.
- Búsqueda exacta inicial, sin HNSW/IVFFlat hasta medir volumen, latencia, Recall@K y MRR.
- Node y `onnxruntime-node`; Python queda como fallback futuro si las mediciones lo justifican.
- Embeddings derivados internos: nunca en DTOs, aggregates públicos, logs o errores HTTP.
- Una futura imagen temporal de búsqueda no se persistirá.
- Lifecycle `PENDING`, `READY`, `FAILED`; solo `READY` conserva vector y fecha. Los fallos guardan únicamente un código allowlisted.
- SHA-256 del contenido normalizado para invalidación y control de carreras. READY/FAILED requieren el checksum esperado.
- Los uploads crean PENDING sin ejecutar inferencia. Un procesador interno opcional realiza polling y reutiliza el mismo pipeline que el backfill; no existe todavía búsqueda pública.

## Consecuencias

## Backfill y lifecycle de generación

El checksum es SHA-256 de los píxeles RGB canónicos 224×224 producidos por el mismo autorotate, sRGB, resize y center crop del preprocessing CLIP. Por ello, metadata/EXIF no cambia la identidad visual, pero los píxeles sí. El caso de uso lee `display.webp` mediante `ImageStorage`, acota el stream a 8 MiB, asegura PENDING y genera READY condicionando por checksum.

El backfill es manual, secuencial, paginado por UUID y reanudable desde estado DB. Omite ARCHIVED y READY, y FAILED requiere `--retry-failed`. `MODEL_NOT_CONFIGURED`/`MODEL_LOAD_FAILED` abortan el run sin convertir el lote en FAILED. Nuevos uploads crean PENDING en la misma transacción de metadata, pero nunca ejecutan ONNX en la request.

El Bloque 3 incorpora `VisualEmbeddingProcessor`, independiente de Express y con `start`, `stop` y `runOnce`. Usa `setTimeout` solo después de terminar cada lote, concurrencia uno, lote acotado y carga lazy de la sesión. Se habilita explícitamente; sin modelo no arranca. Un fallo global de carga lo deshabilita durante la vida del proceso y se registra una sola vez, mientras que un fallo de imagen conserva el lifecycle FAILED y no detiene los siguientes elementos.

Processor y backfill adquieren un advisory lock PostgreSQL por imagen y mantienen la misma conexión hasta concluir el caso de uso. Esto evita cálculo duplicado entre consumidores cooperantes sin introducir PROCESSING ni migración. No constituye una cola durable ni recupera procesos externos que ignoren el protocolo; PENDING sigue siendo la fuente durable y el checksum condicionado conserva la protección STALE.

El Bloque 4 incorpora una búsqueda autenticada mediante una imagen temporal en memoria. Reutiliza exactamente el preprocessing y la sesión CLIP, no persiste la consulta y ejecuta distancia coseno exacta en pgvector. Se conserva una sola fila por publicación usando su imagen de menor distancia. Sin `targetType`, el universo es LOST+FOUND; ADOPTION solo entra mediante filtro explícito. No se aplica umbral ni se interpreta el score como identidad o probabilidad.

El Bloque 5 incorpora `/search-by-image`: usa una sola foto efímera, omite `targetType` para LOST+FOUND y envía `limit=20`. Presenta primero `matchedImage`, no muestra `visualSimilarity` como porcentaje ni probabilidad y explica que el orden solo representa similitud visual. Las object URLs se revocan y las solicitudes anteriores se abortan e invalidan.

La primera versión es global: el filtro geográfico se pospone para evitar ampliar este bloque. Cuando se incorpore solo podrá utilizar `public_location`. El exact scan es deliberado para el volumen actual; HNSW/IVFFlat requieren medición posterior.

La validación de cierre mantiene top-K sin threshold. Una imagen normalizada idéntica obtuvo 1,000000 y la misma foto después de otro ciclo de normalización/reencode 0,988438, pero no existe dataset legítimo suficiente para separar misma mascota, parecida y diferente ni calcular Recall@K. Estos valores no son umbrales ni evidencia de identidad.

La calibración final controlada produjo estas observaciones. `Pos.` es la posición de la única publicación candidata elegible y no constituye Recall de identidad:

| Caso | Categoría                                  | Especie | Score    | Pos. | Observación                                              |
| ---- | ------------------------------------------ | ------- | -------- | ---- | -------------------------------------------------------- |
| A1   | Misma imagen                               | Gato    | 1,000000 | 1    | Control exacto                                           |
| A2   | Misma imagen                               | Gato    | 1,000000 | 1    | Segundo control exacto                                   |
| A3   | Duplicado local entre publicaciones        | Gato    | 1,000000 | 1    | Fuente reutilizada; no es una muestra independiente      |
| A4   | Duplicado local entre publicaciones        | Gato    | 1,000000 | 1    | Fuente reutilizada; no es una muestra independiente      |
| A5   | Duplicado local entre publicaciones        | Gato    | 1,000000 | 1    | Fuente reutilizada; no es una muestra independiente      |
| B1   | Misma foto reencodeada                     | Gato    | 0,989867 | 1    | WebP regenerado con calidad distinta                     |
| B2   | Misma foto reencodeada                     | Gato    | 0,978845 | 1    | Segundo WebP regenerado                                  |
| D1   | Otra foto de gato, identidad no verificada | Gato    | 0,799005 | 1    | No permite concluir si es la misma mascota               |
| E1   | Gato atigrado distinto, observación manual | Gato    | 0,885872 | 1    | Más alto que D1 pese a ser un animal claramente distinto |

No había una fuente local legítima de distinta especie disponible. La inversión D1/E1 descarta una separación monotónica simple: usar 0,90, o cualquier otro valor derivado de estas muestras, introduciría riesgo de falsos negativos. CLIP agrupa especie, pose, fondo, composición, textura y color; no está diseñado para reidentificación individual.

Visual Search queda definido como **candidate retrieval**. No es pet re-identification, biometría, confirmación de identidad ni matching garantizado. La UI usa «Similitud visual», conserva «Foto visualmente similar» y no muestra el score.

HNSW sólo se considerará si el volumen real de embeddings, la latencia observada y `EXPLAIN ANALYZE` demuestran que el scan exacto incumple necesidades concretas. La decisión deberá medir también Recall@K/MRR frente al exact scan; no se fija un número arbitrario. Con cinco embeddings, el plan observado contiene sequential scan y ejecutó en aproximadamente 0,8 ms, por lo que ANN no está justificado.

`0005_graceful_tomas.sql` crea pgvector y la tabla. La FK cascade elimina derivados al borrar la imagen y varias versiones pueden coexistir sin mezclar espacios. CLIP recupera candidatos por apariencia/semántica; no acredita identidad. Antes de producto deben evaluarse dataset, métricas, falsos positivos, capacidad y licencia de pesos.
