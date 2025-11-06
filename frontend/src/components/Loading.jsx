import React from 'react';

export default function Loading({ message = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600"></div>
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

