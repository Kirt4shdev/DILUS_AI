import React, { createContext, useState, useContext, useCallback } from 'react';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext();

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type, message, duration = 5000 }) => {
    const id = Date.now() + Math.random();
    const newToast = { id, type, message, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration) => {
    return addToast({ type: 'success', message, duration });
  }, [addToast]);

  const error = useCallback((message, duration) => {
    return addToast({ type: 'error', message, duration });
  }, [addToast]);

  const warning = useCallback((message, duration) => {
    return addToast({ type: 'warning', message, duration });
  }, [addToast]);

  const info = useCallback((message, duration) => {
    return addToast({ type: 'info', message, duration });
  }, [addToast]);

  const value = {
    success,
    error,
    warning,
    info,
    removeToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

