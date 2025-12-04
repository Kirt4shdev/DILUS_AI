# 🔍 BÚSQUEDA FUZZY MEJORADA - Sistema de Detección de Equipos

## ✅ MEJORAS IMPLEMENTADAS

Se ha mejorado significativamente el sistema de detección y filtrado de equipos en el RAG con **búsqueda fuzzy** (flexible).

---

## 🎯 Características Nuevas

### 1. **Detección Case-Insensitive**
Ahora detecta equipos sin importar mayúsculas/minúsculas:
- ✅ "razon+" → Detecta
- ✅ "RAZON+" → Detecta  
- ✅ "RaZON+" → Detecta
- ✅ "ws600" → Detecta
- ✅ "WS600" → Detecta

### 2. **Generación Automática de Variantes**
Para cada equipo detectado, genera múltiples variantes:

**Ejemplo: "razon+"**
- `razon+`
- `razon`
- `rason+` (z ↔ s)
- `rason`
- `razon plus`

**Ejemplo: "ws600"**
- `ws600`
- `ws-600` (con guión)
- `ws 600` (con espacio)

### 3. **Búsqueda en Múltiples Campos**
Busca en:
- `metadata.doc.equipo`
- `metadata.doc.fabricante`

Con **ILIKE** (case-insensitive) y wildcards (**%variante%**)

### 4. **Errores Tipográficos Comunes**
Detecta variaciones tipográficas:
- `z` ↔ `s`: razon ↔ rason
- Con/sin espacios
- Con/sin guiones
- Con/sin símbolos especiales (+)

---

## 📊 Ejemplos de Uso

### Ejemplo 1: "razon+" en minúsculas

**Query:** "dime que registros modbus tiene el razon+"

**Proceso:**
1. Detecta: `["razon+"]`
2. Genera variantes: `["razon+", "razon", "rason+", "rason", "razon plus"]`
3. SQL filtra por:
   ```sql
   WHERE (
     e.metadata->'doc'->>'equipo' ILIKE '%razon+%' OR 
     e.metadata->'doc'->>'fabricante' ILIKE '%razon+%'
   ) OR (
     e.metadata->'doc'->>'equipo' ILIKE '%razon%' OR 
     e.metadata->'doc'->>'fabricante' ILIKE '%razon%'
   ) OR ...
   ```
4. **Resultado:** ✅ Solo encuentra documentos del RaZON+

### Ejemplo 2: Errores tipográficos

**Query:** "manual del rason 3000" (error: debería ser "razon")

**Proceso:**
1. Detecta: `["rason"]`
2. Genera variantes: `["rason", "razon"]` (corrige z↔s)
3. SQL busca ambas variantes
4. **Resultado:** ✅ Encuentra documentos aunque esté mal escrito

### Ejemplo 3: Sin espacios

**Query:** "especificaciones ws600"

**Proceso:**
1. Detecta: `["ws600"]`
2. Genera variantes: `["ws600", "ws-600", "ws 600"]`
3. **Resultado:** ✅ Encuentra aunque en metadata esté como "WS-600" o "WS 600"

---

## 🔧 Configuración

### Equipos Conocidos Pre-configurados

El sistema incluye una lista de equipos conocidos para detección mejorada:

```javascript
const knownEquipmentNames = [
  'razon', 'rason', 'razon+', 'rason+',
  'ws600', 'ws-600', 'ws 600',
  'rpu3000', 'rpu-3000', 'rpu 3000',
  'cmp6', 'cmp-6', 'cmp 6',
  'chp1', 'chp-1', 'chp 1',
  // Puedes agregar más aquí
];
```

### Patrón de Detección

```javascript
// Detecta códigos alfanuméricos flexibles
/\b([a-z]{2,}[-_\s]*[+]?[\d]*|[a-z]+\d+[a-z]*)\b/gi
```

**Qué detecta:**
- ✅ `razon+`, `ws600`, `rpu3000`
- ✅ Variantes con espacios: `razon +`, `ws 600`
- ✅ Variantes con guiones: `ws-600`, `rpu-3000`
- ✅ Mixto: `abc123def`

---

## 📝 Logs Mejorados

Los logs ahora muestran información detallada del fuzzy matching:

```javascript
{
  "equipments": ["razon+", "razon", "rason+", "rason"],
  "totalVariants": 5,
  "filteredByEquipment": true,
  "fuzzyMatchingActive": true,
  "variantsUsed": 5,
  "firstResult": {
    "document": "MN_KZ_RAZON+.pdf",
    "hybrid_score": 0.852
  }
}
```

---

## 🧪 Testing

### Pruebas a Realizar

1. **Case-insensitive:**
   - "manual del razon+"
   - "manual del RAZON+"
   - "manual del RaZON+"

2. **Errores tipográficos:**
   - "manual del rason+" (s en vez de z)
   - "especificaciones rason"

3. **Sin espacios/con guiones:**
   - "ws600 manual"
   - "ws-600 manual"
   - "ws 600 manual"

4. **Parcial:**
   - "razon" (sin +)
   - "600" (debería detectar ws600)

### Verificar en Logs

Busca en los logs del backend:

```bash
docker logs dilus_backend | Select-String -Pattern "Equipment detected"
```

Deberías ver:
```
Equipment detected in query (fuzzy): { equipments: ['razon+', 'razon', ...], totalVariants: 5 }
```

---

## 🎨 Ventajas del Sistema Fuzzy

| Antes | Después |
|-------|---------|
| Solo "RAZON+" (exacto) | razon+, RAZON+, RaZON+, rason+ |
| Solo mayúsculas | Cualquier combinación |
| Fallos con errores | Corrección automática z↔s |
| Sin variantes | 5-10 variantes por equipo |
| Búsqueda solo en `equipo` | Búsqueda en `equipo` Y `fabricante` |

---

## 🚀 Próximas Mejoras Opcionales

1. **Distancia de Levenshtein**: Para errores más complejos
2. **Sinónimos**: "piranómetro" → "CMP6"
3. **Números de serie**: Detectar S/N específicos
4. **Learning**: Aprender de búsquedas previas

---

## 📚 Archivos Modificados

- `backend/services/ragService.js`:
  - `detectEquipmentInQuery()` - Detección flexible
  - `generateEquipmentVariants()` - Generación de variantes
  - `searchSimilar()` - Búsqueda con múltiples variantes

- `backend/services/fuzzySearchHelper.js` (nuevo):
  - Funciones auxiliares para fuzzy matching

---

## ✅ Conclusión

El sistema ahora es **mucho más flexible** y tolerante a:
- ✅ Errores tipográficos
- ✅ Mayúsculas/minúsculas
- ✅ Espacios y guiones
- ✅ Variaciones de escritura

**Resultado:** Mejor experiencia de usuario y resultados más relevantes incluso con queries imperfectas.

---

*Implementado: 2025-12-04*  
*Versión: 2.0.0*

