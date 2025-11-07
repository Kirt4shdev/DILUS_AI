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
 * Inicializar MinIO (crear bucket si no existe)
 */
export async function initMinIO() {
  try {
    // Verificar si el bucket existe
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    logger.info(`✅ MinIO bucket "${BUCKET_NAME}" exists`);
  } catch (error) {
    if (error.name === 'NotFound') {
      // Crear bucket
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        logger.info(`✅ MinIO bucket "${BUCKET_NAME}" created`);
      } catch (createError) {
        logger.error('Error creating MinIO bucket', createError);
        throw createError;
      }
    } else {
      logger.error('Error checking MinIO bucket', error);
      throw error;
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

