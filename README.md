# Compras Monti Web

Migración web/PWA de la app Android Monti Pedidos.

## Objetivo

Conservar la lógica operativa validada de Monti y llevarla a una interfaz web responsive que funcione en celular y PC, sin necesidad de instalar un APK en cada actualización.

## Alcance inicial

- Importación manual del Excel exportado desde Fudo.
- Persistencia local del último Excel procesado, stock y configuración.
- Stock con unidad de carga explícita.
- Pedidos separados para La Artesanal, Centro de Producción (CDP), Breaders y Packaging.
- Reglas especiales del día 29.
- Cálculo de milanesas por modificadores reales de Fudo.
- Packaging separado de CDP.
- Modo auditoría para explicar cada cálculo.
- Copiar pedidos a WhatsApp.
- Preparado para una futura integración autorizada directa con Fudo si se consigue API/acceso oficial.

## Base funcional

La migración toma como referencia la lógica de Monti Pedidos V0.39. La implementación web se irá contrastando contra los mismos Excel y stocks usados para validar Android antes de reemplazarla operativamente.

## Stack

- React
- TypeScript
- Vite
- PWA / responsive mobile-first

## Estado

Inicio de migración web.
