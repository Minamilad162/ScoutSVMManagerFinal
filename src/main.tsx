import { ToastProvider } from './components/ui/Toaster'
import { AppErrorBoundary } from './components/ui/AppErrorBoundary'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)

function setFavicon(url: string) {
  let fav = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!fav) {
    fav = document.createElement('link')
    fav.rel = 'icon'
    document.head.appendChild(fav)
  }
  fav.type = 'image/png'
  fav.href = url

  let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']")
  if (!apple) {
    apple = document.createElement('link')
    apple.rel = 'apple-touch-icon'
    document.head.appendChild(apple)
  }
  apple.href = url
}

setFavicon('/icons/icon-192.png')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  })
}
