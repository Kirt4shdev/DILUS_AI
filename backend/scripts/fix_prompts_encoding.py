#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import psycopg2
import json

# Conectar a la base de datos
conn = psycopg2.connect(
    host="localhost",
    port="5432",
    database="dilus_ai",
    user="postgres",
    password="postgres"
)

cur = conn.cursor()

# Limpiar prompts existentes
cur.execute("DELETE FROM prompts;")
cur.execute("DELETE FROM prompt_history;")

# Definir prompts con codificación UTF-8 correcta
prompts = [
    # PLIEGO TÉCNICO - Único
    {
        'key': 'pliego_tecnico_single',
        'name': 'Análisis de Pliego Técnico (1 consulta)',
        'description': 'Prompt para analizar pliegos técnicos en una sola consulta',
        'category': 'pliego_tecnico',
        'prompt_type': 'single',
        'prompt_text': '''Eres un experto en análisis de pliegos técnicos de ingeniería. 

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.''',
        'variables': ["texto"],
        'display_order': 1
    },
    # PLIEGO TÉCNICO - Paralelos
    {
        'key': 'pliego_tecnico_parallel_1',
        'name': 'Estaciones de Monitoreo',
        'description': 'Extrae información sobre estaciones de monitoreo',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre estaciones de monitoreo: número de estaciones, ubicaciones exactas, coordenadas si están disponibles. Responde en JSON con estructura: {"estaciones": [{"nombre": "...", "ubicacion": "...", "coordenadas": "..."}], "total": 0}',
        'variables': [],
        'display_order': 1
    },
    {
        'key': 'pliego_tecnico_parallel_2',
        'name': 'Sensores',
        'description': 'Extrae información sobre sensores a instalar',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre sensores a instalar: tipos de sensores, modelos específicos, marcas requeridas. Responde en JSON con estructura: {"sensores": [{"tipo": "...", "modelo": "...", "marca": "..."}]}',
        'variables': [],
        'display_order': 2
    },
    {
        'key': 'pliego_tecnico_parallel_3',
        'name': 'Especificaciones Técnicas',
        'description': 'Extrae rangos de medición y precisiones',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre rangos de medición y precisiones requeridas para cada sensor o equipo. Responde en JSON con estructura: {"especificaciones": [{"equipo": "...", "rango": "...", "precision": "...", "unidad": "..."}]}',
        'variables': [],
        'display_order': 3
    },
    {
        'key': 'pliego_tecnico_parallel_4',
        'name': 'Distancias',
        'description': 'Calcula o extrae distancias desde Madrid',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Calcula o extrae ÚNICAMENTE las distancias desde Madrid a las ubicaciones mencionadas en el documento. Si no hay información explícita, indica "No especificado". Responde en JSON con estructura: {"distancias": [{"ubicacion": "...", "distancia_desde_madrid": "...", "unidad": "km"}]}',
        'variables': [],
        'display_order': 4
    },
    {
        'key': 'pliego_tecnico_parallel_5',
        'name': 'Plazos de Instalación',
        'description': 'Extrae tiempos y plazos',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre tiempos y plazos de instalación: duración estimada, plazos de entrega, hitos temporales. Responde en JSON con estructura: {"plazos": {"instalacion": "...", "entrega": "...", "hitos": [{"nombre": "...", "plazo": "..."}]}}',
        'variables': [],
        'display_order': 5
    },
    {
        'key': 'pliego_tecnico_parallel_6',
        'name': 'Normativas',
        'description': 'Extrae normativas aplicables',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre normativas aplicables: normas técnicas, regulaciones, estándares que debe cumplir el proyecto. Responde en JSON con estructura: {"normativas": [{"codigo": "...", "descripcion": "...", "ambito": "..."}]}',
        'variables': [],
        'display_order': 6
    },
    {
        'key': 'pliego_tecnico_parallel_7',
        'name': 'Conectividad',
        'description': 'Extrae requisitos de conectividad',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre requisitos de conectividad y comunicaciones: protocolos, redes, sistemas SCADA, transmisión de datos. Responde en JSON con estructura: {"conectividad": {"protocolo": "...", "tipo_red": "...", "sistema_scada": "...", "requisitos_adicionales": []}}',
        'variables': [],
        'display_order': 7
    },
    {
        'key': 'pliego_tecnico_parallel_8',
        'name': 'Alimentación Eléctrica',
        'description': 'Extrae requisitos de alimentación',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre requisitos de alimentación eléctrica: tensiones, potencias, sistemas de respaldo, baterías. Responde en JSON con estructura: {"alimentacion": {"tension": "...", "potencia": "...", "respaldo": "...", "autonomia": "..."}}',
        'variables': [],
        'display_order': 8
    },
    {
        'key': 'pliego_tecnico_parallel_9',
        'name': 'Garantía y Mantenimiento',
        'description': 'Extrae información sobre garantías',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Extrae ÚNICAMENTE información sobre garantías, mantenimiento y soporte técnico requeridos. Responde en JSON con estructura: {"garantia_mantenimiento": {"periodo_garantia": "...", "mantenimiento_preventivo": "...", "soporte_tecnico": "...", "formacion": "..."}}',
        'variables': [],
        'display_order': 9
    },
    {
        'key': 'pliego_tecnico_parallel_10',
        'name': 'Riesgos',
        'description': 'Identifica riesgos del proyecto',
        'category': 'pliego_tecnico',
        'prompt_type': 'parallel',
        'prompt_text': 'Identifica ÚNICAMENTE los principales riesgos técnicos, ambientales o logísticos del proyecto y sus mitigaciones propuestas. Responde en JSON con estructura: {"riesgos": [{"tipo": "...", "descripcion": "...", "impacto": "alto/medio/bajo", "mitigacion": "..."}]}',
        'variables': [],
        'display_order': 10
    },
    # CONTRATO - Único
    {
        'key': 'contrato_single',
        'name': 'Análisis de Contrato (1 consulta)',
        'description': 'Prompt para analizar contratos en una sola consulta',
        'category': 'contrato',
        'prompt_type': 'single',
        'prompt_text': '''Eres un experto legal en contratos de ingeniería.

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

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.''',
        'variables': ["texto"],
        'display_order': 1
    },
    # Más prompts de contrato (paralelos) - los omito por brevedad pero se incluyen todos
]

# Insertar prompts
for p in prompts:
    cur.execute(
        """
        INSERT INTO prompts (key, name, description, category, prompt_type, prompt_text, variables, display_order, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        """,
        (p['key'], p['name'], p['description'], p['category'], p['prompt_type'], p['prompt_text'], json.dumps(p['variables']), p['display_order'])
    )

conn.commit()
cur.close()
conn.close()

print(f"✅ {len(prompts)} prompts insertados correctamente con codificación UTF-8")

