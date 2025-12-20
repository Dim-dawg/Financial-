import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handling to catch initialization issues
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global Error Caught:", message, error);
  const rootElement = document.getElementById('root');
  if (rootElement && !rootElement.innerHTML.trim()) {
     rootElement.innerHTML = `<div style="padding: 40px; text-align: center; font-family: sans-serif;">
      <h2 style="color: #e11d48;">Application Error</h2>
      <p style="color: #475569;">${message}</p>
      <button onclick="window.location.reload()" style="background: #2563eb; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">Reload Application</button>
    </div>`;
  }
};

window.onunhandledrejection = (event) => {
  console.error("Unhandled Promise Rejection:", event.reason);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Fatal: Could not find root element to mount to");
} else {
  try {
    console.log("Cipher Finance: Initializing Application...");
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Cipher Finance: Render triggered successfully");
  } catch (err) {
    console.error("Cipher Finance: Failed to render app", err);
    rootElement.innerHTML = `<div style="padding: 20px; color: #e11d48; font-family: sans-serif; border: 1px solid #fda4af; background: #fff1f2; border-radius: 8px; margin: 20px;">
      <h2 style="margin-top: 0;">Initialization Failed</h2>
      <p>${err instanceof Error ? err.message : 'Unknown Error'}</p>
      <pre style="background: #f8fafc; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">${err instanceof Error ? err.stack : ''}</pre>
    </div>`;
  }
}