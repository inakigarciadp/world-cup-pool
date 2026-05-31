import type { Overview } from '@/lib/httpApi'

export function getPoolStatusLabel(status: Overview['pool']['status']) {
  const labels = {
    setup: 'Configuración',
    open: 'Abierta',
    locked: 'Cerrada',
    scoring: 'Puntuando',
  }

  return labels[status]
}
