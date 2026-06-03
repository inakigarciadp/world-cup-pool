# World Cup Pool

This context describes the shared language for a small friends-only World Cup prediction pool.

## Language

**Pool**:
The single private prediction game played by this group of friends during the 2026 World Cup. The product is not a platform for hosting multiple independent pools.
_Avoid_: Betting app, fantasy league, multi-pool platform

**Participant**:
A person pre-created and maintained by the **Admin** who joins the **Pool** and submits exactly one **Entry** for scoring. Participants cannot change their own identity details.
_Avoid_: Account, player, user

**Participant Login**:
The act of a **Participant** identifying themselves with their participant name and password-like PIN. A PIN is not limited to numbers.
_Avoid_: Email login, password login, account signup

**Admin**:
The single trusted person who manages the **Pool** and may correct locked **Entries** when needed. The **Admin** can also be a **Participant**.
_Avoid_: Moderator, owner, superuser

**Admin PIN**:
The separate password-like PIN used to access Admin capabilities. A PIN is not limited to numbers.
_Avoid_: Admin password, master key

**Entry**:
The public set of predictions submitted by one **Participant** for one **Pool**. Each **Entry** belongs to exactly one **Participant**, each **Participant** has exactly one **Entry**, and all **Entries** are visible throughout the **Pool**.
_Avoid_: Bet, ticket, lineup

**Team Tier**:
A configured group of national teams from which an **Entry** must select a configured number of teams.
_Avoid_: Pot, category, group, tournament group

**Tier Multiplier**:
A scoring weight attached to a **Team Tier** so that points earned through **Team Picks** and **Goalscorer Picks** from lower-ranked Team Tiers are worth more.
_Avoid_: Odds, handicap, difficulty bonus

**Tournament Group**:
An official World Cup group, identified by a letter such as Group A, that contains the national teams scheduled to play each other in the tournament group stage.
_Avoid_: Team Tier, Bombo

**Match**:
One official World Cup fixture tracked by the **Pool**. A Match has a kickoff time and may have known or unknown participating teams depending on whether the tournament has reached that stage.
_Avoid_: Game, tie, event

**Match Schedule**:
The official World Cup list of **Matches**, kickoff times, and venues that the **Pool** follows.
_Avoid_: Calendar, fixture feed, scraped data

**Match Placeholder**:
A textual official bracket label used when a **Match** participant is not yet known, such as a group position or previous-match winner. A Match Placeholder is kept as bracket context even after the Admin resolves the concrete team.
_Avoid_: Fake team, temporary team, unknown team

**Resolved Match Team**:
A concrete national team assigned to one side of a **Match**. A Resolved Match Team is used for stakes and scoring, while the original **Match Placeholder** remains as bracket context.
_Avoid_: Filled placeholder, selected side

**Upcoming Match**:
A **Match** whose kickoff time has not yet passed. The match list defaults to Upcoming Matches.
_Avoid_: Future game, next fixture

**Default Match Window**:
The period in which a **Match** appears in the default match list: before kickoff and until three hours after kickoff. This keeps Matches visible while they may still be live or immediately awaiting results.
_Avoid_: Upcoming-only filter, live filter

**Past Match**:
A **Match** whose **Default Match Window** has passed. Past Matches are hidden from the default match list unless the Participant asks to include them.
_Avoid_: Previous game, old fixture

**Team Pick**:
A national team selected in an **Entry** from a specific **Team Tier**.
_Avoid_: Squad pick, country pick

**Eligible Player**:
A footballer from an official final World Cup squad who is made available by the **Admin** for selection as a **Goalscorer Pick**.
_Avoid_: Player, player option, scorer candidate, provisional player, free-text scorer

**Goalscorer Pick**:
An **Eligible Player** selected in an **Entry** for goalscorer scoring. An **Entry** must choose one Goalscorer Pick from each Team Tier. Goalscorer Picks are independent from Team Picks, so the selected Eligible Player only needs to belong to the same Team Tier, not to one of the Entry's selected Team Picks.
_Avoid_: Top scorer, striker pick

**Match Stake**:
A reason a **Participant** cares about a **Match** because their **Entry** contains either a **Team Pick** for one of the Match teams or a **Goalscorer Pick** from one of the Match teams. A Participant can have more than one Match Stake in the same Match.
_Avoid_: Interest, exposure, bet

**Participant Match Stakes**:
The grouped set of all **Match Stakes** one **Participant** has in a single **Match**. The match list shows a Participant once per Match with all of their stakes together.
_Avoid_: Stake rows, duplicated participants

**Match Result**:
The factual football outcome of a **Match**, including goals scored in play and, when needed, the penalty shootout winner. A Match Result is separate from the Pool's scoring interpretation and does not track penalty shootout goal totals.
_Avoid_: Score, points result, calculated points

**Match Goal**:
An official goal credited to an **Eligible Player** during normal time or extra time in a **Match**, including penalty kicks during play. For an own goal, the Match Goal is linked to the credited Eligible Player and marked as an own goal, while the score belongs to the opposing team. Penalty shootout goals are not Match Goals; own goals do not count for Goalscorer Pick scoring.
_Avoid_: Goal event, shootout goal

**Match Result Completeness**:
Whether the recorded **Match Goals** account for the in-play score in a **Match Result**. Completeness warnings are shown only to the **Admin** so Participants are not exposed to operational data-entry status.
_Avoid_: Public validation, scoring status

**Penalty Shootout Outcome**:
The winner and loser of a penalty shootout used to decide a knockout **Match**. The Pool tracks the outcome, not the penalty shootout score or individual shootout goals.
_Avoid_: Shootout goals, shootout score

**Scoring Interpretation**:
The Pool-specific meaning derived from a **Match Result**, such as whether a **Team Pick** earned win, draw, loss, or penalty shootout points.
_Avoid_: Match Result, official result

**Leaderboard**:
The public ranking of **Participants** by their current score in the **Pool**. The **Leaderboard** is visible from the beginning of the **Pool**, even before any points have been awarded. Entries with the same score share the same position.
_Avoid_: Table, standings, classification

**Match Points**:
Points awarded to an **Entry** when one of its **Team Picks** plays a match. A normal-time or extra-time win gives 3 points, a draw gives 1 point, a loss gives 0 points, a penalty shootout win gives 2 points total, and a penalty shootout loss gives 1 point total.
_Avoid_: Game points, fixture points

**Stage Bonus**:
Points awarded to an **Entry** when one of its **Team Picks** qualifies for a configured tournament stage. The bonus is awarded when qualification is confirmed.
_Avoid_: Round bonus, advancement points, qualification bonus

**Synced Result**:
Tournament data imported from an external source for automatic scoring.
_Avoid_: API result, feed result

**Admin Override**:
A correction made by the **Admin** when a **Synced Result** is missing, late, or wrong. Admin Overrides take precedence over Synced Results.
_Avoid_: Manual patch, forced edit

**Entry Lock**:
The moment when all **Entries** become final for the **Pool**. Participants may change their **Entry** before the World Cup starts; after the **Entry Lock**, no Participant edits are allowed, but the **Admin** may make corrections.
_Avoid_: Freeze, close

**Example dialogue**:

Dev: "Can one Participant submit more than one Entry?"
Domain expert: "No. Each Participant has exactly one Entry in this Pool."

Dev: "Can this app host several independent World Cup pools?"
Domain expert: "No. This app is for one friends-only 2026 Pool."

Dev: "Can a Participant change their Entry after the first World Cup match starts?"
Domain expert: "No. Entries are fully locked once the World Cup starts."

Dev: "Who fixes a typo in a locked Entry?"
Domain expert: "The Admin can correct it, but Participants cannot edit locked Entries themselves."

Dev: "How many teams does an Entry choose?"
Domain expert: "For the 2026 Pool, an Entry chooses 1 Team Pick from Bombo 1, 2 from Bombo 2, 2 from Bombo 3, and 2 from Bombo 4."

Dev: "Is Bombo 1 the same thing as Group A?"
Domain expert: "No. A Team Tier controls selection rules for the Pool, while a Tournament Group is an official World Cup group."

Dev: "Which Matches should the match list show by default?"
Domain expert: "Matches in the Default Match Window. Past Matches are only shown when someone chooses to include previous matches."

Dev: "How do we show knockout Matches before the teams are known?"
Domain expert: "Use Match Placeholders like official bracket labels until the Admin resolves the actual teams."

Dev: "After a knockout Match team is known, do we keep the placeholder?"
Domain expert: "Yes. The Resolved Match Team drives stakes and scoring, while the Match Placeholder still explains the bracket path."

Dev: "Can someone type any goalscorer name?"
Domain expert: "No. They choose one Goalscorer Pick per Team Tier from the Eligible Players, and Eligible Players come from official final World Cup squads."

Dev: "Can the Admin record a goal for a free-text player?"
Domain expert: "No. Match Goals are recorded against Eligible Players because the Pool expects all World Cup players to exist there."

Dev: "How is an own goal recorded?"
Domain expert: "Link it to the credited Eligible Player, mark it as an own goal, and assign the score to the opposing team. It does not count for Goalscorer Pick scoring."

Dev: "What if the Admin has entered the score but not all goalscorers yet?"
Domain expert: "Show an Admin-only Match Result Completeness warning. Do not show that operational warning to Participants."

Dev: "Who has a stake in a Match?"
Domain expert: "Any Participant whose Entry includes a Team Pick for one of the Match teams or a Goalscorer Pick from one of the Match teams."

Dev: "If someone has a Team Pick and a Goalscorer Pick in the same Match, how should they appear?"
Domain expert: "Show the Participant once in that Match, with all of their Match Stakes grouped together."

Dev: "Is a Match Result the same thing as the points awarded for that Match?"
Domain expert: "No. A Match Result is the football outcome. The Scoring Interpretation derives Pool points from that result."

Dev: "Do penalty shootout goals get stored as goals?"
Domain expert: "No. The Pool stores the Penalty Shootout Outcome, not shootout goal totals or individual shootout goals."

Dev: "How is a knockout Match decided by penalties represented?"
Domain expert: "Store the in-play score as a draw, for example Spain 1-1 Italy, and separately store that Spain won the Penalty Shootout Outcome."

Dev: "Does the Goalscorer Pick have to come from one of the Entry's selected Team Picks?"
Domain expert: "No. Goalscorer Picks are independent from Team Picks, but each Goalscorer Pick must come from a team in the matching Team Tier."

Dev: "Can Participants see other Entries before the World Cup starts?"
Domain expert: "Yes. Entries are public throughout the Pool, including before the Entry Lock."

Dev: "When is the Leaderboard visible?"
Domain expert: "From the beginning. It starts with zero points and updates as the Pool is scored."

Dev: "Does a penalty shootout win score 3 plus 1?"
Domain expert: "No. A penalty shootout win gives 2 Match Points total."

Dev: "Does the penalty shootout loser get a draw point?"
Domain expert: "Yes. The shootout winner gets 2 Match Points and the loser gets 1."

Dev: "Are advancement points only for the semifinal and champion?"
Domain expert: "No. The Pool uses configured Stage Bonuses for each meaningful tournament stage."

Dev: "When is a Stage Bonus awarded?"
Domain expert: "When the Team Pick's qualification for that stage is confirmed."

Dev: "Does a Tier Multiplier apply only to Match Points?"
Domain expert: "No. For Team Picks, the Tier Multiplier applies to both Match Points and Stage Bonuses."

Dev: "Which Tier Multipliers does the Pool use?"
Domain expert: "The Pool uses 1.00 for Team Tier 1, 1.25 for Team Tier 2, 1.50 for Team Tier 3, and 1.75 for Team Tier 4."

Dev: "Does a Tier Multiplier apply to the top scorer bonus?"
Domain expert: "No. For Goalscorer Picks, the Tier Multiplier applies to ordinary goal points, but the tournament top scorer bonus stays flat."

Dev: "Can the Leaderboard include fractional points?"
Domain expert: "Yes. Tier Multipliers can produce fractional scores."

Dev: "How should fractional scores be shown?"
Domain expert: "Scores use quarter-point increments and are shown without unnecessary trailing zeros."

Dev: "What happens if two Participants have the same score?"
Domain expert: "They share the same Leaderboard position."

Dev: "What happens if synced tournament data is wrong?"
Domain expert: "The Admin can create an Admin Override, and that takes precedence over the Synced Result."

Dev: "Do Participants need email accounts?"
Domain expert: "No. They use Participant Login with their name and PIN."

Dev: "Can anyone with the link create a Participant?"
Domain expert: "No. The Admin pre-creates the Participant list."

Dev: "Can Participants change their name or PIN?"
Domain expert: "No. The Admin maintains Participant identity details."

Dev: "Does the Admin use a Participant PIN?"
Domain expert: "No. Admin capabilities require a separate Admin PIN."
