import React from 'react';
import { createRoot } from 'react-dom/client';
import './storage.js'; // Firebase + localStorage storage 초기화
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
