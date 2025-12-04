# MinIO Upload/Delete Fix - Resumen de Soluciones

## 🔍 Problemas Identificados

### 1. Error de Firma en Subida de Archivos
**Error:** "The request signature we calculated does not match the signature you provided"

**Causa Raíz:** Las variables de entorno se cargaban DESPUÉS de que el cliente S3 de MinIO se inicializara.

**Solución Aplicada:**
- Creado `backend/loadEnv.js` para cargar variables de entorno PRIMERO
- Modificado `backend/index.js` para importar `loadEnv.js` antes que cualquier otro módulo
- Agregadas variables faltantes a `backend/.env`: `MINIO_USE_SSL` y `MINIO_REGION`
- Mejorado el manejo de metadatos y buffers en `backend/services/minioService.js`

### 2. Eliminación de Documentos
**Mejoras Implementadas:**
- Mejor manejo de errores en el endpoint DELETE `/api/documents/:id`
- Logs más detallados para diagnóstico
- Manejo graceful cuando un archivo no existe en MinIO (continúa con la eliminación de la DB)
- Mejor reporte de errores en el frontend

## 📁 Archivos Modificados

### Backend
1. **backend/loadEnv.js** (NUEVO)
   - Carga variables de entorno antes que cualquier otro módulo

2. **backend/index.js**
   - Importa `loadEnv.js` en la primera línea

3. **backend/.env**
   - Agregadas variables: `MINIO_USE_SSL=false` y `MINIO_REGION=us-east-1`

4. **backend/services/minioService.js**
   - Mejor manejo de metadatos (conversión a strings)
   - Validación del buffer
   - Logs más detallados
   - Mejor manejo de errores

5. **backend/routes/documents.js**
   - Logs detallados en el endpoint DELETE
   - Manejo graceful de errores de MinIO
   - Mejor reporte de errores

### Frontend
6. **frontend/src/pages/ProjectView.jsx**
   - Mejor captura y reporte de errores en `handleDeleteDocument`

## ✅ Pruebas Realizadas

Todas las operaciones confirmadas funcionando:
- ✅ Subida de archivos con nombres complejos (espacios, acentos, paréntesis)
- ✅ Subida del archivo problemático: "Anexo 3.4. Documentación Incluida en el Alcance (draft).pdf"
- ✅ Eliminación de archivos de MinIO
- ✅ Listado de objetos en bucket
- ✅ Descarga de archivos

## 🚀 Uso

### Para subir archivos:
- Simplemente usa la interfaz web normal
- Los archivos con caracteres especiales ahora funcionan correctamente

### Para eliminar documentos:
- Haz clic en el ícono de eliminar en un documento dentro de un proyecto
- Confirma la eliminación
- Si hay errores, ahora verás mensajes más descriptivos

## 🔧 Troubleshooting

Si aún experimentas problemas:

1. **Revisa los logs del backend:**
   ```bash
   docker logs --tail 50 dilus_backend
   ```

2. **Verifica las variables de entorno:**
   ```bash
   docker exec dilus_backend node -e "console.log(process.env.MINIO_ENDPOINT, process.env.MINIO_ACCESS_KEY)"
   ```

3. **Comprueba la conexión con MinIO:**
   ```bash
   docker exec dilus_backend curl http://minio:9000/minio/health/live
   ```

## 📊 Estado de Servicios

Para verificar que todo está funcionando:
```bash
docker ps
docker logs dilus_backend
docker logs dilus_minio
```

## 🔐 Credenciales de MinIO

- **Endpoint:** http://minio:9000
- **Access Key:** dilus_admin
- **Secret Key:** dilus_secret_2025
- **Bucket:** dilus-ai
- **Console:** http://localhost:9001

---

**Fecha de Fix:** 2025-11-12
**Versión:** DILUS_AI v2.0


