# Guía de usuario

## Recorridos disponibles

1. En **Crear cuenta**, introduce nombre, email y una contraseña de 12–128 caracteres. La sesión comienza automáticamente.
2. En **Entrar**, usa email y contraseña; la aplicación nunca muestra si una cuenta concreta existe.
3. **Explorar** permite filtrar por tipo y especie, ordenar y avanzar por páginas. Selecciona una tarjeta para abrir el detalle.
4. En **Publicar**, completa aviso, animal, fecha y opcionalmente coordenadas manuales. Puedes seleccionar hasta seis JPEG, PNG o WebP de 8 MiB cada una, revisar previews, quitarlas, moverlas o definir cuál será principal antes de guardar.
5. **Mis publicaciones** muestra también avisos finalizados o archivados.
6. Desde el detalle propio puedes **Editar**, resolver/adoptar según el tipo o archivar, con confirmación previa. También puedes añadir imágenes, eliminarlas y cambiar su orden; posición uno es la principal. En una publicación archivada solo se permite eliminar.
7. **Salir** revoca la sesión en backend y limpia el estado de usuario del frontend.

Al crear o editar puedes habilitar WhatsApp, teléfono o email para esa publicación. Ninguno se activa por defecto y el email de acceso no se copia automáticamente. Los teléfonos requieren prefijo internacional (`+34…`); se admiten espacios y guiones. **Usar el mismo número que Teléfono** hace una copia puntual a WhatsApp, tras la cual ambos valores son independientes. En publicaciones finalizadas o archivadas solo puedes retirar métodos existentes, no añadirlos ni modificarlos.

Estos datos se configuran por publicación y solo se compartirán con usuarios que hayan iniciado sesión. Desactivar un método lo elimina.

En el detalle de una publicación activa, **Ver opciones de contacto** solicita los métodos únicamente al pulsarlo. Si no tienes sesión, se abre el login y después vuelves al detalle, pero deberás pulsar de nuevo para revelar los datos. WhatsApp, teléfono y email aparecen solo cuando están configurados. **Ocultar datos de contacto** los retira de pantalla y de la caché privada del navegador.

Los listados muestran el thumbnail principal o un placeholder. El detalle permite elegir imágenes de la galería mediante botones y teclado. Si la publicación se crea pero falla el upload, se informa del éxito parcial y puedes reintentar las imágenes sin duplicar el aviso o abrir su detalle.

**Estado: aplicación en desarrollo.**

La interfaz permite identidad, publicaciones, filtros, imágenes, seleccionar ubicación al crear o editar y una vista global interactiva del mapa en Explorar. Todavía no incluye clustering, favoritos, PWA, administración ni matching visual.

La portada ofrece acceso directo a **Explorar publicaciones** y **Publicar un aviso**. Los filtros de tipo, especie, estado, orden y **Cerca de mí** están reunidos en una única barra de exploración. Todas las fichas públicas incluyen la acción textual **Ver ficha**; en **Mis publicaciones** también aparece **Editar ficha**, aplicando después las mismas restricciones de estado y propiedad ya existentes.

En crear o editar, pulsa el mapa, arrastra el marcador o abre **Introducir coordenadas manualmente**. **Usar mi ubicación** solicita permiso solo al pulsarlo; denegarlo no bloquea el formulario. **Quitar ubicación** expresa que se desea publicar sin ella. LOST/FOUND guardan el punto exacto de forma privada; ADOPTION interpreta la selección como zona y no debe usarse para introducir un domicilio.

La edición carga el contrato privado owner. Al pasar ADOPTION a LOST/FOUND hay que elegir un punto exacto nuevo o confirmar explícitamente que se continuará sin ubicación. El centro público aproximado de ADOPTION nunca se reutiliza como exacto.

En **Explorar**, **Buscar cerca de mí** solicita la ubicación solo al pulsarlo y usa inicialmente 25 km. Con la búsqueda activa se puede escoger 5, 10, 25, 50 o 100 km, mantener los filtros de tipo/especie/estado y ver resultados ordenados por cercanía. **Quitar búsqueda por cercanía** vuelve al listado normal y descarta el centro. Las distancias de las cards son aproximadas respecto de la zona pública.

El detalle público muestra, cuando existe ubicación, un círculo aproximado sin marcador ni coordenadas. LOST habla de la zona donde se reportó la pérdida, FOUND de la zona donde fue encontrado y ADOPTION de una zona de referencia.

### Mapa de publicaciones

En **Explorar**, la sección **Mapa de publicaciones** reutiliza los filtros de tipo, especie y estado. Sin estado explícito muestra activas. Presenta una mini lista accesible y marcadores con letras P/E/A para perdido, encontrado y adopción. Elegir una mini ficha resalta y centra moderadamente su marcador; elegir un marcador resalta la ficha. Solo **Ver publicación** abre el detalle.

En escritorio amplio, la mini lista y el mapa aprovechan un contenedor expandido y mantienen alturas alineadas; la lista dispone de scroll propio. En móvil se muestran apilados, primero la lista y después el mapa. Las fotografías de fichas y popups se recortan proporcionalmente dentro de dimensiones estables para evitar deformaciones o saltos de layout.

Los puntos son centros de zonas públicas aproximadas, no ubicaciones exactas. Popups y mini fichas omiten coordenadas, radio técnico, autor, contacto y descripción. La vista inicial de España es configuración de demo y no limita el dominio.

Al mover o ampliar el mapa aparece **Buscar en esta zona**. El movimiento por sí solo no consume red: los resultados cambian únicamente al pulsar el botón. Puedes mover varias veces y se aplicará el último viewport. Los filtros sí se aplican inmediatamente sobre la última zona cargada; una zona pendiente continúa pendiente hasta pulsar el botón. Si una actualización falla o alcanza el rate limit, se conservan los últimos resultados y se ofrece reintento manual. Si el servidor indica que se alcanzó el máximo, acerca el mapa, pulsa **Buscar en esta zona** o aplica filtros. La mini lista continúa disponible si fallan los tiles.

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
