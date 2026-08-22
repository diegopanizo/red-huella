# Requisitos

## Convenciones

Los requisitos describen comportamiento previsto y no implican implementación. Prioridad: **MVP**, **Posterior** o **Avanzada**. Un requisito será completado solo con evidencia verificable.

## Functional Requirements

Estado tras Milestone 5: `FR-003`, `FR-004`, `FR-005` y `FR-007` están **IMPLEMENTED** en backend y cubiertos por tests. `FR-007` cubre filtros no geográficos; la cercanía corresponde a `FR-008` y continúa pendiente. No se afirma UI implementada.

| ID     | Prioridad | Requisito                                                                                                        | Criterio verificable                                                      |
| ------ | --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-001 | MVP       | Una persona podrá registrarse e iniciar/cerrar sesión.                                                           | Flujos válidos e inválidos cubiertos por tests; sesión revocable.         |
| FR-002 | MVP       | Una persona autenticada podrá consultar y editar su perfil permitido.                                            | Los cambios válidos persisten y campos no autorizados se rechazan.        |
| FR-003 | MVP       | Se podrán crear publicaciones `LOST`, `FOUND` y `ADOPTION`.                                                      | Cada tipo acepta solo datos que cumplen su schema.                        |
| FR-004 | MVP       | La autoría podrá editar, resolver, adoptar o archivar según reglas de estado.                                    | La API rechaza transiciones o actores no autorizados.                     |
| FR-005 | MVP       | Una publicación podrá describir un animal con especie, raza, sexo, color, tamaño, edad aproximada y descripción. | Campos y opcionalidad se validan consistentemente.                        |
| FR-006 | MVP       | Una publicación podrá incorporar varias imágenes seguras.                                                        | Límites, formatos y procesamiento se verifican antes de publicar.         |
| FR-007 | MVP       | Se podrán buscar y filtrar publicaciones por atributos relevantes.                                               | Resultados respetan filtros, paginación y orden documentados.             |
| FR-008 | MVP       | Se podrán consultar publicaciones cercanas en lista y mapa.                                                      | El radio utiliza ubicación autorizada y no revela precisión privada.      |
| FR-009 | MVP       | Una persona autenticada podrá añadir y quitar favoritos.                                                         | La relación es idempotente y privada para su titular.                     |
| FR-010 | MVP       | La aplicación mostrará ubicación pública aproximada separada del punto exacto interno.                           | La respuesta pública nunca incluye coordenadas exactas restringidas.      |
| FR-011 | Posterior | Las protectoras podrán disponer de información y permisos específicos.                                           | Rol y acciones quedan autorizados en servidor.                            |
| FR-012 | Posterior | Se podrán reportar publicaciones y moderarlas.                                                                   | Reportes tienen ciclo de estado y auditoría mínima.                       |
| FR-013 | Posterior | El sistema propondrá matches `LOST ↔ FOUND` por atributos, distancia y fecha.                                    | El score es reproducible, testeable y explicable.                         |
| FR-014 | Avanzada  | El sistema podrá aportar similitud visual como señal adicional.                                                  | Proveedor intercambiable; resultado etiquetado como posible coincidencia. |
| FR-015 | MVP       | Una persona podrá solicitar la eliminación de su cuenta y publicaciones según reglas legales y de integridad.    | Se ejecuta o informa claramente de retenciones justificadas.              |

## Non-Functional Requirements

| ID      | Área                | Requisito verificable                                                                                        |
| ------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| NFR-001 | Seguridad           | Controles aplicables se revisarán contra OWASP Top 10/ASVS; entradas y autorización tendrán tests negativos. |
| NFR-002 | Responsive          | Los recorridos críticos serán utilizables en anchos móviles y escritorio definidos en pruebas.               |
| NFR-003 | Accesibilidad       | La UI buscará WCAG 2.2 nivel AA; navegación por teclado, nombres accesibles y contraste se comprobarán.      |
| NFR-004 | Performance         | Antes del deployment se fijarán presupuestos medibles para carga, API e imágenes y se registrará evidencia.  |
| NFR-005 | Mantenibilidad      | Código TypeScript estricto, capas definidas, módulos enfocados y ADR para decisiones relevantes.             |
| NFR-006 | Testing             | Reglas y recorridos críticos tendrán tests unitarios, integración y E2E proporcionales al riesgo.            |
| NFR-007 | Privacidad          | Minimización, aproximación de ubicación, retirada de EXIF y retención documentada se verificarán.            |
| NFR-008 | Fiabilidad          | Errores serán explícitos; operaciones sensibles definirán atomicidad e idempotencia cuando aplique.          |
| NFR-009 | Observabilidad      | Producción contará con logs estructurados y correlación sin secretos ni datos sensibles innecesarios.        |
| NFR-010 | Compatibilidad      | Navegadores objetivo y versiones de Node se fijarán y automatizarán antes de producción.                     |
| NFR-011 | Calidad             | CI futura deberá ejecutar lint, typecheck, tests y build antes de integrar cambios.                          |
| NFR-012 | Protección de datos | Exportación, supresión y retención se concretarán antes de tratar datos reales.                              |
