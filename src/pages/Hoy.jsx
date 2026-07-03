import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { fechaLegible, hoy } from '../utils/format'

export default function Hoy() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Minimarket Fryt"
        title="Hoy"
        date={fechaLegible(hoy())}
      />
      <div className="card text-center text-muted py-12">
        Hoy — en construcción (Fase 3)
      </div>
    </Layout>
  )
}
