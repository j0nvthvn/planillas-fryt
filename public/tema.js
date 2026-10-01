// Tema antes del primer render, para evitar el destello claro→oscuro
// (también en la barra de estado). Es un archivo aparte y no un <script>
// inline para que la CSP (vercel.json) no necesite 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('tema') || 'sistema'
    if (t === 'oscuro' || (t === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0B0D10')
    }
  } catch { /* sin storage */ }
})()
