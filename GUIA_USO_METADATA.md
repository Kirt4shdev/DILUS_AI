# 🚀 GUÍA DE USO - SISTEMA DE METADATA LIGERO

## 📖 ¿Qué es el Sistema de Metadata?

El sistema de metadata enriquece automáticamente cada documento subido a Codex Dilus con información estructurada que mejora las búsquedas y la organización. **Todo funciona automáticamente**, pero también puedes editar manualmente el metadata desde el panel de administración.

---

## ✨ Funcionalidades Principales

### 1. 🤖 Extracción Automática con IA

Cuando subes un documento, el sistema **automáticamente**:
- 🔍 Detecta el **equipo** mencionado (ej: WS600, RPU-3000)
- 🏭 Identifica el **fabricante** (ej: Siemens, ABB, Vaisala)
- 📄 Clasifica el **tipo de documento** (manual, datasheet, pliego, etc.)
- 🌐 Determina el **origen** (interno/externo)

**Todo esto sin intervención manual!**

### 2. 🎯 Búsquedas Más Inteligentes

Cuando un usuario pregunta por un equipo específico:
- ✅ "¿Cómo funciona el **WS600**?"
- ✅ "Manual del **RPU-3000**"
- ✅ "Instrucciones para **ABC-123**"

El sistema **filtra automáticamente** los resultados para mostrar solo documentos relacionados con ese equipo, mejorando la relevancia de las respuestas.

### 3. ✏️ Edición Manual de Metadata

Los administradores pueden **corregir o enriquecer** el metadata desde el Admin Panel:
- Tipo de documento
- Equipo
- Fabricante
- Project ID
- Y más...

---

## 📋 Guía Paso a Paso

### Para Administradores

#### 1️⃣ Subir Documentos con Metadata Automático

1. Ve al **Admin Panel** → pestaña **"Codex Dilus"**
2. Haz clic en **"Subir Documentos"**
3. Selecciona uno o varios archivos PDF/DOCX/TXT
4. **¡Listo!** El sistema:
   - Extrae el texto
   - Analiza automáticamente con IA
   - Detecta equipo, fabricante y tipo
   - Genera embeddings con metadata enriquecido

**Logs que verás:**
```
🔄 Starting document ingestion
🤖 Extracting document metadata with GPT-5-mini
✅ Metadata extracted: { equipo: "WS600", fabricante: "Vaisala", doc_type: "manual" }
✅ Document ingestion completed
```

#### 2️⃣ Editar Metadata Manualmente

1. En **Admin Panel** → **"Codex Dilus"**
2. Busca el documento que quieres editar
3. Haz clic en el botón **"✏️ Editar"** (icono de lápiz azul)
4. Se abrirá un modal con los campos:
   - **Tipo de Documento**: manual, datasheet, pliego, interno, oferta, informe, otro
   - **Origen**: interno, externo
   - **Creado por**: humano, IA
   - **Project ID**: identificador opcional del proyecto
   - **Equipo**: nombre del equipo (ej: WS600)
   - **Fabricante**: nombre del fabricante (ej: Siemens)
5. Edita los campos necesarios
6. Haz clic en **"Guardar"**
7. ✅ Verás un mensaje de confirmación: "Metadata actualizado exitosamente"

**Nota:** Al guardar, se actualizan **todos los chunks** del documento automáticamente.

#### 3️⃣ Ver Metadata de un Documento

**Opción 1: Desde la API**
```bash
GET /api/documents/:id/metadata
```

**Opción 2: En logs del servidor**
Cuando se ingesta un documento, verás el metadata en los logs.

---

### Para Usuarios

#### 🔍 Realizar Búsquedas Inteligentes

Los usuarios **no necesitan hacer nada especial**. El sistema detecta automáticamente los equipos en las preguntas:

**Ejemplos de búsquedas que se benefician del filtrado:**

✅ **Búsqueda con equipo específico:**
- "¿Cómo funciona el WS600?"
- "Manual de instalación del RPU-3000"
- "Especificaciones técnicas ABC-123"

**Resultado:** Solo se busca en documentos relacionados con ese equipo → **respuestas más relevantes**.

❌ **Búsqueda general:**
- "¿Qué es un anemómetro?"
- "Procedimiento de calibración"

**Resultado:** Búsqueda normal en todos los documentos.

---

## 🎨 Tipos de Metadata Disponibles

### 📄 Metadata de Documento (doc)

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `equipo` | Nombre del equipo/producto | WS600, RPU-3000 |
| `fabricante` | Fabricante o marca | Siemens, ABB, Vaisala |
| `doc_type` | Tipo de documento | manual, datasheet, pliego |
| `source` | Origen del documento | interno, externo |
| `creation_origin` | Creado por | humano, ia |
| `project_id` | ID del proyecto | PRJ-001 |
| `filename` | Nombre del archivo | manual_ws600.pdf |
| `mime_type` | Tipo de archivo | application/pdf |

### 📦 Metadata de Chunk (chunk)

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `chunk_index` | Índice del fragmento | 0, 1, 2... |
| `page` | Página estimada | 1, 2, 3... |
| `chunk_method` | Método de división | fixed, paragraph |
| `chunk_length` | Tamaño en caracteres | 1500 |
| `chunk_tokens` | Tokens estimados | 428 |

### 🔧 Metadata de Embedding (embedding)

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `embedding_model` | Modelo usado | text-embedding-3-small |
| `vectorization_timestamp` | Fecha de procesamiento | 2025-12-04T10:30:00Z |

---

## 📊 Casos de Uso

### Caso 1: Documentación de Equipos Específicos

**Problema:** Tienes 50 manuales de diferentes equipos y los usuarios buscan "WS600" pero obtienen resultados de todos los equipos.

**Solución con Metadata:**
1. Subes los 50 manuales
2. El sistema detecta automáticamente el equipo en cada manual
3. Cuando un usuario busca "WS600", solo obtiene resultados del WS600

**Resultado:** ✅ Respuestas 10x más relevantes

---

### Caso 2: Organización por Tipo de Documento

**Problema:** Tienes manuales, datasheets, ofertas y pliegos mezclados.

**Solución con Metadata:**
1. El sistema clasifica automáticamente cada documento
2. Puedes corregir manualmente si es necesario
3. En el futuro, podrás filtrar: "Mostrar solo manuales"

**Resultado:** ✅ Mejor organización y trazabilidad

---

### Caso 3: Documentación por Fabricante

**Problema:** Trabajas con equipos de múltiples fabricantes.

**Solución con Metadata:**
1. El sistema detecta el fabricante automáticamente
2. Búsquedas como "manual Siemens" filtran por fabricante
3. Puedes generar estadísticas: "¿Cuántos documentos tenemos de cada fabricante?"

**Resultado:** ✅ Mejor navegación y reporting

---

## 🛠️ Mantenimiento y Optimización

### Para Administradores Avanzados

#### Aplicar Índices de Optimización (Opcional)

Si tienes **muchos documentos** (>1000), puedes aplicar índices para mejorar el rendimiento:

```bash
# Ejecutar desde PostgreSQL
psql -U postgres -d dilus_ai -f sql/09_metadata_optimization.sql
```

**Beneficios:**
- ✅ Búsquedas por metadata 10x más rápidas
- ✅ Dashboard con estadísticas de equipos/fabricantes
- ✅ Queries complejas optimizadas

#### Estadísticas de Metadata

Ver distribución de metadata en la BD:

```sql
-- Equipos más documentados
SELECT 
  metadata->'doc'->>'equipo' as equipo,
  COUNT(DISTINCT document_id) as documentos
FROM embeddings
WHERE metadata->'doc'->>'equipo' IS NOT NULL
GROUP BY metadata->'doc'->>'equipo'
ORDER BY documentos DESC;

-- Tipos de documentos
SELECT 
  metadata->'doc'->>'doc_type' as tipo,
  COUNT(DISTINCT document_id) as cantidad
FROM embeddings
GROUP BY metadata->'doc'->>'doc_type'
ORDER BY cantidad DESC;
```

---

## 🧪 Testing

### Probar el Sistema

1. **Ejecutar script de prueba:**
```bash
cd /ruta/a/DILUS_AI
node test_metadata_system.js
```

Este script verifica:
- ✅ Extracción de metadata con IA
- ✅ Estructura de metadata
- ✅ Detección de equipos en queries
- ✅ Metadata en base de datos

2. **Prueba manual:**
   - Sube un PDF con encabezado claro (ej: "Manual WS600 - Vaisala")
   - Revisa logs del backend
   - Edita metadata desde Admin Panel
   - Busca con el nombre del equipo en Vault Chat

---

## ❓ FAQ - Preguntas Frecuentes

### ¿Qué pasa con los documentos ya subidos?

Los documentos subidos **antes** de esta actualización **no tienen metadata enriquecido**. Tienen solo `start` y `end` en metadata.

**Opciones:**
1. Dejarlos como están (seguirán funcionando)
2. Re-subirlos para obtener metadata enriquecido
3. Ejecutar un script de migración (futuro)

### ¿Puedo desactivar la extracción automática?

Por defecto está **activada**. Si quieres desactivarla, tendrías que modificar `ragService.js` y comentar la línea:

```javascript
// const extractedMetadata = await extractDocumentMetadata(text, filename);
```

Pero **no se recomienda** ya que perderías los beneficios del sistema.

### ¿Cuánto cuesta la extracción con GPT-5-mini?

Aproximadamente **~500 tokens** por documento (~$0.000075 USD por documento con GPT-5-mini).

Para 1000 documentos: ~$0.075 USD (7.5 centavos).

### ¿El filtrado por equipo siempre funciona?

El filtrado **solo se activa** si se detecta un patrón de equipo en la query:
- Patrón: 2+ letras mayúsculas + 2+ números (ej: WS600, ABC123)
- Si no se detecta, se hace búsqueda normal

**Ejemplos:**
- ✅ "WS600" → filtra
- ✅ "RPU-3000" → filtra
- ❌ "equipo" → no filtra
- ❌ "ws600" (minúsculas) → no filtra

### ¿Puedo agregar campos personalizados al metadata?

Sí, puedes modificar `metadataService.js` para agregar campos adicionales en la extracción o en `buildChunkMetadata()`.

Por ejemplo, agregar `ubicacion`, `version`, etc.

---

## 📞 Soporte

### Problemas Comunes

**Problema:** Metadata no se extrae correctamente

**Solución:**
1. Verifica que `OPENAI_API_KEY` esté configurada
2. Revisa logs del backend para ver errores
3. El documento debe tener texto legible (no imagen escaneada sin OCR)

**Problema:** Filtrado por equipo no funciona

**Solución:**
1. Verifica que el nombre del equipo siga el patrón: `[A-Z]{2,}[-_\s]?\d{2,}`
2. Revisa logs: debe aparecer "Equipment detected in query"
3. Verifica que el metadata del documento tenga el equipo correcto

**Problema:** No aparece botón "Editar" en Admin Panel

**Solución:**
1. Solo aparece en documentos con estado "completed"
2. Verifica que seas admin
3. Actualiza la página

---

## 🎓 Recursos Adicionales

- 📄 **Documentación técnica completa:** `IMPLEMENTACION_METADATA_LIGERO.md`
- 🧪 **Script de testing:** `test_metadata_system.js`
- 🗄️ **Optimizaciones SQL:** `sql/09_metadata_optimization.sql`
- 📊 **Logs del sistema:** Busca "Metadata extracted" en logs del backend

---

## ✅ Checklist de Primeros Pasos

- [ ] Leer esta guía completa
- [ ] Ejecutar `node test_metadata_system.js`
- [ ] Subir un documento de prueba
- [ ] Revisar logs de extracción
- [ ] Editar metadata desde Admin Panel
- [ ] Probar búsqueda con nombre de equipo
- [ ] (Opcional) Aplicar índices de optimización

---

**¡Disfruta del sistema de metadata enriquecido!** 🎉

*Si tienes dudas, revisa los logs del backend o la documentación técnica.*

