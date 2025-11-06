import React from 'react';
import { AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

export default function Alert({ type = 'info', message, onClose }) {
  const config = {
    success: {
      icon: CheckCircle,
      bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      textClass: 'text-green-800 dark:text-green-300',
      iconClass: 'text-green-600 dark:text-green-400'
    },
    error: {
      icon: XCircle,
      bgClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      textClass: 'text-red-800 dark:text-red-300',
      iconClass: 'text-red-600 dark:text-red-400'
    },
    warning: {
      icon: AlertCircle,
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      textClass: 'text-yellow-800 dark:text-yellow-300',
      iconClass: 'text-yellow-600 dark:text-yellow-400'
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      textClass: 'text-blue-800 dark:text-blue-300',
      iconClass: 'text-blue-600 dark:text-blue-400'
    }
  };

  const { icon: Icon, bgClass, textClass, iconClass } = config[type];

  return (
    <div className={`flex items-start p-4 rounded-lg border ${bgClass} ${textClass}`}>
      <Icon className={`w-5 h-5 mr-3 mt-0.5 ${iconClass}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-3 hover:opacity-70 transition-opacity"
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

