# 🤖 Sistema de Gestión de Prompts - DILUS AI

**Fecha de implementación:** 4 de diciembre de 2025

---

## 📋 Resumen

Se ha implementado un sistema completo de gestión de prompts configurables que permite a los administradores editar y personalizar todos los prompts utilizados por el sistema de IA desde el panel de administración, sin necesidad de modificar código.

---

## ✨ Características Implementadas

### 1. **Base de Datos**
- ✅ Tabla `prompts` para almacenar todos los prompts del sistema
- ✅ Tabla `prompt_history` para mantener historial de cambios
- ✅ Soporte para prompts únicos (1 consulta) y paralelos (10 consultas)
- ✅ Sistema de categorías: `pliego_tecnico`, `contrato`, `oferta`, `documentacion`, `vault`
- ✅ Variables dinámicas en formato `{variable}` para cada prompt
- ✅ Soft delete (campo `is_active` para activar/desactivar prompts)

### 2. **Backend - Servicio de Prompts**

Archivo: `backend/services/promptService.js`

**Funciones principales:**
- `getAllPrompts()` - Obtener todos los prompts (con caché de 5 minutos)
- `getPromptsByCategory(category)` - Filtrar por categoría
- `getSinglePromptForCategory(category)` - Obtener prompt único para análisis de 1 consulta
- `getParallelPromptsForCategory(category)` - Obtener prompts paralelos (10 consultas)
- `updatePrompt(promptId, updates, userId)` - Actualizar un prompt con historial
- `createPrompt(promptData, userId)` - Crear nuevos prompts
- `deletePrompt(promptId, userId)` - Desactivar prompts
- `restorePrompt(promptId, userId)` - Reactivar prompts
- `getPromptHistory(promptId, limit)` - Ver historial de cambios
- `fillPrompt(promptText, replacements)` - Reemplazar variables en prompts
- `getPromptCategories()` - Obtener categorías con estadísticas

### 3. **Backend - Rutas API**

Archivo: `backend/routes/admin.js`

**Endpoints creados:**
- `GET /api/admin/prompts` - Listar prompts (con filtro por categoría)
- `GET /api/admin/prompts/categories` - Listar categorías disponibles
- `GET /api/admin/prompts/:id` - Obtener un prompt específico
- `GET /api/admin/prompts/:id/history` - Ver historial de cambios
- `POST /api/admin/prompts` - Crear nuevo prompt
- `PUT /api/admin/prompts/:id` - Actualizar prompt
- `DELETE /api/admin/prompts/:id` - Desactivar prompt
- `POST /api/admin/prompts/:id/restore` - Reactivar prompt

### 4. **Integración con Servicios Existentes**

Se actualizaron los siguientes archivos para usar los prompts de BD:

**`backend/services/parallelAnalysisService.js`**
- ✅ Ahora obtiene prompts paralelos desde BD con `getParallelPromptsForCategory()`
- ✅ Función `executeParallelAnalysis()` actualizada
- ✅ Función `executeParallelAnalysisSimple()` actualizada

**`backend/routes/analysis.js`**
- ✅ Análisis de Pliego Técnico usa `getSinglePromptForCategory('pliego_tecnico')`
- ✅ Análisis de Contrato usa `getSinglePromptForCategory('contrato')`
- ✅ Generación de Oferta usa `getSinglePromptForCategory('oferta')`
- ✅ Generación de Documentación usa `getSinglePromptForCategory('documentacion')`
- ✅ Todos los análisis paralelos usan prompts de BD automáticamente

### 5. **Frontend - Componente de Gestión**

Archivo: `frontend/src/components/PromptsManager.jsx`

**Características:**
- ✅ Selector visual de categorías con iconos y estadísticas
- ✅ Vista de lista de prompts por categoría
- ✅ Diferenciación visual entre prompts únicos y paralelos
- ✅ Indicadores de estado activo/inactivo
- ✅ Editor modal con textarea grande para modificar prompts
- ✅ Visualización de variables disponibles para cada prompt
- ✅ Sistema de historial de cambios con comparación antes/después
- ✅ Advertencias al editar para evitar errores
- ✅ Vista colapsable del texto completo del prompt
- ✅ Contador de caracteres en el editor

### 6. **Frontend - Panel de Administración**

Archivo: `frontend/src/pages/AdminPanel.jsx`

**Cambios:**
- ✅ Nuevo tab "Prompts IA" con icono de mensaje
- ✅ Integración completa del componente `PromptsManager`
- ✅ Ubicado estratégicamente después de "Usuarios" en la barra de tabs

---

## 📊 Prompts Iniciales Cargados

### Pliego Técnico
- ✅ 1 prompt único (análisis completo en 1 consulta)
- ✅ 10 prompts paralelos:
  1. Estaciones de Monitoreo
  2. Sensores
  3. Especificaciones Técnicas
  4. Distancias
  5. Plazos de Instalación
  6. Normativas
  7. Conectividad
  8. Alimentación Eléctrica
  9. Garantía y Mantenimiento
  10. Riesgos

### Contrato
- ✅ 1 prompt único
- ✅ 10 prompts paralelos:
  1. Objeto del Contrato
  2. Obligaciones del Contratista
  3. Plazos y Cronograma
  4. Aspectos Económicos
  5. Penalizaciones e Incentivos
  6. Garantías y Seguros
  7. Condiciones de Ejecución
  8. Resolución y Rescisión
  9. Confidencialidad y Propiedad Intelectual
  10. Riesgos Legales y Recomendaciones

### Oferta
- ✅ 1 prompt único (generación de propuesta comercial)

### Documentación
- ✅ 1 prompt único (generación de documentación técnica)

### Vault (Codex Dilus)
- ✅ 1 prompt único (chat con bóveda de conocimiento)

**Total:** 34 prompts configurables

---

## 🎯 Cómo Usar el Sistema

### Para Administradores:

1. **Acceder al Panel de Admin**
   - Ir a `/admin` en la aplicación
   - Hacer clic en el tab "Prompts IA"

2. **Seleccionar Categoría**
   - Click en una de las tarjetas de categoría (Pliego Técnico, Contrato, etc.)
   - Se mostrará la lista de prompts de esa categoría

3. **Ver Prompt**
   - Click en "Ver prompt completo" para expandir el texto
   - Ver las variables disponibles (ej: `{texto}`, `{cliente}`)

4. **Editar Prompt**
   - Click en el icono de editar (lápiz)
   - Modificar nombre, descripción o texto del prompt
   - Cuidado: mantener la estructura JSON en la respuesta esperada
   - Click en "Guardar Cambios"

5. **Ver Historial**
   - Click en el icono de historial (reloj)
   - Ver todos los cambios realizados al prompt
   - Comparar versión anterior vs nueva

6. **Activar/Desactivar**
   - Click en el icono de ojo para activar/desactivar
   - Los prompts inactivos no se usarán en el sistema

---

## 🔧 Detalles Técnicos

### Cache del Sistema
- Los prompts se cachean en memoria durante 5 minutos
- Al editar un prompt, el cache se invalida automáticamente
- Esto optimiza el rendimiento sin comprometer la actualización

### Historial de Cambios
- Cada vez que se modifica el texto de un prompt, se guarda:
  - Texto anterior
  - Texto nuevo
  - Usuario que hizo el cambio
  - Fecha y hora del cambio
- Máximo 50 registros por prompt en el historial

### Variables Dinámicas
Cada prompt puede tener variables que se reemplazan dinámicamente:
- `{texto}` - Texto del documento analizado
- `{contexto}` - Contexto de múltiples documentos
- `{cliente}` - Nombre del cliente
- `{observaciones}` - Observaciones adicionales
- `{tipo_documento}` - Tipo de documento a generar
- `{titulo}` - Título del documento
- `{pregunta}` - Pregunta del usuario (vault)

### Tipos de Prompts
1. **Single (Único):** Una sola consulta a la IA que analiza todo
2. **Parallel (Paralelo):** 10 consultas específicas ejecutadas en paralelo para análisis más detallado

---

## 📝 Archivos Creados/Modificados

### Nuevos Archivos:
1. `sql/12_prompts_configuration.sql` - Migración de base de datos
2. `backend/services/promptService.js` - Servicio de gestión de prompts
3. `frontend/src/components/PromptsManager.jsx` - Interfaz de gestión

### Archivos Modificados:
1. `backend/routes/admin.js` - Rutas API de prompts
2. `backend/routes/analysis.js` - Usar prompts de BD
3. `backend/services/parallelAnalysisService.js` - Usar prompts de BD
4. `frontend/src/pages/AdminPanel.jsx` - Nuevo tab de prompts

---

## ✅ Testing

Para verificar que todo funciona:

1. **Verificar BD:**
   ```sql
   SELECT category, COUNT(*) FROM prompts GROUP BY category;
   ```

2. **Probar API:**
   ```bash
   curl http://localhost:8080/api/admin/prompts/categories
   ```

3. **Probar Frontend:**
   - Ir a `/admin`
   - Click en tab "Prompts IA"
   - Seleccionar una categoría
   - Editar un prompt y guardar
   - Verificar que aparece en historial

4. **Probar Análisis:**
   - Crear un análisis de pliego técnico
   - Verificar que use el prompt configurado en BD
   - Modificar el prompt en admin
   - Crear otro análisis y verificar que usa el nuevo prompt

---

## 🚀 Beneficios

1. **Sin Código:** Los administradores pueden ajustar prompts sin tocar código
2. **Historial Completo:** Trazabilidad de todos los cambios realizados
3. **Flexible:** Soporta tanto prompts únicos como paralelos
4. **Escalable:** Fácil agregar nuevas categorías o prompts
5. **Seguro:** Sistema de activación/desactivación sin eliminar datos
6. **Optimizado:** Cache inteligente para mejor rendimiento

---

## 🎉 Conclusión

El sistema de gestión de prompts está **completamente funcional** y listo para usar. Los administradores ahora pueden:

- ✅ Ver todos los prompts del sistema organizados por categoría
- ✅ Editar y personalizar cada prompt según necesidades específicas
- ✅ Ver historial completo de cambios con comparaciones
- ✅ Activar/desactivar prompts sin perder datos
- ✅ Configurar tanto análisis de 1 consulta como 10 consultas paralelas

El sistema se integra perfectamente con toda la infraestructura existente de DILUS AI y no requiere cambios adicionales para funcionar.

---

**Implementado por:** AI Assistant  
**Fecha:** 4 de diciembre de 2025  
**Estado:** ✅ Completado y Funcional

