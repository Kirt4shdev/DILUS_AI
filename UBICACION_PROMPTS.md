# 📝 Ubicación de Prompts

## Archivo de Prompts

**Ubicación:** `backend/utils/prompts.js`

Este archivo contiene **TODOS los prompts** utilizados en DILUS_AI:

### Prompts Disponibles

1. **`PROMPT_ANALIZAR_PLIEGO`** - Análisis de pliegos técnicos
2. **`PROMPT_ANALIZAR_CONTRATO`** - Análisis de contratos
3. **`PROMPT_GENERAR_OFERTA`** - Generación de ofertas
4. **`PROMPT_GENERAR_DOCUMENTACION`** - Generación de documentación técnica
5. **`PROMPT_CHAT_VAULT`** - Chat con Codex Dilus (bóveda de conocimiento)

### Función Auxiliar

- **`fillPrompt(template, replacements)`** - Reemplaza placeholders {variable} en los prompts

## Cómo Modificar un Prompt

1. Abrir `backend/utils/prompts.js`
2. Editar el prompt deseado
3. Guardar el archivo
4. Reiniciar el backend: `docker-compose restart backend`

**Nota:** Los prompts están centralizados en un solo archivo para facilitar su edición y mantenimiento.

