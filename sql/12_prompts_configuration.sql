-- ============================================
-- Tabla para configuración de prompts
-- ============================================

CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'pliego_tecnico', 'contrato', 'oferta', 'documentacion', 'vault'
  prompt_type VARCHAR(50) NOT NULL, -- 'single' para prompts únicos, 'parallel' para prompts paralelos
  prompt_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Array de variables que acepta el prompt ej: ["texto", "cliente"]
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active);

-- Tabla para historial de cambios de prompts
CREATE TABLE IF NOT EXISTS prompt_history (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_text_old TEXT,
  prompt_text_new TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_reason TEXT
);

-- Índice para historial
CREATE INDEX IF NOT EXISTS idx_prompt_history_prompt_id ON prompt_history(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_changed_at ON prompt_history(changed_at DESC);

-- ============================================
-- Insertar prompts por defecto
-- ============================================

-- PLIEGO TÉCNICO - Prompt único
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'pliego_tecnico_single',
  'Análisis de Pliego Técnico (1 consulta)',
  'Prompt para analizar pliegos técnicos en una sola consulta',
  'pliego_tecnico',
  'single',
  'Eres un experto en análisis de pliegos técnicos de ingeniería. 

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.',
  '["texto"]'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

-- PLIEGO TÉCNICO - Prompts paralelos (10 consultas)
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'pliego_tecnico_parallel_1',
  'Estaciones de Monitoreo',
  'Extrae información sobre estaciones de monitoreo',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre estaciones de monitoreo: número de estaciones, ubicaciones exactas, coordenadas si están disponibles. Responde en JSON con estructura: {"estaciones": [{"nombre": "...", "ubicacion": "...", "coordenadas": "..."}], "total": 0}',
  '[]'::jsonb,
  1
),
(
  'pliego_tecnico_parallel_2',
  'Sensores',
  'Extrae información sobre sensores a instalar',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre sensores a instalar: tipos de sensores, modelos específicos, marcas requeridas. Responde en JSON con estructura: {"sensores": [{"tipo": "...", "modelo": "...", "marca": "..."}]}',
  '[]'::jsonb,
  2
),
(
  'pliego_tecnico_parallel_3',
  'Especificaciones Técnicas',
  'Extrae rangos de medición y precisiones',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre rangos de medición y precisiones requeridas para cada sensor o equipo. Responde en JSON con estructura: {"especificaciones": [{"equipo": "...", "rango": "...", "precision": "...", "unidad": "..."}]}',
  '[]'::jsonb,
  3
),
(
  'pliego_tecnico_parallel_4',
  'Distancias',
  'Calcula o extrae distancias desde Madrid',
  'pliego_tecnico',
  'parallel',
  'Calcula o extrae ÚNICAMENTE las distancias desde Madrid a las ubicaciones mencionadas en el documento. Si no hay información explícita, indica "No especificado". Responde en JSON con estructura: {"distancias": [{"ubicacion": "...", "distancia_desde_madrid": "...", "unidad": "km"}]}',
  '[]'::jsonb,
  4
),
(
  'pliego_tecnico_parallel_5',
  'Plazos de Instalación',
  'Extrae tiempos y plazos',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre tiempos y plazos de instalación: duración estimada, plazos de entrega, hitos temporales. Responde en JSON con estructura: {"plazos": {"instalacion": "...", "entrega": "...", "hitos": [{"nombre": "...", "plazo": "..."}]}}',
  '[]'::jsonb,
  5
),
(
  'pliego_tecnico_parallel_6',
  'Normativas',
  'Extrae normativas aplicables',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre normativas aplicables: normas técnicas, regulaciones, estándares que debe cumplir el proyecto. Responde en JSON con estructura: {"normativas": [{"codigo": "...", "descripcion": "...", "ambito": "..."}]}',
  '[]'::jsonb,
  6
),
(
  'pliego_tecnico_parallel_7',
  'Conectividad',
  'Extrae requisitos de conectividad',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre requisitos de conectividad y comunicaciones: protocolos, redes, sistemas SCADA, transmisión de datos. Responde en JSON con estructura: {"conectividad": {"protocolo": "...", "tipo_red": "...", "sistema_scada": "...", "requisitos_adicionales": []}}',
  '[]'::jsonb,
  7
),
(
  'pliego_tecnico_parallel_8',
  'Alimentación Eléctrica',
  'Extrae requisitos de alimentación',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre requisitos de alimentación eléctrica: tensiones, potencias, sistemas de respaldo, baterías. Responde en JSON con estructura: {"alimentacion": {"tension": "...", "potencia": "...", "respaldo": "...", "autonomia": "..."}}',
  '[]'::jsonb,
  8
),
(
  'pliego_tecnico_parallel_9',
  'Garantía y Mantenimiento',
  'Extrae información sobre garantías',
  'pliego_tecnico',
  'parallel',
  'Extrae ÚNICAMENTE información sobre garantías, mantenimiento y soporte técnico requeridos. Responde en JSON con estructura: {"garantia_mantenimiento": {"periodo_garantia": "...", "mantenimiento_preventivo": "...", "soporte_tecnico": "...", "formacion": "..."}}',
  '[]'::jsonb,
  9
),
(
  'pliego_tecnico_parallel_10',
  'Riesgos',
  'Identifica riesgos del proyecto',
  'pliego_tecnico',
  'parallel',
  'Identifica ÚNICAMENTE los principales riesgos técnicos, ambientales o logísticos del proyecto y sus mitigaciones propuestas. Responde en JSON con estructura: {"riesgos": [{"tipo": "...", "descripcion": "...", "impacto": "alto/medio/bajo", "mitigacion": "..."}]}',
  '[]'::jsonb,
  10
) ON CONFLICT (key) DO NOTHING;

-- CONTRATO - Prompt único
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'contrato_single',
  'Análisis de Contrato (1 consulta)',
  'Prompt para analizar contratos en una sola consulta',
  'contrato',
  'single',
  'Eres un experto legal en contratos de ingeniería.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.',
  '["texto"]'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

-- CONTRATO - Prompts paralelos (10 consultas)
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'contrato_parallel_1',
  'Objeto del Contrato',
  'Analiza el objeto del contrato',
  'contrato',
  'parallel',
  'Analiza el contrato y extrae información sobre el OBJETO DEL CONTRATO: ¿Qué se está contratando? ¿Cuál es el alcance del trabajo? ¿Qué servicios o productos incluye? ¿Hay exclusiones específicas? Responde en JSON con estructura: {"objeto_contrato": {"descripcion": "...", "alcance": "...", "servicios_incluidos": ["..."], "exclusiones": ["..."]}}',
  '[]'::jsonb,
  1
),
(
  'contrato_parallel_2',
  'Obligaciones del Contratista',
  'Extrae obligaciones del contratista',
  'contrato',
  'parallel',
  'Extrae las OBLIGACIONES DEL CONTRATISTA: ¿Qué debe hacer el contratista? ¿Qué entregables debe proporcionar? ¿Qué estándares de calidad debe cumplir? ¿Hay certificaciones requeridas? Responde en JSON con estructura: {"obligaciones_contratista": [{"tipo": "...", "descripcion": "...", "entregable": "...", "estandar_calidad": "...", "importancia": "crítica/alta/media"}]}',
  '[]'::jsonb,
  2
),
(
  'contrato_parallel_3',
  'Plazos y Cronograma',
  'Analiza plazos y cronograma',
  'contrato',
  'parallel',
  'Analiza PLAZOS Y CRONOGRAMA: ¿Cuándo inicia y termina el contrato? ¿Qué hitos intermedios hay? ¿Hay plazos parciales de entrega? ¿Cuál es el plazo de ejecución? Responde en JSON con estructura: {"plazos": {"fecha_inicio": "...", "fecha_fin": "...", "duracion": "...", "hitos": [{"nombre": "...", "fecha": "...", "descripcion": "..."}], "plazos_parciales": ["..."]}}',
  '[]'::jsonb,
  3
),
(
  'contrato_parallel_4',
  'Aspectos Económicos',
  'Identifica aspectos económicos',
  'contrato',
  'parallel',
  'Identifica ASPECTOS ECONÓMICOS: ¿Cuál es el presupuesto o valor del contrato? ¿Cómo se estructura el pago? ¿Hay anticipos? ¿Hay conceptos variables o fijos? ¿Se menciona IVA u otros impuestos? Responde en JSON con estructura: {"aspectos_economicos": {"presupuesto_total": "...", "estructura_pago": "...", "anticipos": "...", "forma_pago": "...", "impuestos": "...", "conceptos": ["..."]}}',
  '[]'::jsonb,
  4
),
(
  'contrato_parallel_5',
  'Penalizaciones e Incentivos',
  'Extrae penalizaciones e incentivos',
  'contrato',
  'parallel',
  'Extrae PENALIZACIONES, MULTAS E INCENTIVOS: ¿Qué penalizaciones hay por incumplimiento? ¿Cuándo se aplican? ¿Qué montos tienen? ¿Hay incentivos por cumplimiento anticipado o calidad superior? Responde en JSON con estructura: {"penalizaciones_incentivos": {"penalizaciones": [{"concepto": "...", "condicion": "...", "monto": "...", "severidad": "..."}], "incentivos": [{"concepto": "...", "condicion": "...", "beneficio": "..."}]}}',
  '[]'::jsonb,
  5
),
(
  'contrato_parallel_6',
  'Garantías y Seguros',
  'Analiza garantías y seguros',
  'contrato',
  'parallel',
  'Analiza GARANTÍAS Y SEGUROS: ¿Qué garantías debe aportar el contratista? ¿Fianzas, avales, seguros? ¿Qué montos? ¿Por cuánto tiempo? ¿Garantía de obra? ¿Responsabilidad civil? Responde en JSON con estructura: {"garantias_seguros": {"garantias": [{"tipo": "...", "monto": "...", "duracion": "...", "descripcion": "..."}], "seguros_requeridos": [{"tipo": "...", "cobertura": "...", "monto_minimo": "..."}]}}',
  '[]'::jsonb,
  6
),
(
  'contrato_parallel_7',
  'Condiciones de Ejecución',
  'Identifica condiciones de ejecución',
  'contrato',
  'parallel',
  'Identifica CONDICIONES DE EJECUCIÓN: ¿Dónde se ejecutará el trabajo? ¿Hay restricciones horarias? ¿Requisitos de seguridad? ¿Coordinación con otros contratistas? ¿Permisos necesarios? Responde en JSON con estructura: {"condiciones_ejecucion": {"ubicacion": "...", "horarios": "...", "seguridad": ["..."], "coordinacion": "...", "permisos": ["..."]}}',
  '[]'::jsonb,
  7
),
(
  'contrato_parallel_8',
  'Resolución y Rescisión',
  'Analiza causas de resolución',
  'contrato',
  'parallel',
  'Analiza CAUSAS DE RESOLUCIÓN Y RESCISIÓN: ¿En qué casos se puede terminar el contrato? ¿Qué pasa si alguna parte incumple? ¿Hay cláusulas de salida? ¿Consecuencias de la rescisión? Responde en JSON con estructura: {"resolucion_rescision": {"causas": [{"tipo": "...", "descripcion": "...", "quien_puede_invocar": "..."}], "consecuencias": ["..."], "procedimiento": "..."}}',
  '[]'::jsonb,
  8
),
(
  'contrato_parallel_9',
  'Confidencialidad y Propiedad Intelectual',
  'Extrae cláusulas de confidencialidad',
  'contrato',
  'parallel',
  'Extrae CONFIDENCIALIDAD, PROPIEDAD INTELECTUAL Y PROTECCIÓN DE DATOS: ¿Hay cláusulas de confidencialidad? ¿De quién es la propiedad intelectual? ¿Hay tratamiento de datos personales? ¿RGPD aplicable? Responde en JSON con estructura: {"confidencialidad_pi_datos": {"confidencialidad": {"alcance": "...", "duracion": "...", "excepciones": ["..."]}, "propiedad_intelectual": "...", "proteccion_datos": "..."}}',
  '[]'::jsonb,
  9
),
(
  'contrato_parallel_10',
  'Riesgos Legales y Recomendaciones',
  'Identifica riesgos legales',
  'contrato',
  'parallel',
  'Identifica RIESGOS LEGALES Y RECOMENDACIONES: ¿Qué cláusulas son más desfavorables para el contratista? ¿Qué aspectos son ambiguos o pueden generar conflictos? ¿Qué riesgos se identifican? ¿Qué se recomienda negociar o aclarar? Responde en JSON con estructura: {"riesgos_recomendaciones": {"riesgos": [{"tipo": "...", "descripcion": "...", "gravedad": "alta/media/baja", "probabilidad": "..."}], "clausulas_desfavorables": ["..."], "recomendaciones": ["..."]}}',
  '[]'::jsonb,
  10
) ON CONFLICT (key) DO NOTHING;

-- OFERTA - Prompt único
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'oferta_single',
  'Generación de Oferta',
  'Prompt para generar ofertas comerciales',
  'oferta',
  'single',
  'Eres un experto en redacción de propuestas técnicas y comerciales.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.',
  '["contexto", "cliente", "observaciones"]'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

-- DOCUMENTACIÓN - Prompt único
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'documentacion_single',
  'Generación de Documentación',
  'Prompt para generar documentación técnica',
  'documentacion',
  'single',
  'Eres un experto en redacción de documentación técnica.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.',
  '["contexto", "tipo_documento", "titulo"]'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

-- VAULT (Codex Dilus) - Prompt único
INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order) VALUES
(
  'vault_query',
  'Chat con Codex Dilus',
  'Prompt para consultas al Codex Dilus',
  'vault',
  'single',
  'Eres un asistente técnico experto en ingeniería y documentación técnica. 
Tienes acceso a una base de conocimiento corporativa (bóveda) con documentación técnica, normativas, manuales y datasheets.

Responde la siguiente pregunta del usuario basándote ÚNICAMENTE en el contexto proporcionado de la bóveda.
Si la información no está en el contexto, indica claramente que no tienes esa información en la bóveda.

CONTEXTO DE LA BÓVEDA:
{contexto}

PREGUNTA DEL USUARIO:
{pregunta}

Proporciona una respuesta clara, concisa y técnicamente precisa.',
  '["contexto", "pregunta"]'::jsonb,
  1
) ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Función para actualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS trigger_update_prompts_updated_at ON prompts;
CREATE TRIGGER trigger_update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- ============================================
-- Comentarios para documentación
-- ============================================
COMMENT ON TABLE prompts IS 'Configuración de prompts del sistema';
COMMENT ON COLUMN prompts.key IS 'Identificador único del prompt';
COMMENT ON COLUMN prompts.category IS 'Categoría del prompt: pliego_tecnico, contrato, oferta, documentacion, vault';
COMMENT ON COLUMN prompts.prompt_type IS 'Tipo: single (una consulta) o parallel (múltiples consultas en paralelo)';
COMMENT ON COLUMN prompts.variables IS 'Variables que acepta el prompt en formato JSON array';

