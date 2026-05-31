import { createFileRoute } from '@tanstack/react-router'

import { RulesPage } from '@/pages/rules'

export const Route = createFileRoute('/_authenticated/rules')({
  component: RulesPage,
})
