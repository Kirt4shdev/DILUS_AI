/**
 * Validadores de entrada
 */

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateUsername(username) {
  // Alfanumérico, guiones y underscores, 3-50 caracteres
  const re = /^[a-zA-Z0-9_-]{3,50}$/;
  return re.test(username);
}

export function validatePassword(password) {
  // Mínimo 6 caracteres
  return password && password.length >= 6;
}

export function validateProjectName(name) {
  return name && name.trim().length >= 3 && name.trim().length <= 255;
}

export function validateFileType(mimetype) {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  return allowedTypes.includes(mimetype);
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

