import type { Overview } from '@/lib/httpApi'

export function getTournamentGroups(overview: Overview) {
  const groups = new Map<
    string,
    Array<Overview['teamTiers'][number]['teams'][number] & { tierName: string }>
  >()

  for (const tier of overview.teamTiers) {
    for (const team of tier.teams) {
      const groupCode = team.groupCode || '?'
      groups.set(groupCode, [...(groups.get(groupCode) ?? []), { ...team, tierName: tier.name }])
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupCode, teams]) => ({
      groupCode,
      teams: teams.sort((left, right) => left.name.localeCompare(right.name)),
    }))
}

export function filterGoalscorers(players: Overview['eligiblePlayers'], search: string) {
  const tokens = normalizeSearch(search).split(' ').filter(Boolean)

  if (tokens.length === 0) {
    return players
  }

  return players.filter((player) => {
    const searchable = normalizeSearch(
      [
        player.name,
        player.teamName,
        player.teamFifaCode,
        getFifaCodeAliases(player.teamFifaCode),
      ].join(' '),
    )
    return tokens.every((token) => searchable.includes(token))
  })
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getFifaCodeAliases(fifaCode: string) {
  const aliases: Record<string, string> = {
    ENG: 'ing inglaterra england',
    GER: 'ale alemania germany',
    KOR: 'cor corea korea',
    NED: 'hol paises bajos netherlands holland',
    NOR: 'nor noruega norway',
    RSA: 'sud sudafrica south africa',
    SUI: 'sui suiza switzerland',
    USA: 'eeuu estados unidos united states',
  }

  return aliases[fifaCode] ?? ''
}

export function getFlagEmoji(fifaCode: string) {
  const isoByFifaCode: Record<string, string> = {
    ALG: 'DZ',
    ARG: 'AR',
    AUS: 'AU',
    AUT: 'AT',
    BEL: 'BE',
    BIH: 'BA',
    BRA: 'BR',
    CAN: 'CA',
    CIV: 'CI',
    COD: 'CD',
    COL: 'CO',
    CPV: 'CV',
    CRO: 'HR',
    CUW: 'CW',
    CZE: 'CZ',
    ECU: 'EC',
    EGY: 'EG',
    ENG: 'GB-ENG',
    ESP: 'ES',
    FRA: 'FR',
    GER: 'DE',
    GHA: 'GH',
    HAI: 'HT',
    IRN: 'IR',
    IRQ: 'IQ',
    JOR: 'JO',
    JPN: 'JP',
    KOR: 'KR',
    KSA: 'SA',
    MAR: 'MA',
    MEX: 'MX',
    NED: 'NL',
    NOR: 'NO',
    NZL: 'NZ',
    PAN: 'PA',
    PAR: 'PY',
    POR: 'PT',
    QAT: 'QA',
    RSA: 'ZA',
    SCO: 'GB-SCT',
    SEN: 'SN',
    SUI: 'CH',
    SWE: 'SE',
    TUN: 'TN',
    TUR: 'TR',
    URU: 'UY',
    USA: 'US',
    UZB: 'UZ',
  }
  const isoCode = isoByFifaCode[fifaCode] ?? fifaCode

  if (isoCode === 'GB-ENG') {
    return getSubdivisionFlagEmoji('gbeng')
  }

  if (isoCode === 'GB-SCT') {
    return getSubdivisionFlagEmoji('gbsct')
  }

  if (!/^[A-Z]{2}$/.test(isoCode)) {
    return '🏳'
  }

  return String.fromCodePoint(...[...isoCode].map((character) => 127397 + character.charCodeAt(0)))
}

function getSubdivisionFlagEmoji(tag: string) {
  return String.fromCodePoint(
    0x1f3f4,
    ...[...tag].map((character) => 0xe0000 + character.charCodeAt(0)),
    0xe007f,
  )
}
