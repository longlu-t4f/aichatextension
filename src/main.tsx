/**
 * React 应用入口
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// 渲染 React 应用
const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

