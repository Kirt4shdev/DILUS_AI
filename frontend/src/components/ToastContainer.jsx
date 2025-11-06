import React from 'react';
import Toast from './Toast';

export default function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-3 pointer-events-none">
      <div className="pointer-events-auto flex flex-col space-y-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

