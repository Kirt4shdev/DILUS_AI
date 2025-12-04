/**
 * Servicio para ejecutar análisis paralelos con mini-prompts
 */

import { searchInDocument } from './ragService.js';
import { generateWithGPT5Mini, generateWithGPT5Standard, parseAIResponse } from './aiService.js';
import { buildRagPrompt } from '../utils/parallelPrompts.js';
import { getConfigValue } from './ragConfigService.js';
import { getParallelPromptsForCategory } from './promptService.js';
import { logger } from '../utils/logger.js';

/**
 * Ejecutar análisis paralelo con múltiples mini-prompts
 * @param {Array} documentContexts - Array de {documentId, fullText, filename}
 * @param {string} analysisType - Tipo de análisis: pliego_tecnico, contrato, oferta, documentacion
 * @param {boolean} useStandard - Usar GPT-5 Standard o Mini
 * @param {Object} options - userId, projectId para logging
 * @returns {Object} Resultado con prompts individuales y resultado final
 */
export async function executeParallelAnalysis(documentContexts, analysisType, useStandard = false, options = {}) {
  const startTime = Date.now();
  const { userId, projectId } = options;

  try {
    // Obtener prompts específicos para este tipo de análisis desde la BD
    const promptsFromDB = await getParallelPromptsForCategory(analysisType);
    
    // Convertir formato de BD al formato esperado
    const prompts = promptsFromDB.map(p => ({
      id: p.key,
      pregunta: p.prompt_text,
      campo_resultado: p.name.toLowerCase().replace(/\s+/g, '_')
    }));
    
    // Obtener configuración de RAG desde la base de datos (topK configurado por el administrador)
    const topK = await getConfigValue('top_k', 5); // Default 5 si no está configurado
    
    logger.info(`Starting parallel analysis`, {
      analysisType,
      promptCount: prompts.length,
      documentCount: documentContexts.length,
      model: useStandard ? 'gpt-5' : 'gpt-5-mini',
      topK: topK,
      configSource: 'database'
    });

    // Array para almacenar resultados de cada prompt
    const promptResults = [];

    // Ejecutar todos los prompts en paralelo
    const parallelPromises = prompts.map(async (promptConfig) => {
      const promptStartTime = Date.now();
      
      try {
        // Para cada prompt, obtener contexto relevante mediante RAG de todos los documentos
        const ragContexts = await Promise.all(
          documentContexts.map(async (docContext) => {
            // Usar RAG para obtener chunks relevantes para esta pregunta específica
            // Aumentamos topK para obtener más contexto
            const searchResult = await searchInDocument(
              docContext.documentId, 
              promptConfig.pregunta,
              { userId, projectId, topK }
            );
            
            const chunks = searchResult.chunks || [];
            const ragText = chunks.map(c => c.chunk_text).join('\n\n');
            
            return {
              filename: docContext.filename,
              text: ragText,
              chunksUsed: chunks.length
            };
          })
        );

        // Combinar contextos de todos los documentos
        const combinedContext = ragContexts
          .map(ctx => `[${ctx.filename}]:\n${ctx.text}`)
          .join('\n\n---\n\n');

        // Crear prompt completo con contexto RAG
        const fullPrompt = buildRagPrompt(combinedContext, promptConfig.pregunta);

        // Ejecutar consulta a IA
        const aiResponse = useStandard 
          ? await generateWithGPT5Standard(fullPrompt)
          : await generateWithGPT5Mini(fullPrompt);

        const promptDuration = Date.now() - promptStartTime;
        
        // Parsear respuesta JSON
        const parsedResult = parseAIResponse(aiResponse.result);

        const result = {
          prompt_id: promptConfig.id,
          pregunta: promptConfig.pregunta,
          campo_resultado: promptConfig.campo_resultado,
          respuesta: parsedResult,
          metadata: {
            duracion_ms: promptDuration,
            tokens_usados: aiResponse.tokensUsed,
            tokens_input: aiResponse.tokensInput,
            tokens_output: aiResponse.tokensOutput,
            modelo: aiResponse.model,
            chunks_utilizados: ragContexts.reduce((sum, ctx) => sum + ctx.chunksUsed, 0),
            documentos_consultados: ragContexts.length
          }
        };

        logger.info(`Prompt ${promptConfig.id} completed`, {
          duration: promptDuration,
          tokens: aiResponse.tokensUsed
        });

        return result;
      } catch (error) {
        logger.error(`Error in prompt ${promptConfig.id}`, { error: error.message });
        
        return {
          prompt_id: promptConfig.id,
          pregunta: promptConfig.pregunta,
          campo_resultado: promptConfig.campo_resultado,
          respuesta: { error: error.message },
          metadata: {
            duracion_ms: Date.now() - promptStartTime,
            tokens_usados: 0,
            error: true
          }
        };
      }
    });

    // Esperar a que todos los prompts se completen
    const allResults = await Promise.all(parallelPromises);
    
    const totalDuration = Date.now() - startTime;

    // Montar resultado final consolidado
    const resultadoFinal = {};
    allResults.forEach(result => {
      if (!result.respuesta.error) {
        resultadoFinal[result.campo_resultado] = result.respuesta[result.campo_resultado] || result.respuesta;
      }
    });

    // Calcular estadísticas totales
    const totalTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_usados || 0), 0);
    const totalInputTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_input || 0), 0);
    const totalOutputTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_output || 0), 0);
    const totalChunks = allResults.reduce((sum, r) => sum + (r.metadata.chunks_utilizados || 0), 0);

    const resultado = {
      analisis_tipo: analysisType,
      metodo: 'parallel_prompts',
      prompts_ejecutados: allResults.length,
      resultado_individual_prompts: allResults,
      resultado_final_consolidado: resultadoFinal,
      metadata_global: {
        duracion_total_ms: totalDuration,
        duracion_promedio_por_prompt_ms: Math.round(totalDuration / allResults.length),
        tokens_totales: totalTokens,
        tokens_input_totales: totalInputTokens,
        tokens_output_totales: totalOutputTokens,
        chunks_totales_utilizados: totalChunks,
        modelo_utilizado: useStandard ? 'gpt-5' : 'gpt-5-mini',
        prompts_exitosos: allResults.filter(r => !r.metadata.error).length,
        prompts_con_error: allResults.filter(r => r.metadata.error).length
      }
    };

    logger.info(`Parallel analysis completed`, {
      analysisType,
      totalDuration,
      totalTokens,
      promptsExecuted: allResults.length
    });

    return resultado;
  } catch (error) {
    logger.error(`Error in parallel analysis`, { error: error.message });
    throw error;
  }
}

/**
 * Ejecutar análisis paralelo simplificado (sin RAG, usando texto completo)
 * Útil cuando los documentos son pequeños y caben en contexto
 */
export async function executeParallelAnalysisSimple(fullContext, analysisType, useStandard = false) {
  const startTime = Date.now();

  try {
    // Obtener prompts desde la BD
    const promptsFromDB = await getParallelPromptsForCategory(analysisType);
    
    // Convertir formato de BD al formato esperado
    const prompts = promptsFromDB.map(p => ({
      id: p.key,
      pregunta: p.prompt_text,
      campo_resultado: p.name.toLowerCase().replace(/\s+/g, '_')
    }));
    
    logger.info(`Starting simple parallel analysis`, {
      analysisType,
      promptCount: prompts.length,
      model: useStandard ? 'gpt-5' : 'gpt-5-mini'
    });

    // Ejecutar todos los prompts en paralelo con el mismo contexto completo
    const parallelPromises = prompts.map(async (promptConfig) => {
      const promptStartTime = Date.now();
      
      try {
        const fullPrompt = buildRagPrompt(fullContext, promptConfig.pregunta);

        const aiResponse = useStandard 
          ? await generateWithGPT5Standard(fullPrompt)
          : await generateWithGPT5Mini(fullPrompt);

        const promptDuration = Date.now() - promptStartTime;
        const parsedResult = parseAIResponse(aiResponse.result);

        logger.info(`Prompt ${promptConfig.id} completed`, {
          duration: promptDuration,
          tokens: aiResponse.tokensUsed
        });

        return {
          prompt_id: promptConfig.id,
          pregunta: promptConfig.pregunta,
          campo_resultado: promptConfig.campo_resultado,
          respuesta: parsedResult,
          metadata: {
            duracion_ms: promptDuration,
            tokens_usados: aiResponse.tokensUsed,
            tokens_input: aiResponse.tokensInput,
            tokens_output: aiResponse.tokensOutput,
            modelo: aiResponse.model
          }
        };
      } catch (error) {
        logger.error(`Error in prompt ${promptConfig.id}`, { error: error.message });
        
        return {
          prompt_id: promptConfig.id,
          pregunta: promptConfig.pregunta,
          campo_resultado: promptConfig.campo_resultado,
          respuesta: { error: error.message },
          metadata: {
            duracion_ms: Date.now() - promptStartTime,
            tokens_usados: 0,
            error: true
          }
        };
      }
    });

    const allResults = await Promise.all(parallelPromises);
    const totalDuration = Date.now() - startTime;

    // Montar resultado final
    const resultadoFinal = {};
    allResults.forEach(result => {
      if (!result.respuesta.error) {
        resultadoFinal[result.campo_resultado] = result.respuesta[result.campo_resultado] || result.respuesta;
      }
    });

    const totalTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_usados || 0), 0);
    const totalInputTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_input || 0), 0);
    const totalOutputTokens = allResults.reduce((sum, r) => sum + (r.metadata.tokens_output || 0), 0);

    return {
      analisis_tipo: analysisType,
      metodo: 'parallel_prompts_simple',
      prompts_ejecutados: allResults.length,
      resultado_individual_prompts: allResults,
      resultado_final_consolidado: resultadoFinal,
      metadata_global: {
        duracion_total_ms: totalDuration,
        duracion_promedio_por_prompt_ms: Math.round(totalDuration / allResults.length),
        tokens_totales: totalTokens,
        tokens_input_totales: totalInputTokens,
        tokens_output_totales: totalOutputTokens,
        modelo_utilizado: useStandard ? 'gpt-5' : 'gpt-5-mini',
        prompts_exitosos: allResults.filter(r => !r.metadata.error).length,
        prompts_con_error: allResults.filter(r => r.metadata.error).length
      }
    };
  } catch (error) {
    logger.error(`Error in simple parallel analysis`, { error: error.message });
    throw error;
  }
}

export default {
  executeParallelAnalysis,
  executeParallelAnalysisSimple
};


