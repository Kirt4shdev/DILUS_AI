# 🔧 FIX: Top K en Codex Dilus

## 🐛 Problema Detectado

El chat de **Codex Dilus** estaba usando **10 chunks** en lugar de los **5 configurados** en el Admin Panel.

### Evidencia
```
Usuario pregunta: "¿cuáles son los protocolos que acepta climasensor us?"
Respuesta del sistema: "Fuentes: (10 fragmentos)" ❌

Configuración en Admin Panel:
- Número de Chunks (Top K): 5 ✓
```

---

## 🔍 Causa Raíz

En `backend/routes/vault.js` línea 37, había un valor **hardcodeado**:

```javascript
// ❌ ANTES (Incorrecto)
const searchResult = await searchInVault(queryText, { topK: 10, userId: req.user.id });
```

Esto ignoraba completamente la configuración del Admin Panel.

---

## ✅ Solución Implementada

### 1. Importar el servicio de configuración

```javascript
// Línea 9
import { getConfigValue } from '../services/ragConfigService.js';
```

### 2. Leer la configuración dinámica

```javascript
// Líneas 37-41
// Obtener configuración dinámica de top_k
const topK = await getConfigValue('top_k', 5);

// Buscar en la biblioteca (RAG)
const searchResult = await searchInVault(queryText, { topK, userId: req.user.id });
```

Ahora el sistema:
1. ✅ Lee `top_k` de la base de datos
2. ✅ Usa el valor configurado en Admin Panel
3. ✅ Si falla, usa 5 como valor por defecto
4. ✅ Respeta el cache de 1 minuto de `ragConfigService`

---

## 🎯 Resultado

| Antes | Después |
|-------|---------|
| Siempre 10 chunks | 5 chunks (configurable) |
| Ignoraba configuración | Respeta configuración |
| Valor hardcodeado | Valor dinámico |

---

## 🧪 Cómo Probar

### 1. Reiniciar el backend

```bash
docker-compose restart backend
```

O esperar ~1 minuto para que expire el cache.

### 2. Hacer una pregunta en Codex Dilus

```
Pregunta: "¿qué protocolos acepta el sensor?"
```

### 3. Verificar la respuesta

Debe mostrar:
```
Fuentes: (5 fragmentos) ✅
```

### 4. Cambiar configuración

En Admin Panel:
- Cambiar **Top K** a **3**
- Guardar configuración
- Esperar 1 minuto o reiniciar backend
- Hacer otra pregunta
- Verificar: "Fuentes: (3 fragmentos)"

---

## 📊 Impacto

### Antes
```
Usuario configura Top K = 5
↓
Sistema usa 10 chunks fijos (hardcodeado)
↓
Más tokens consumidos de lo necesario
Respuestas más largas de lo esperado
```

### Después
```
Usuario configura Top K = 5
↓
Sistema lee configuración de BD
↓
Usa exactamente 5 chunks
↓
Consumo optimizado según configuración
```

---

## 🔧 Archivos Modificados

- ✅ `backend/routes/vault.js` (líneas 9, 37-41)

---

## ⚠️ Nota Importante

**El cambio requiere reiniciar el backend** para aplicarse inmediatamente, o esperar ~1 minuto para que expire el cache de configuración.

```bash
# Reiniciar backend
docker-compose restart backend

# Verificar que esté corriendo
docker ps | grep backend
```

---

## 📝 Verificación Adicional

Para confirmar que otros endpoints también usan la configuración correctamente:

```bash
# Buscar otros posibles valores hardcodeados
grep -r "topK.*:" backend/routes/
```

Resultado: **No se encontraron otros valores hardcodeados** ✅

---

## ✅ Conclusión

El problema ha sido **completamente resuelto**. Ahora el Codex Dilus respetará la configuración de **Top K** establecida en el Admin Panel.

**Fecha de corrección**: 7 de Noviembre de 2025
**Afecta a**: Chat de Codex Dilus únicamente
**Requiere**: Reiniciar backend

