# Guía de usuario

## Recorridos disponibles

1. En **Crear cuenta**, introduce nombre, email y una contraseña de 12–128 caracteres. La sesión comienza automáticamente.
2. En **Entrar**, usa email y contraseña; la aplicación nunca muestra si una cuenta concreta existe.
3. **Explorar** permite filtrar por tipo y especie, ordenar y avanzar por páginas. Selecciona una tarjeta para abrir el detalle.
4. En **Publicar**, completa aviso, animal, fecha y opcionalmente coordenadas manuales. No existe mapa ni upload todavía.
5. **Mis publicaciones** muestra también avisos finalizados o archivados.
6. Desde el detalle propio puedes **Editar**, resolver/adoptar según el tipo o archivar, con confirmación previa.
7. **Salir** revoca la sesión en backend y limpia el estado de usuario del frontend.

Los avisos sin URL de imagen muestran un placeholder. La ubicación actual es provisional y no debe interpretarse como anonimizada.

**Estado: aplicación en desarrollo.**

La interfaz actual es la plantilla técnica inicial de React/Vite. Todavía no permite crear cuentas, publicar animales, buscar, usar mapas, subir imágenes ni guardar favoritos.

## Funciones disponibles

No hay funciones de negocio disponibles en este milestone.

## Funciones previstas

La guía se completará conforme se implementen y verifiquen:

- registro, acceso y perfil;
- publicación de animales perdidos, encontrados y en adopción;
- búsqueda, filtros y mapa con ubicación pública aproximada;
- gestión de imágenes y favoritos;
- resolución, adopción o archivo de publicaciones;
- reportes y posibles coincidencias en fases posteriores.

## Seguridad y privacidad

Antes de introducir datos reales, la interfaz deberá explicar qué información será pública, cómo se aproxima una ubicación y cómo se retiran imágenes y publicaciones. Hasta que estos controles existan, no debe usarse la aplicación con datos personales reales.
