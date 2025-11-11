"""
DILUS AI - OCR Service
Servicio de OCR para documentos escaneados usando Tesseract
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import os
import traceback

app = Flask(__name__)
CORS(app)

# Configuración de Tesseract
TESSERACT_CONFIG = '--oem 3 --psm 6'  # OCR Engine Mode 3 (default), Page Segmentation Mode 6 (uniform block of text)

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    try:
        # Verificar que Tesseract está disponible
        version = pytesseract.get_tesseract_version()
        languages = pytesseract.get_languages()
        
        return jsonify({
            'status': 'ok',
            'service': 'ocr-service',
            'tesseract_version': str(version),
            'available_languages': languages,
            'spanish_available': 'spa' in languages,
            'english_available': 'eng' in languages
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/ocr/pdf', methods=['POST'])
def ocr_pdf():
    """
    Procesar PDF escaneado con OCR
    
    Body:
        file: PDF file (multipart/form-data)
        language: 'spa' | 'eng' | 'spa+eng' (default: 'spa')
        dpi: int (default: 300)
    
    Returns:
        {
            'text': 'Texto extraído...',
            'pages': 10,
            'language': 'spa',
            'metadata': {...}
        }
    """
    try:
        # Validar que hay archivo
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        # Parámetros
        language = request.form.get('language', 'spa')  # español por defecto
        dpi = int(request.form.get('dpi', '300'))
        
        print(f"[OCR] Processing PDF: {file.filename}")
        print(f"[OCR] Language: {language}, DPI: {dpi}")
        
        # Leer archivo PDF
        pdf_bytes = file.read()
        
        if len(pdf_bytes) == 0:
            return jsonify({'error': 'Empty PDF file'}), 400
        
        print(f"[OCR] PDF size: {len(pdf_bytes)} bytes")
        
        # Convertir PDF a imágenes
        print("[OCR] Converting PDF pages to images...")
        images = convert_from_bytes(pdf_bytes, dpi=dpi)
        
        print(f"[OCR] Converted {len(images)} pages")
        
        # Aplicar OCR a cada página
        extracted_text = []
        page_metadata = []
        
        for i, image in enumerate(images):
            print(f"[OCR] Processing page {i+1}/{len(images)}...")
            
            try:
                # Aplicar OCR con el idioma especificado
                page_text = pytesseract.image_to_string(
                    image, 
                    lang=language,
                    config=TESSERACT_CONFIG
                )
                
                # Información de confianza (opcional)
                confidence_data = pytesseract.image_to_data(
                    image, 
                    lang=language,
                    output_type=pytesseract.Output.DICT
                )
                
                # Calcular confianza promedio
                confidences = [int(conf) for conf in confidence_data['conf'] if conf != '-1']
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                
                extracted_text.append(page_text)
                page_metadata.append({
                    'page': i + 1,
                    'text_length': len(page_text.strip()),
                    'avg_confidence': round(avg_confidence, 2),
                    'has_text': len(page_text.strip()) > 0
                })
                
                print(f"[OCR] Page {i+1}: {len(page_text.strip())} chars, confidence: {avg_confidence:.2f}%")
                
            except Exception as page_error:
                print(f"[OCR] Error processing page {i+1}: {str(page_error)}")
                extracted_text.append("")
                page_metadata.append({
                    'page': i + 1,
                    'error': str(page_error),
                    'has_text': False
                })
        
        # Combinar todo el texto
        full_text = '\n\n'.join(extracted_text)
        
        # Calcular estadísticas
        total_chars = len(full_text.strip())
        avg_confidence = sum(p.get('avg_confidence', 0) for p in page_metadata) / len(page_metadata)
        pages_with_text = sum(1 for p in page_metadata if p.get('has_text', False))
        
        print(f"[OCR] Extraction complete:")
        print(f"  - Total pages: {len(images)}")
        print(f"  - Pages with text: {pages_with_text}")
        print(f"  - Total characters: {total_chars}")
        print(f"  - Average confidence: {avg_confidence:.2f}%")
        
        return jsonify({
            'text': full_text,
            'pages': len(images),
            'pages_with_text': pages_with_text,
            'language': language,
            'dpi': dpi,
            'total_characters': total_chars,
            'avg_confidence': round(avg_confidence, 2),
            'page_metadata': page_metadata,
            'success': True
        })
        
    except Exception as e:
        error_details = {
            'error': str(e),
            'type': type(e).__name__,
            'traceback': traceback.format_exc()
        }
        print(f"[OCR] ERROR: {error_details}")
        return jsonify(error_details), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🔍 DILUS AI - OCR Service")
    print("=" * 60)
    print("📄 Tesseract OCR for scanned documents")
    print("🌍 Languages: Spanish (spa), English (eng)")
    print("🚀 Starting on port 8092...")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=8092, debug=True)




