/**
 * Script para reinsertar prompts con codificación UTF-8 correcta
 */

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'dilus_ai',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'dilus2024'
});

const prompts = [
  // PLIEGO TÉCNICO - Único
  {
    key: 'pliego_tecnico_single',
    name: 'Análisis de Pliego Técnico (1 consulta)',
    description: 'Prompt para analizar pliegos técnicos en una sola consulta',
    category: 'pliego_tecnico',
    prompt_type: 'single',
    prompt_text: `Eres un experto en análisis de pliegos técnicos de ingeniería. 

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`,
    variables: ['texto'],
    display_order: 1
  },
  // PLIEGO TÉCNICO - Paralelos
  {
    key: 'pliego_tecnico_parallel_1',
    name: 'Estaciones de Monitoreo',
    description: 'Extrae información sobre estaciones de monitoreo',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre estaciones de monitoreo: número de estaciones, ubicaciones exactas, coordenadas si están disponibles. Responde en JSON con estructura: {"estaciones": [{"nombre": "...", "ubicacion": "...", "coordenadas": "..."}], "total": 0}',
    variables: [],
    display_order: 1
  },
  {
    key: 'pliego_tecnico_parallel_2',
    name: 'Sensores',
    description: 'Extrae información sobre sensores a instalar',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre sensores a instalar: tipos de sensores, modelos específicos, marcas requeridas. Responde en JSON con estructura: {"sensores": [{"tipo": "...", "modelo": "...", "marca": "..."}]}',
    variables: [],
    display_order: 2
  },
  {
    key: 'pliego_tecnico_parallel_3',
    name: 'Especificaciones Técnicas',
    description: 'Extrae rangos de medición y precisiones',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre rangos de medición y precisiones requeridas para cada sensor o equipo. Responde en JSON con estructura: {"especificaciones": [{"equipo": "...", "rango": "...", "precision": "...", "unidad": "..."}]}',
    variables: [],
    display_order: 3
  },
  {
    key: 'pliego_tecnico_parallel_4',
    name: 'Distancias',
    description: 'Calcula o extrae distancias desde Madrid',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Calcula o extrae ÚNICAMENTE las distancias desde Madrid a las ubicaciones mencionadas en el documento. Si no hay información explícita, indica "No especificado". Responde en JSON con estructura: {"distancias": [{"ubicacion": "...", "distancia_desde_madrid": "...", "unidad": "km"}]}',
    variables: [],
    display_order: 4
  },
  {
    key: 'pliego_tecnico_parallel_5',
    name: 'Plazos de Instalación',
    description: 'Extrae tiempos y plazos',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre tiempos y plazos de instalación: duración estimada, plazos de entrega, hitos temporales. Responde en JSON con estructura: {"plazos": {"instalacion": "...", "entrega": "...", "hitos": [{"nombre": "...", "plazo": "..."}]}}',
    variables: [],
    display_order: 5
  },
  {
    key: 'pliego_tecnico_parallel_6',
    name: 'Normativas',
    description: 'Extrae normativas aplicables',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre normativas aplicables: normas técnicas, regulaciones, estándares que debe cumplir el proyecto. Responde en JSON con estructura: {"normativas": [{"codigo": "...", "descripcion": "...", "ambito": "..."}]}',
    variables: [],
    display_order: 6
  },
  {
    key: 'pliego_tecnico_parallel_7',
    name: 'Conectividad',
    description: 'Extrae requisitos de conectividad',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre requisitos de conectividad y comunicaciones: protocolos, redes, sistemas SCADA, transmisión de datos. Responde en JSON con estructura: {"conectividad": {"protocolo": "...", "tipo_red": "...", "sistema_scada": "...", "requisitos_adicionales": []}}',
    variables: [],
    display_order: 7
  },
  {
    key: 'pliego_tecnico_parallel_8',
    name: 'Alimentación Eléctrica',
    description: 'Extrae requisitos de alimentación',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre requisitos de alimentación eléctrica: tensiones, potencias, sistemas de respaldo, baterías. Responde en JSON con estructura: {"alimentacion": {"tension": "...", "potencia": "...", "respaldo": "...", "autonomia": "..."}}',
    variables: [],
    display_order: 8
  },
  {
    key: 'pliego_tecnico_parallel_9',
    name: 'Garantía y Mantenimiento',
    description: 'Extrae información sobre garantías',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Extrae ÚNICAMENTE información sobre garantías, mantenimiento y soporte técnico requeridos. Responde en JSON con estructura: {"garantia_mantenimiento": {"periodo_garantia": "...", "mantenimiento_preventivo": "...", "soporte_tecnico": "...", "formacion": "..."}}',
    variables: [],
    display_order: 9
  },
  {
    key: 'pliego_tecnico_parallel_10',
    name: 'Riesgos',
    description: 'Identifica riesgos del proyecto',
    category: 'pliego_tecnico',
    prompt_type: 'parallel',
    prompt_text: 'Identifica ÚNICAMENTE los principales riesgos técnicos, ambientales o logísticos del proyecto y sus mitigaciones propuestas. Responde en JSON con estructura: {"riesgos": [{"tipo": "...", "descripcion": "...", "impacto": "alto/medio/bajo", "mitigacion": "..."}]}',
    variables: [],
    display_order: 10
  },
  // CONTRATO - Único
  {
    key: 'contrato_single',
    name: 'Análisis de Contrato (1 consulta)',
    description: 'Prompt para analizar contratos en una sola consulta',
    category: 'contrato',
    prompt_type: 'single',
    prompt_text: `Eres un experto legal en contratos de ingeniería.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`,
    variables: ['texto'],
    display_order: 1
  },
  // CONTRATO - Paralelos
  {
    key: 'contrato_parallel_1',
    name: 'Objeto del Contrato',
    description: 'Analiza el objeto del contrato',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Analiza el contrato y extrae información sobre el OBJETO DEL CONTRATO: ¿Qué se está contratando? ¿Cuál es el alcance del trabajo? ¿Qué servicios o productos incluye? ¿Hay exclusiones específicas? Responde en JSON con estructura: {"objeto_contrato": {"descripcion": "...", "alcance": "...", "servicios_incluidos": ["..."], "exclusiones": ["..."]}}',
    variables: [],
    display_order: 1
  },
  {
    key: 'contrato_parallel_2',
    name: 'Obligaciones del Contratista',
    description: 'Extrae obligaciones del contratista',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Extrae las OBLIGACIONES DEL CONTRATISTA: ¿Qué debe hacer el contratista? ¿Qué entregables debe proporcionar? ¿Qué estándares de calidad debe cumplir? ¿Hay certificaciones requeridas? Responde en JSON con estructura: {"obligaciones_contratista": [{"tipo": "...", "descripcion": "...", "entregable": "...", "estandar_calidad": "...", "importancia": "crítica/alta/media"}]}',
    variables: [],
    display_order: 2
  },
  {
    key: 'contrato_parallel_3',
    name: 'Plazos y Cronograma',
    description: 'Analiza plazos y cronograma',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Analiza PLAZOS Y CRONOGRAMA: ¿Cuándo inicia y termina el contrato? ¿Qué hitos intermedios hay? ¿Hay plazos parciales de entrega? ¿Cuál es el plazo de ejecución? Responde en JSON con estructura: {"plazos": {"fecha_inicio": "...", "fecha_fin": "...", "duracion": "...", "hitos": [{"nombre": "...", "fecha": "...", "descripcion": "..."}], "plazos_parciales": ["..."]}}',
    variables: [],
    display_order: 3
  },
  {
    key: 'contrato_parallel_4',
    name: 'Aspectos Económicos',
    description: 'Identifica aspectos económicos',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Identifica ASPECTOS ECONÓMICOS: ¿Cuál es el presupuesto o valor del contrato? ¿Cómo se estructura el pago? ¿Hay anticipos? ¿Hay conceptos variables o fijos? ¿Se menciona IVA u otros impuestos? Responde en JSON con estructura: {"aspectos_economicos": {"presupuesto_total": "...", "estructura_pago": "...", "anticipos": "...", "forma_pago": "...", "impuestos": "...", "conceptos": ["..."]}}',
    variables: [],
    display_order: 4
  },
  {
    key: 'contrato_parallel_5',
    name: 'Penalizaciones e Incentivos',
    description: 'Extrae penalizaciones e incentivos',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Extrae PENALIZACIONES, MULTAS E INCENTIVOS: ¿Qué penalizaciones hay por incumplimiento? ¿Cuándo se aplican? ¿Qué montos tienen? ¿Hay incentivos por cumplimiento anticipado o calidad superior? Responde en JSON con estructura: {"penalizaciones_incentivos": {"penalizaciones": [{"concepto": "...", "condicion": "...", "monto": "...", "severidad": "..."}], "incentivos": [{"concepto": "...", "condicion": "...", "beneficio": "..."}]}}',
    variables: [],
    display_order: 5
  },
  {
    key: 'contrato_parallel_6',
    name: 'Garantías y Seguros',
    description: 'Analiza garantías y seguros',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Analiza GARANTÍAS Y SEGUROS: ¿Qué garantías debe aportar el contratista? ¿Fianzas, avales, seguros? ¿Qué montos? ¿Por cuánto tiempo? ¿Garantía de obra? ¿Responsabilidad civil? Responde en JSON con estructura: {"garantias_seguros": {"garantias": [{"tipo": "...", "monto": "...", "duracion": "...", "descripcion": "..."}], "seguros_requeridos": [{"tipo": "...", "cobertura": "...", "monto_minimo": "..."}]}}',
    variables: [],
    display_order: 6
  },
  {
    key: 'contrato_parallel_7',
    name: 'Condiciones de Ejecución',
    description: 'Identifica condiciones de ejecución',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Identifica CONDICIONES DE EJECUCIÓN: ¿Dónde se ejecutará el trabajo? ¿Hay restricciones horarias? ¿Requisitos de seguridad? ¿Coordinación con otros contratistas? ¿Permisos necesarios? Responde en JSON con estructura: {"condiciones_ejecucion": {"ubicacion": "...", "horarios": "...", "seguridad": ["..."], "coordinacion": "...", "permisos": ["..."]}}',
    variables: [],
    display_order: 7
  },
  {
    key: 'contrato_parallel_8',
    name: 'Resolución y Rescisión',
    description: 'Analiza causas de resolución',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Analiza CAUSAS DE RESOLUCIÓN Y RESCISIÓN: ¿En qué casos se puede terminar el contrato? ¿Qué pasa si alguna parte incumple? ¿Hay cláusulas de salida? ¿Consecuencias de la rescisión? Responde en JSON con estructura: {"resolucion_rescision": {"causas": [{"tipo": "...", "descripcion": "...", "quien_puede_invocar": "..."}], "consecuencias": ["..."], "procedimiento": "..."}}',
    variables: [],
    display_order: 8
  },
  {
    key: 'contrato_parallel_9',
    name: 'Confidencialidad y Propiedad Intelectual',
    description: 'Extrae cláusulas de confidencialidad',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Extrae CONFIDENCIALIDAD, PROPIEDAD INTELECTUAL Y PROTECCIÓN DE DATOS: ¿Hay cláusulas de confidencialidad? ¿De quién es la propiedad intelectual? ¿Hay tratamiento de datos personales? ¿RGPD aplicable? Responde en JSON con estructura: {"confidencialidad_pi_datos": {"confidencialidad": {"alcance": "...", "duracion": "...", "excepciones": ["..."]}, "propiedad_intelectual": "...", "proteccion_datos": "..."}}',
    variables: [],
    display_order: 9
  },
  {
    key: 'contrato_parallel_10',
    name: 'Riesgos Legales y Recomendaciones',
    description: 'Identifica riesgos legales',
    category: 'contrato',
    prompt_type: 'parallel',
    prompt_text: 'Identifica RIESGOS LEGALES Y RECOMENDACIONES: ¿Qué cláusulas son más desfavorables para el contratista? ¿Qué aspectos son ambiguos o pueden generar conflictos? ¿Qué riesgos se identifican? ¿Qué se recomienda negociar o aclarar? Responde en JSON con estructura: {"riesgos_recomendaciones": {"riesgos": [{"tipo": "...", "descripcion": "...", "gravedad": "alta/media/baja", "probabilidad": "..."}], "clausulas_desfavorables": ["..."], "recomendaciones": ["..."]}}',
    variables: [],
    display_order: 10
  },
  // OFERTA
  {
    key: 'oferta_single',
    name: 'Generación de Oferta',
    description: 'Prompt para generar ofertas comerciales',
    category: 'oferta',
    prompt_type: 'single',
    prompt_text: `Eres un experto en redacción de propuestas técnicas y comerciales.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`,
    variables: ['contexto', 'cliente', 'observaciones'],
    display_order: 1
  },
  // DOCUMENTACIÓN
  {
    key: 'documentacion_single',
    name: 'Generación de Documentación',
    description: 'Prompt para generar documentación técnica',
    category: 'documentacion',
    prompt_type: 'single',
    prompt_text: `Eres un experto en redacción de documentación técnica.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`,
    variables: ['contexto', 'tipo_documento', 'titulo'],
    display_order: 1
  },
  // VAULT
  {
    key: 'vault_query',
    name: 'Chat con Codex Dilus',
    description: 'Prompt para consultas al Codex Dilus',
    category: 'vault',
    prompt_type: 'single',
    prompt_text: `Eres un asistente técnico experto en ingeniería y documentación técnica. 
Tienes acceso a una base de conocimiento corporativa (bóveda) con documentación técnica, normativas, manuales y datasheets.

Responde la siguiente pregunta del usuario basándote ÚNICAMENTE en el contexto proporcionado de la bóveda.
Si la información no está en el contexto, indica claramente que no tienes esa información en la bóveda.

CONTEXTO DE LA BÓVEDA:
{contexto}

PREGUNTA DEL USUARIO:
{pregunta}

Proporciona una respuesta clara, concisa y técnicamente precisa.`,
    variables: ['contexto', 'pregunta'],
    display_order: 1
  }
];

async function main() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Limpiar prompts existentes
    await client.query('DELETE FROM prompts');
    await client.query('DELETE FROM prompt_history');
    console.log('🗑️  Prompts antiguos eliminados');

    // Insertar prompts con codificación correcta
    let insertedCount = 0;
    for (const p of prompts) {
      await client.query(
        `INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
        [p.key, p.name, p.description, p.category, p.prompt_type, p.prompt_text, JSON.stringify(p.variables), p.display_order]
      );
      insertedCount++;
      console.log(`✓ Insertado: ${p.name}`);
    }

    console.log(`\n🎉 ¡Completado! ${insertedCount} prompts insertados correctamente con codificación UTF-8`);
    
    // Verificar un prompt
    const result = await client.query("SELECT name, substring(prompt_text, 1, 100) as preview FROM prompts WHERE key = 'pliego_tecnico_parallel_1'");
    console.log('\n📝 Verificación del prompt de prueba:');
    console.log(result.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main();

