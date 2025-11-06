# 🤖 Configuración de Modelos GPT-5

## 📋 Resumen

La aplicación DILUS_AI está configurada para usar los modelos **GPT-5** de OpenAI:

- **gpt-5-mini**: Modelo rápido y eficiente para análisis general
- **gpt-5**: Modelo avanzado con capacidades de razonamiento profundo

---

## 🔧 Modelos Configurados

### gpt-5-mini (GPT-5 Mini)

**Uso:**
- Análisis de pliegos técnicos (primera pasada)
- Análisis de contratos (primera pasada)
- Generación de ofertas comerciales
- Generación de documentación técnica
- Chat de la Bóveda

**Características:**
- Context window: ~200k tokens
- Límite aplicado en DILUS_AI: 100k tokens (conservador)
- Velocidad: Rápido
- Costo: Más económico

### gpt-5 (GPT-5 Standard)

**Uso:**
- Botón "Repetir con IA Mejorada 🔄" en análisis de pliegos
- Botón "Repetir con IA Mejorada 🔄" en análisis de contratos
- Análisis profundo y complejo

**Características:**
- Context window: ~200k tokens
- Límite aplicado en DILUS_AI: 20k tokens (conservador debido a límites de TPM)
- Velocidad: Más lento (mayor razonamiento)
- Costo: Más costoso

---

## ⚠️ Límites de Tokens

### ¿Por qué límites tan conservadores?

Los modelos GPT-5 tienen **límites de TPM (Tokens Por Minuto)** que debemos respetar:

- **gpt-5**: Límites de TPM más estrictos para análisis profundo
- Esto significa que el total de tokens de entrada + salida debe ser gestionado cuidadosamente

Por eso aplicamos:
- **gpt-5-mini**: Límite de 100k tokens de entrada (conservador)
- **gpt-5**: Límite de 20k tokens de entrada (para evitar errores de TPM)

### Sistema Inteligente de Gestión de Contexto

DILUS_AI decide automáticamente:

1. **Si el documento cabe en el límite** → Envía el texto completo
2. **Si el documento es muy grande** → Usa RAG para obtener solo los fragmentos relevantes

Esto garantiza:
- ✅ Mejor precisión cuando es posible usar texto completo
- ✅ Evitar errores de límite de tokens
- ✅ Optimizar costos de API

---

## 🔑 Configuración de API Keys

En tu archivo `.env` o `backend/.env`:

```bash
# API Key para gpt-5-mini (análisis general)
OPENAI_API_KEY=sk-proj-...

# API Key para gpt-5 (análisis mejorado)
# Puede ser la misma API key o una diferente
OPENAI_API_KEY_STANDARD=sk-proj-...
```

---

## 📊 Capacidades de GPT-5

Los modelos GPT-5 ofrecen mejoras significativas:

### ✅ Características principales:
- Soportan `temperature` para controlar creatividad
- Mensajes de `system` role para instrucciones base
- Razonamiento más profundo y coherente
- Mayor capacidad de contexto
- Mejor comprensión de documentos técnicos

### 🔧 Parámetros configurables:
- `temperature`: Control de aleatoriedad (usamos 0.3 por defecto)
- `max_tokens`: Tokens máximos de salida (4k-8k según modelo)
- `system` messages: Instrucciones de rol y contexto

---

## 🚨 Solución a Errores Comunes

### Error: "Request too large"

❌ **Error:**
```
Request too large for [model] in organization ... on tokens per min (TPM): 
Limit exceeded.
```

✅ **Solución aplicada:**
- Uso de modelos `gpt-5-mini` y `gpt-5` oficiales
- Límite de contexto para Mini: 100k tokens
- Límite de contexto para Standard: 20k tokens
- Implementado uso automático de RAG para documentos grandes

### Error: "Invalid model specified"

Si recibes un error indicando que el modelo no existe:

1. **Verifica tu acceso a la API:**
   - Los modelos GPT-5 pueden requerir acceso especial
   - Consulta tu tier de acceso en: https://platform.openai.com/account/limits

2. **Alternativa temporal:**
   Si no tienes acceso a GPT-5, puedes modificar temporalmente en `backend/services/aiService.js`:

```javascript
// Para gpt-5-mini
model: 'gpt-4o-mini',

// Para gpt-5
model: 'gpt-4o',
```

---

## 📈 Monitoreo de Uso

DILUS_AI registra automáticamente en los logs:

```
INFO: Document 123 fits in context, using full text
      { tokens: 12000, model: 'gpt-5-mini' }

INFO: Document 456 too large, using RAG
      { tokens: 95000, model: 'gpt-5' }

INFO: Final context size for analysis
      { tokens: 19500, model: 'gpt-5', documents: 2 }
```

---

## 🔄 Migración desde GPT-4

Si estabas usando GPT-4 previamente:

| Antes | Ahora |
|-------|-------|
| `gpt-4o-mini` | `gpt-5-mini` |
| `gpt-4o` | `gpt-5` |
| Límite: 128k tokens | Límite: 20k-100k tokens (conservador) |
| Soporta system messages | ✅ Soporta system messages |

---

## 📚 Recursos Adicionales

- [Documentación oficial GPT-5](https://openai.com/index/introducing-gpt-5-for-developers)
- [Límites de rate](https://platform.openai.com/account/rate-limits)
- [Guía de la API](https://platform.openai.com/docs/guides)

---

## ✅ Verificación

Para verificar que todo funciona correctamente:

1. ✅ Sube un documento pequeño (< 10 páginas)
2. ✅ Realiza un análisis con IA normal (gpt-5-mini)
3. ✅ Prueba el botón "Repetir con IA Mejorada" (gpt-5)
4. ✅ Revisa los logs del backend para ver el uso de tokens

Si todo funciona sin errores de límite de tokens, ¡la configuración es correcta! 🎉

---

**Última actualización:** 6 de noviembre de 2025

