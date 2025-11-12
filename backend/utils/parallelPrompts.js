/**
 * Prompts paralelos para análisis eficiente con mini-consultas específicas
 * Cada prompt tiene un ID único y una pregunta específica
 */

/**
 * Prompts para análisis de Pliego Técnico
 * Se ejecutan en paralelo para obtener información específica
 */
export const PROMPTS_PLIEGO_TECNICO = [
  {
    id: 'PromptPliegoTecnico_1',
    pregunta: 'Extrae ÚNICAMENTE información sobre estaciones de monitoreo: número de estaciones, ubicaciones exactas, coordenadas si están disponibles. Responde en JSON con estructura: {"estaciones": [{"nombre": "...", "ubicacion": "...", "coordenadas": "..."}], "total": 0}',
    campo_resultado: 'estaciones'
  },
  {
    id: 'PromptPliegoTecnico_2',
    pregunta: 'Extrae ÚNICAMENTE información sobre sensores a instalar: tipos de sensores, modelos específicos, marcas requeridas. Responde en JSON con estructura: {"sensores": [{"tipo": "...", "modelo": "...", "marca": "..."}]}',
    campo_resultado: 'sensores'
  },
  {
    id: 'PromptPliegoTecnico_3',
    pregunta: 'Extrae ÚNICAMENTE información sobre rangos de medición y precisiones requeridas para cada sensor o equipo. Responde en JSON con estructura: {"especificaciones": [{"equipo": "...", "rango": "...", "precision": "...", "unidad": "..."}]}',
    campo_resultado: 'especificaciones_tecnicas'
  },
  {
    id: 'PromptPliegoTecnico_4',
    pregunta: 'Calcula o extrae ÚNICAMENTE las distancias desde Madrid a las ubicaciones mencionadas en el documento. Si no hay información explícita, indica "No especificado". Responde en JSON con estructura: {"distancias": [{"ubicacion": "...", "distancia_desde_madrid": "...", "unidad": "km"}]}',
    campo_resultado: 'distancias'
  },
  {
    id: 'PromptPliegoTecnico_5',
    pregunta: 'Extrae ÚNICAMENTE información sobre tiempos y plazos de instalación: duración estimada, plazos de entrega, hitos temporales. Responde en JSON con estructura: {"plazos": {"instalacion": "...", "entrega": "...", "hitos": [{"nombre": "...", "plazo": "..."}]}}',
    campo_resultado: 'plazos_instalacion'
  },
  {
    id: 'PromptPliegoTecnico_6',
    pregunta: 'Extrae ÚNICAMENTE información sobre normativas aplicables: normas técnicas, regulaciones, estándares que debe cumplir el proyecto. Responde en JSON con estructura: {"normativas": [{"codigo": "...", "descripcion": "...", "ambito": "..."}]}',
    campo_resultado: 'normativas'
  },
  {
    id: 'PromptPliegoTecnico_7',
    pregunta: 'Extrae ÚNICAMENTE información sobre requisitos de conectividad y comunicaciones: protocolos, redes, sistemas SCADA, transmisión de datos. Responde en JSON con estructura: {"conectividad": {"protocolo": "...", "tipo_red": "...", "sistema_scada": "...", "requisitos_adicionales": []}}',
    campo_resultado: 'conectividad'
  },
  {
    id: 'PromptPliegoTecnico_8',
    pregunta: 'Extrae ÚNICAMENTE información sobre requisitos de alimentación eléctrica: tensiones, potencias, sistemas de respaldo, baterías. Responde en JSON con estructura: {"alimentacion": {"tension": "...", "potencia": "...", "respaldo": "...", "autonomia": "..."}}',
    campo_resultado: 'alimentacion'
  },
  {
    id: 'PromptPliegoTecnico_9',
    pregunta: 'Extrae ÚNICAMENTE información sobre garantías, mantenimiento y soporte técnico requeridos. Responde en JSON con estructura: {"garantia_mantenimiento": {"periodo_garantia": "...", "mantenimiento_preventivo": "...", "soporte_tecnico": "...", "formacion": "..."}}',
    campo_resultado: 'garantia_mantenimiento'
  },
  {
    id: 'PromptPliegoTecnico_10',
    pregunta: 'Identifica ÚNICAMENTE los principales riesgos técnicos, ambientales o logísticos del proyecto y sus mitigaciones propuestas. Responde en JSON con estructura: {"riesgos": [{"tipo": "...", "descripcion": "...", "impacto": "alto/medio/bajo", "mitigacion": "..."}]}',
    campo_resultado: 'riesgos'
  }
];

/**
 * Prompts para análisis de Contrato
 * Mejorados para capturar más contexto y dar mejores resultados
 */
export const PROMPTS_CONTRATO = [
  {
    id: 'PromptContrato_1',
    pregunta: 'Analiza el contrato y extrae información sobre el OBJETO DEL CONTRATO: ¿Qué se está contratando? ¿Cuál es el alcance del trabajo? ¿Qué servicios o productos incluye? ¿Hay exclusiones específicas? Responde en JSON con estructura: {"objeto_contrato": {"descripcion": "...", "alcance": "...", "servicios_incluidos": ["..."], "exclusiones": ["..."]}}',
    campo_resultado: 'objeto_contrato'
  },
  {
    id: 'PromptContrato_2',
    pregunta: 'Extrae las OBLIGACIONES DEL CONTRATISTA: ¿Qué debe hacer el contratista? ¿Qué entregables debe proporcionar? ¿Qué estándares de calidad debe cumplir? ¿Hay certificaciones requeridas? Responde en JSON con estructura: {"obligaciones_contratista": [{"tipo": "...", "descripcion": "...", "entregable": "...", "estandar_calidad": "...", "importancia": "crítica/alta/media"}]}',
    campo_resultado: 'obligaciones_contratista'
  },
  {
    id: 'PromptContrato_3',
    pregunta: 'Analiza PLAZOS Y CRONOGRAMA: ¿Cuándo inicia y termina el contrato? ¿Qué hitos intermedios hay? ¿Hay plazos parciales de entrega? ¿Cuál es el plazo de ejecución? Responde en JSON con estructura: {"plazos": {"fecha_inicio": "...", "fecha_fin": "...", "duracion": "...", "hitos": [{"nombre": "...", "fecha": "...", "descripcion": "..."}], "plazos_parciales": ["..."]}}',
    campo_resultado: 'plazos_contractuales'
  },
  {
    id: 'PromptContrato_4',
    pregunta: 'Identifica ASPECTOS ECONÓMICOS: ¿Cuál es el presupuesto o valor del contrato? ¿Cómo se estructura el pago? ¿Hay anticipos? ¿Hay conceptos variables o fijos? ¿Se menciona IVA u otros impuestos? Responde en JSON con estructura: {"aspectos_economicos": {"presupuesto_total": "...", "estructura_pago": "...", "anticipos": "...", "forma_pago": "...", "impuestos": "...", "conceptos": ["..."]}}',
    campo_resultado: 'aspectos_economicos'
  },
  {
    id: 'PromptContrato_5',
    pregunta: 'Extrae PENALIZACIONES, MULTAS E INCENTIVOS: ¿Qué penalizaciones hay por incumplimiento? ¿Cuándo se aplican? ¿Qué montos tienen? ¿Hay incentivos por cumplimiento anticipado o calidad superior? Responde en JSON con estructura: {"penalizaciones_incentivos": {"penalizaciones": [{"concepto": "...", "condicion": "...", "monto": "...", "severidad": "..."}], "incentivos": [{"concepto": "...", "condicion": "...", "beneficio": "..."}]}}',
    campo_resultado: 'penalizaciones_incentivos'
  },
  {
    id: 'PromptContrato_6',
    pregunta: 'Analiza GARANTÍAS Y SEGUROS: ¿Qué garantías debe aportar el contratista? ¿Fianzas, avales, seguros? ¿Qué montos? ¿Por cuánto tiempo? ¿Garantía de obra? ¿Responsabilidad civil? Responde en JSON con estructura: {"garantias_seguros": {"garantias": [{"tipo": "...", "monto": "...", "duracion": "...", "descripcion": "..."}], "seguros_requeridos": [{"tipo": "...", "cobertura": "...", "monto_minimo": "..."}]}}',
    campo_resultado: 'garantias_seguros'
  },
  {
    id: 'PromptContrato_7',
    pregunta: 'Identifica CONDICIONES DE EJECUCIÓN: ¿Dónde se ejecutará el trabajo? ¿Hay restricciones horarias? ¿Requisitos de seguridad? ¿Coordinación con otros contratistas? ¿Permisos necesarios? Responde en JSON con estructura: {"condiciones_ejecucion": {"ubicacion": "...", "horarios": "...", "seguridad": ["..."], "coordinacion": "...", "permisos": ["..."]}}',
    campo_resultado: 'condiciones_ejecucion'
  },
  {
    id: 'PromptContrato_8',
    pregunta: 'Analiza CAUSAS DE RESOLUCIÓN Y RESCISIÓN: ¿En qué casos se puede terminar el contrato? ¿Qué pasa si alguna parte incumple? ¿Hay cláusulas de salida? ¿Consecuencias de la rescisión? Responde en JSON con estructura: {"resolucion_rescision": {"causas": [{"tipo": "...", "descripcion": "...", "quien_puede_invocar": "..."}], "consecuencias": ["..."], "procedimiento": "..."}}',
    campo_resultado: 'resolucion_rescision'
  },
  {
    id: 'PromptContrato_9',
    pregunta: 'Extrae CONFIDENCIALIDAD, PROPIEDAD INTELECTUAL Y PROTECCIÓN DE DATOS: ¿Hay cláusulas de confidencialidad? ¿De quién es la propiedad intelectual? ¿Hay tratamiento de datos personales? ¿RGPD aplicable? Responde en JSON con estructura: {"confidencialidad_pi_datos": {"confidencialidad": {"alcance": "...", "duracion": "...", "excepciones": ["..."]}, "propiedad_intelectual": "...", "proteccion_datos": "..."}}',
    campo_resultado: 'confidencialidad_pi_datos'
  },
  {
    id: 'PromptContrato_10',
    pregunta: 'Identifica RIESGOS LEGALES Y RECOMENDACIONES: ¿Qué cláusulas son más desfavorables para el contratista? ¿Qué aspectos son ambiguos o pueden generar conflictos? ¿Qué riesgos se identifican? ¿Qué se recomienda negociar o aclarar? Responde en JSON con estructura: {"riesgos_recomendaciones": {"riesgos": [{"tipo": "...", "descripcion": "...", "gravedad": "alta/media/baja", "probabilidad": "..."}], "clausulas_desfavorables": ["..."], "recomendaciones": ["..."]}}',
    campo_resultado: 'riesgos_recomendaciones'
  }
];

/**
 * Prompts para generación de Oferta
 */
export const PROMPTS_OFERTA = [
  {
    id: 'PromptOferta_1',
    pregunta: 'Basándote en el contexto, genera ÚNICAMENTE una propuesta técnica resumida de la solución. Responde en JSON con estructura: {"propuesta_tecnica": "..."}',
    campo_resultado: 'propuesta_tecnica'
  },
  {
    id: 'PromptOferta_2',
    pregunta: 'Basándote en el contexto, define ÚNICAMENTE el alcance detallado del proyecto. Responde en JSON con estructura: {"alcance": "..."}',
    campo_resultado: 'alcance'
  },
  {
    id: 'PromptOferta_3',
    pregunta: 'Basándote en el contexto, estima ÚNICAMENTE los plazos de ejecución del proyecto. Responde en JSON con estructura: {"plazos": "..."}',
    campo_resultado: 'plazos'
  },
  {
    id: 'PromptOferta_4',
    pregunta: 'Basándote en el contexto, genera ÚNICAMENTE una lista de conceptos de precio (sin valores monetarios, solo descripciones). Responde en JSON con estructura: {"conceptos_precio": ["Concepto 1: ...", "Concepto 2: ..."]}',
    campo_resultado: 'conceptos_precio'
  }
];

/**
 * Prompts para generación de Documentación
 */
export const PROMPTS_DOCUMENTACION = [
  {
    id: 'PromptDocumentacion_1',
    pregunta: 'Genera ÚNICAMENTE una introducción y resumen ejecutivo del documento técnico. Responde en JSON con estructura: {"introduccion": "..."}',
    campo_resultado: 'introduccion'
  },
  {
    id: 'PromptDocumentacion_2',
    pregunta: 'Genera ÚNICAMENTE las secciones principales del documento técnico con sus contenidos. Responde en JSON con estructura: {"secciones": [{"titulo": "...", "contenido": "..."}]}',
    campo_resultado: 'secciones'
  },
  {
    id: 'PromptDocumentacion_3',
    pregunta: 'Genera ÚNICAMENTE conclusiones y recomendaciones para el documento técnico. Responde en JSON con estructura: {"conclusiones": "..."}',
    campo_resultado: 'conclusiones'
  }
];

/**
 * Obtener prompts según el tipo de análisis
 */
export function getPromptsForAnalysis(analysisType) {
  switch (analysisType) {
    case 'pliego_tecnico':
      return PROMPTS_PLIEGO_TECNICO;
    case 'contrato':
      return PROMPTS_CONTRATO;
    case 'oferta':
      return PROMPTS_OFERTA;
    case 'documentacion':
      return PROMPTS_DOCUMENTACION;
    default:
      throw new Error(`Tipo de análisis no soportado: ${analysisType}`);
  }
}

/**
 * Crear prompt completo para RAG con pregunta específica
 */
export function buildRagPrompt(contexto, pregunta) {
  return `Eres un asistente técnico experto. Responde basándote ÚNICAMENTE en el siguiente contexto.

CONTEXTO:
${contexto}

PREGUNTA:
${pregunta}

IMPORTANTE: 
- Responde ÚNICAMENTE con un JSON válido
- NO incluyas markdown (triple backticks con json) ni texto adicional
- Si no encuentras información relevante, devuelve un objeto JSON vacío con la estructura solicitada
- Sé específico y conciso`;
}

