/**
 * BÚSQUEDA FUZZY - Sistema mejorado de detección de equipos
 * 
 * Este archivo contiene las funciones auxiliares para búsqueda fuzzy
 * Se integra con ragService.js
 */

/**
 * Construir condición SQL de filtrado fuzzy para múltiples variantes de equipo
 * 
 * @param {Array<string>} detectedEquipments - Array de variantes detectadas
 * @param {number} paramOffset - Offset inicial para parámetros SQL
 * @returns {Object} - { condition: string, params: Array }
 */
export function buildEquipmentFilterSQL(detectedEquipments, paramOffset) {
  if (!detectedEquipments || detectedEquipments.length === 0) {
    return { condition: '', params: [] };
  }
  
  // Crear condiciones OR para todas las variantes
  // Busca en equipo Y fabricante para máxima cobertura
  const conditions = [];
  const params = [];
  
  detectedEquipments.forEach((variant, idx) => {
    const paramIdx = paramOffset + (idx * 2);
    conditions.push(`(
      e.metadata->'doc'->>'equipo' ILIKE $${paramIdx} OR 
      e.metadata->'doc'->>'fabricante' ILIKE $${paramIdx + 1}
    )`);
    params.push(`%${variant}%`, `%${variant}%`);
  });
  
  return {
    condition: `AND (${conditions.join(' OR ')})`,
    params
  };
}

/**
 * Ejemplo de uso:
 * 
 * const detectedEquipments = ['razon+', 'razon', 'rason+', 'rason'];
 * const filter = buildEquipmentFilterSQL(detectedEquipments, 4);
 * 
 * // filter.condition = "AND ((e.metadata->'doc'->>'equipo' ILIKE $4 OR ...) OR ...)"
 * // filter.params = ['%razon+%', '%razon+%', '%razon%', '%razon%', ...]
 */

