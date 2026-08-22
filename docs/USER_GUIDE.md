# Guía de usuario

## Recorridos disponibles

1. En **Crear cuenta**, introduce nombre, email y una contraseña de 12–128 caracteres. La sesión comienza automáticamente.
2. En **Entrar**, usa email y contraseña; la aplicación nunca muestra si una cuenta concreta existe.
3. **Explorar** permite filtrar por tipo y especie, ordenar y avanzar por páginas. Selecciona una tarjeta para abrir el detalle.
4. En **Publicar**, completa aviso, animal, fecha y opcionalmente coordenadas manuales. Puedes seleccionar hasta seis JPEG, PNG o WebP de 8 MiB cada una, revisar previews, quitarlas, moverlas o definir cuál será principal antes de guardar.
5. **Mis publicaciones** muestra también avisos finalizados o archivados.
6. Desde el detalle propio puedes **Editar**, resolver/adoptar según el tipo o archivar, con confirmación previa. También puedes añadir imágenes, eliminarlas y cambiar su orden; posición uno es la principal. En una publicación archivada solo se permite eliminar.
7. **Salir** revoca la sesión en backend y limpia el estado de usuario del frontend.

Los listados muestran el thumbnail principal o un placeholder. El detalle permite elegir imágenes de la galería mediante botones y teclado. Si la publicación se crea pero falla el upload, se informa del éxito parcial y puedes reintentar las imágenes sin duplicar el aviso o abrir su detalle.

**Estado: aplicación en desarrollo.**

La interfaz permite identidad, publicaciones, filtros e imágenes. Todavía no incluye mapas, favoritos, PWA, administración ni matching visual.

## Imágenes y privacidad

La validación de tipo y tamaño en el navegador es una ayuda inmediata; el servidor vuelve a verificar y normalizar cada archivo. Las previews locales se eliminan al quitar una selección, completar el upload o abandonar la pantalla. No se conservan originales ni se muestran claves internas de almacenamiento. Evita subir imágenes sin derecho de uso o con información sensible visible en los propios píxeles.

## Funciones previstas

La guía se completará conforme se implementen y verifiquen:

- registro, acceso y perfil;
- publicación de animales perdidos, encontrados y en adopción;
- búsqueda, filtros y mapa con ubicación pública aproximada;
- favoritos;
- resolución, adopción o archivo de publicaciones;
- reportes y posibles coincidencias en fases posteriores.

## Seguridad y privacidad

Antes de introducir datos reales, la interfaz deberá explicar qué información será pública, cómo se aproxima una ubicación y cómo se retiran imágenes y publicaciones. Hasta que estos controles existan, no debe usarse la aplicación con datos personales reales.
