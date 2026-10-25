import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// ビルドしたファイルの一覧（asset-manifest.json）を書き出す。
// オフライン対応（public/sw.js）が、初めて開いたときに後から読み込むページのファイルもまとめて保存するために使う
function assetManifest(): Plugin {
  return {
    name: 'asset-manifest',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => f.startsWith('assets/')).sort()
      this.emitFile({ type: 'asset', fileName: 'asset-manifest.json', source: JSON.stringify({ files }) })
    },
  }
}

export default defineConfig({
  // GitHub Pages（https://oche0809.github.io/basketball-menu-warehouse/）で公開するためのパス
  base: '/basketball-menu-warehouse/',
  plugins: [react(), tailwindcss(), assetManifest()],
  build: {
    rolldownOptions: {
      output: {
        // 変わりにくいもの（React・メニューのデータ）を別ファイルにして、アプリを更新したときに読み直す量を減らす
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'menu-data', test: /src[\\/]data[\\/]/ },
          ],
        },
      },
    },
  },
})
