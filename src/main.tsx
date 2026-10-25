import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { requestPersistentStorage } from './utils/dataSafety'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ブラウザがデータを自動で消さないように頼む（iPhone の Safari などは、しばらく使わないと消すことがある）
void requestPersistentStorage()

// オフライン対応（公開版だけ）。開発中は古いファイルが残ると紛らわしいので使わない
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 登録できない環境（プライベートモード等）では、通常どおりオンラインで使う
    })
  })
}
