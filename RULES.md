# Pool Rules

These rules define how points are earned in the World Cup Pool.

## Entry

Each Participant submits one Entry before the Entry Lock. An Entry contains:

- 1 Team Pick from Team Tier 1.
- 2 Team Picks from Team Tier 2.
- 2 Team Picks from Team Tier 3.
- 2 Team Picks from Team Tier 4.
- 1 Goalscorer Pick from each Team Tier.

Goalscorer Picks are independent from Team Picks. A Goalscorer Pick must belong to the matching Team Tier, but does not need to play for one of the Entry's Team Picks.

## Tier Multipliers

Lower-ranked Team Tiers are worth more when they earn points.

| Team Tier   | Multiplier |
| ----------- | ---------: |
| Team Tier 1 |       1.00 |
| Team Tier 2 |       1.25 |
| Team Tier 3 |       1.50 |
| Team Tier 4 |       1.75 |

## Team Pick Points

Each Team Pick earns Match Points and Stage Bonuses. First calculate the base points, then multiply them by that Team Pick's Tier Multiplier.

### Match Points

| Match result                     | Base points |
| -------------------------------- | ----------: |
| Win in normal time or extra time |           3 |
| Draw                             |           1 |
| Loss                             |           0 |
| Win after a penalty shootout     |           2 |
| Loss after a penalty shootout    |           1 |

A penalty shootout Match is treated as an in-play draw plus the shootout outcome: the shootout winner earns 2 base points total, and the shootout loser earns 1 base point total.

### Stage Bonuses

| Achievement                      | Base points |
| -------------------------------- | ----------: |
| Qualifies for the Round of 32    |           5 |
| Qualifies for the Round of 16    |         7.5 |
| Qualifies for the quarter-finals |          10 |
| Qualifies for the semi-finals    |          15 |
| Qualifies for the final          |        17.5 |
| Wins the World Cup               |          20 |

A Stage Bonus is awarded once per Team Pick when the achievement is confirmed. Stage Bonuses are multiplied by the Team Pick's Tier Multiplier.

## Goalscorer Pick Points

Each Goalscorer Pick earns points from goals and may earn one top scorer bonus.

| Achievement                                     | Base points |
| ----------------------------------------------- | ----------: |
| Goal officially credited to the selected player |           1 |
| Tournament top scorer bonus                     |          10 |

Goal points are multiplied by the Goalscorer Pick's Tier Multiplier. The tournament top scorer bonus is flat and is not multiplied.

Goals scored in normal time or extra time count, including penalty kicks during play. Goals scored in penalty shootouts do not count. Own goals do not count for a Goalscorer Pick.

If the official tournament source recognises multiple top scorers, each selected top scorer earns the bonus.

## Score Display

Scores can be fractional because of Tier Multipliers. Scores use quarter-point increments and are shown without unnecessary trailing zeros, for example `3`, `4.5`, or `8.75`.

An Entry's total score is the sum of all Team Pick points and Goalscorer Pick points. The Leaderboard ranks Participants by total score. If two or more Entries have the same total score, they share the same position.
