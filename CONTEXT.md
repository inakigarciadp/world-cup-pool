# World Cup Pool

This context describes the shared language for a small friends-only World Cup prediction pool.

## Language

**Pool**:
A private prediction game played by a small group of friends during a football tournament.
_Avoid_: Betting app, fantasy league

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

**Tournament Group**:
An official World Cup group, identified by a letter such as Group A, that contains the national teams scheduled to play each other in the tournament group stage.
_Avoid_: Team Tier, Bombo

**Team Pick**:
A national team selected in an **Entry** from a specific **Team Tier**.
_Avoid_: Squad pick, country pick

**Eligible Player**:
A footballer from an official final World Cup squad who is made available by the **Admin** for selection as a **Goalscorer Pick**.
_Avoid_: Player, player option, scorer candidate, provisional player

**Goalscorer Pick**:
The single **Eligible Player** selected in an **Entry** for goalscorer scoring.
_Avoid_: Top scorer, striker pick

**Leaderboard**:
The public ranking of **Participants** by their current score in the **Pool**. The **Leaderboard** is visible from the beginning of the **Pool**, even before any points have been awarded.
_Avoid_: Table, standings, classification

**Match Points**:
Points awarded to an **Entry** when one of its **Team Picks** plays a match. A normal-time or extra-time win gives 3 points, a draw gives 1 point, a loss gives 0 points, and a penalty shootout win gives 1 point total. A penalty shootout loss gives 0 points.
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

Dev: "Can a Participant change their Entry after the first World Cup match starts?"
Domain expert: "No. Entries are fully locked once the World Cup starts."

Dev: "Who fixes a typo in a locked Entry?"
Domain expert: "The Admin can correct it, but Participants cannot edit locked Entries themselves."

Dev: "How many teams does an Entry choose?"
Domain expert: "The Pool defines Team Tiers and how many Team Picks are required from each tier."

Dev: "Is Bombo 1 the same thing as Group A?"
Domain expert: "No. A Team Tier controls selection rules for the Pool, while a Tournament Group is an official World Cup group."

Dev: "Can someone type any goalscorer name?"
Domain expert: "No. They choose one Goalscorer Pick from the Eligible Players, and Eligible Players come from official final World Cup squads."

Dev: "Can Participants see other Entries before the World Cup starts?"
Domain expert: "Yes. Entries are public throughout the Pool, including before the Entry Lock."

Dev: "When is the Leaderboard visible?"
Domain expert: "From the beginning. It starts with zero points and updates as the Pool is scored."

Dev: "Does a penalty shootout win score 3 plus 1?"
Domain expert: "No. A penalty shootout win gives 1 Match Point total."

Dev: "Does the penalty shootout loser get a draw point?"
Domain expert: "No. The shootout winner gets 1 Match Point and the loser gets 0."

Dev: "Are advancement points only for the semifinal and champion?"
Domain expert: "No. The Pool uses configured Stage Bonuses for each meaningful tournament stage."

Dev: "When is a Stage Bonus awarded?"
Domain expert: "When the Team Pick's qualification for that stage is confirmed."

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
