import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger.js';

// Configuración de MinIO
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'dilus_admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'dilus_secret_2025'
  },
  forcePathStyle: true // Necesario para MinIO
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'dilus-ai';

/**
 * Función auxiliar para esperar un tiempo determinado
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inicializar MinIO (crear bucket si no existe) con reintentos automáticos
 */
export async function initMinIO() {
  const maxRetries = 10;
  const retryDelay = 2000; // 2 segundos entre reintentos
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🔄 Attempting to connect to MinIO (attempt ${attempt}/${maxRetries})...`);
      
      // Verificar si el bucket existe
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
      logger.info(`✅ MinIO bucket "${BUCKET_NAME}" exists`);
      
      // Conexión exitosa, salir del loop
      return;
      
    } catch (error) {
      if (error.name === 'NotFound') {
        // Bucket no existe, intentar crearlo
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
          logger.info(`✅ MinIO bucket "${BUCKET_NAME}" created`);
          return; // Bucket creado exitosamente
        } catch (createError) {
          // Error al crear bucket
          const errorMessage = createError.message || 'Unknown error';
          
          if (attempt === maxRetries) {
            logger.error(`❌ Failed to create MinIO bucket after ${maxRetries} attempts`, createError);
            throw createError;
          }
          
          logger.warn(`⚠️  MinIO bucket creation failed (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
          logger.info(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
          await sleep(retryDelay);
        }
      } else {
        // Error de conexión u otro error
        const errorMessage = error.message || 'Unknown error';
        
        if (attempt === maxRetries) {
          logger.error(`❌ Failed to connect to MinIO after ${maxRetries} attempts`, error);
          throw error;
        }
        
        logger.warn(`⚠️  MinIO connection failed (attempt ${attempt}/${maxRetries}): ${errorMessage}`);
        logger.info(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
        await sleep(retryDelay);
      }
    }
  }
}

/**
 * Subir archivo a MinIO
 */
export async function uploadFile(filename, buffer, mimetype, metadata = {}) {
  try {
    // Sanitizar nombre de archivo para evitar problemas con caracteres especiales
    // Preservar la extensión
    const extension = filename.substring(filename.lastIndexOf('.'));
    const baseName = filename.substring(0, filename.lastIndexOf('.'));
    
    // Reemplazar caracteres problemáticos pero mantener tildes, ñ, etc.
    const sanitizedBaseName = baseName
      .replace(/[<>:"|?*]/g, '_') // Solo reemplazar caracteres realmente problemáticos
      .trim();
    
    const sanitizedFilename = `${sanitizedBaseName}${extension}`;
    const key = `${Date.now()}_${sanitizedFilename}`;
    
    logger.debug('Uploading file to MinIO', { 
      originalFilename: filename,
      sanitizedKey: key,
      size: buffer.length,
      mimetype 
    });

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      Metadata: {
        ...metadata,
        originalFilename: filename // Guardar nombre original en metadata
      }
    }));

    logger.info('File uploaded to MinIO', { key, originalFilename: filename });

    return key;
  } catch (error) {
    logger.error('Error uploading file to MinIO', error);
    throw new Error(`Error al subir archivo a MinIO: ${error.message}`);
  }
}

/**
 * Obtener archivo de MinIO
 */
export async function getFile(key) {
  try {
    logger.debug('Getting file from MinIO', { key });

    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));

    // Convertir stream a buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    logger.info('File retrieved from MinIO', { 
      key, 
      size: buffer.length 
    });

    return buffer;
  } catch (error) {
    logger.error('Error getting file from MinIO', { key, error: error.message });
    throw new Error(`Error al obtener archivo de MinIO: ${error.message}`);
  }
}

/**
 * Eliminar archivo de MinIO
 */
export async function deleteFile(key) {
  try {
    logger.debug('Deleting file from MinIO', { key });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));

    logger.info('File deleted from MinIO', { key });
  } catch (error) {
    logger.error('Error deleting file from MinIO', { key, error: error.message });
    throw new Error(`Error al eliminar archivo de MinIO: ${error.message}`);
  }
}

/**
 * Generar URL firmada para descarga
 */
export async function getSignedDownloadUrl(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    logger.debug('Generated signed URL', { key, expiresIn });
    
    return url;
  } catch (error) {
    logger.error('Error generating signed URL', { key, error: error.message });
    throw new Error(`Error al generar URL de descarga: ${error.message}`);
  }
}

export default {
  initMinIO,
  uploadFile,
  getFile,
  deleteFile,
  getSignedDownloadUrl
};

