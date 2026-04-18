import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Register service worker via vite-plugin-pwa runtime helper
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // A new service worker is available — silently update
    console.info('[EloyRx] New version available. Updating…')
  },
  onOfflineReady() {
    console.info('[EloyRx] App is ready for offline use.')
  },
})

createApp(App).mount('#app')
