import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ id, type, message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const types = {
    success: {
      icon: CheckCircle,
      className: 'bg-green-100 dark:bg-green-900/80 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100',
      iconColor: 'text-green-700 dark:text-green-300'
    },
    error: {
      icon: XCircle,
      className: 'bg-red-100 dark:bg-red-900/80 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100',
      iconColor: 'text-red-700 dark:text-red-300'
    },
    warning: {
      icon: AlertCircle,
      className: 'bg-yellow-100 dark:bg-yellow-900/80 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-700 dark:text-yellow-300'
    },
    info: {
      icon: Info,
      className: 'bg-blue-100 dark:bg-blue-900/80 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100',
      iconColor: 'text-blue-700 dark:text-blue-300'
    }
  };

  const config = types[type] || types.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        flex items-start space-x-3 p-4 rounded-lg border shadow-lg
        ${config.className}
        animate-slide-in-right
        min-w-[320px] max-w-md
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">
          {message}
        </p>
      </div>

      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

