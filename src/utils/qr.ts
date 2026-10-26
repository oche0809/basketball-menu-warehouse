import qrcode from 'qrcode-generator'

// QRコードを SVG の path にする（ライブラリの HTML 文字列は使わない）
export function qrPath(text: string): { size: number; d: string } | null {
  try {
    const qr = qrcode(0, 'L')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    return { size: n, d }
  } catch {
    // データが多すぎて QRコードに入らない
    return null
  }
}
