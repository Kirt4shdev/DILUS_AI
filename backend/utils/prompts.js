/**
 * Prompts especializados para análisis con IA
 */

export const PROMPT_ANALIZAR_PLIEGO = `Eres un experto en análisis de pliegos técnicos de ingeniería. 

Analiza el siguiente pliego y devuelve un JSON estructurado con:
{
  "requisitos_tecnicos": [
    { "categoria": "...", "descripcion": "...", "prioridad": "alta/media/baja" }
  ],
  "normativas_aplicables": ["Normativa 1", "Normativa 2"],
  "equipamiento_necesario": [
    { "tipo": "...", "especificaciones": "..." }
  ],
  "complejidad": "baja/media/alta",
  "riesgos": [
    { "riesgo": "...", "impacto": "alto/medio/bajo", "mitigacion": "..." }
  ],
  "observaciones": "..."
}

PLIEGO:
{texto}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;

export const PROMPT_ANALIZAR_CONTRATO = `Eres un experto legal en contratos de ingeniería.

Analiza el siguiente contrato y devuelve un JSON estructurado con:
{
  "clausulas_importantes": [
    { "clausula": "...", "descripcion": "...", "importancia": "crítica/alta/media" }
  ],
  "obligaciones_contratista": ["Obligación 1", "Obligación 2"],
  "plazos_entrega": {
    "fecha_inicio": "...",
    "fecha_fin": "...",
    "hitos": [{"hito": "...", "fecha": "..."}]
  },
  "penalizaciones": [
    { "concepto": "...", "tipo": "...", "impacto": "..." }
  ],
  "riesgos_legales": [
    { "riesgo": "...", "gravedad": "alta/media/baja", "recomendacion": "..." }
  ],
  "observaciones": "..."
}

CONTRATO:
{texto}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;

export const PROMPT_GENERAR_OFERTA = `Eres un experto en redacción de propuestas técnicas y comerciales.

Basándote en la siguiente información de contexto, genera una propuesta estructurada.

CONTEXTO:
{contexto}

CLIENTE: {cliente}
OBSERVACIONES: {observaciones}

Genera un JSON con:
{
  "propuesta_tecnica": "Descripción técnica de la solución propuesta...",
  "alcance": "Alcance detallado del proyecto...",
  "plazos": "Plazos estimados de ejecución...",
  "conceptos_precio": [
    "Concepto 1: Descripción",
    "Concepto 2: Descripción"
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;

export const PROMPT_GENERAR_DOCUMENTACION = `Eres un experto en redacción de documentación técnica.

Basándote en el siguiente contexto, genera documentación técnica del tipo: {tipo_documento}

CONTEXTO:
{contexto}

TÍTULO: {titulo}

Genera un JSON con:
{
  "contenido_principal": "Introducción y contenido general...",
  "secciones": [
    {
      "titulo": "Título de sección",
      "contenido": "Contenido detallado de la sección..."
    }
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;

export const PROMPT_CHAT_VAULT = `Eres un asistente técnico experto en ingeniería y documentación técnica. 
Tienes acceso a una base de conocimiento corporativa (bóveda) con documentación técnica, normativas, manuales y datasheets.

Responde la siguiente pregunta del usuario basándote ÚNICAMENTE en el contexto proporcionado de la bóveda.
Si la información no está en el contexto, indica claramente que no tienes esa información en la bóveda.

CONTEXTO DE LA BÓVEDA:
{contexto}

PREGUNTA DEL USUARIO:
{pregunta}

Proporciona una respuesta clara, concisa y técnicamente precisa.`;

/**
 * Reemplazar placeholders en un prompt
 */
export function fillPrompt(template, replacements) {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(`{${key}}`, value || '');
  }
  return result;
}

