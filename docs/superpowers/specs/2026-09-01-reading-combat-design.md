# Reading combat

Tarot TCG combat is a **reading**, not a Hearthstone punch and not a LoR block.

On your turn you still play cards onto the tableau. Combat is one committed spread of 1–3 cards. The cards’ faces, suits, and whether a Major is in Future decide what happens. Attack tokens, click-to-nexus, and summoning sickness are not part of combat.

Standard win remains: opponent life to 0.

## Turn

1. Draw, refill mana (max = round, cap 10).
2. Play units and spells as now, with one change: **spell mana pays for spells only**. Units spend regular mana.
3. At most **one reading** this turn.
4. End turn. Unused regular mana banks as spell mana (max 3). Exhausted reading cards refresh.

You may read the turn you play a unit. There is no attack token.

## The spread

Three positions, left to right: **Past**, **Present**, **Future**.

| Cards laid | Occupied |
|---|---|
| 1 | Future only |
| 2 | Present, then Future |
| 3 | Past, Present, Future |

You choose which card goes where. Empty positions are skipped, they are not “illegal”.

A card comes from **hand** (pay its cost on commit) or from **your tableau** (it stays, marked exhausted; it cannot be in another reading this turn). The same card cannot occupy two positions.

## Six resolution rules

### 1. Missing positions

- **Future empty:** the reading cannot commit. Future is required.
- **Past empty:** the thread (element of the question) is Present’s element, else Future’s.
- **Present empty:** the clash is unopposed (see rule 4).

### 2. Future is a spell

Future’s **face ability** is the meaning (`abilitiesForFace`). That ability fires as if the spell were played.

If Future is a unit, its face on-play ability does **not** re-fire when the unit was already on the tableau. The unit still contributes pip/trump to the verdict.

Spells used from hand are discarded after the reading. Units used from hand enter an empty tableau slot exhausted; if the tableau is full they participate then leave play.

### 3. Thread and pip

- **Thread element** = Past.element, else Present.element, else Future.element.
- **Pip** (minors only): Ace 1, numbered 2–10, Page 11, Knight 12, Queen 13, King 14. Majors have pip 0.
- **Verdict** = sum of pips of every minor in the spread.

Majors are not extra damage numbers. They are trumps (rule 5).

### 4. Contested vs unopposed

The reading is **contested** when the opponent has at least one living unit whose **element matches the thread**.

- **Unopposed:** verdict hits the opponent’s life (nexus).
- **Contested, Future is a minor:** verdict hits the opponent’s matching-element unit with the highest current health. No overflow to life.
- **Contested, Future is a Major:** trump. Verdict hits life anyway (rule 5).

This is the board interaction. It is not Taunt and not LoR blockers.

### 5. Major as trump

If Future’s `category` is `major`:

- The reading reaches life even when contested.
- Future’s face ability still fires.
- Trump rank is the Major’s tarot number (0–21) only for clarifier ties (rule 6), not for extra damage.

Cost is not rank. The Fool (0) and The World (10) stay themselves.

### 6. Clarifier

After the reader commits, the opponent may play **one** card from hand (pay its cost; spells may use spell mana) as a clarifier.

- Clarifier **reversed** and **same element as the thread:** invert Future’s face for this reading only (`isReversed` flipped before abilitiesForFace).
- Clarifier is a **Major** and Future is a **minor:** the clarifier becomes the meaning (its face ability fires instead of Future’s). Verdict still uses the original spread’s pips. Trump (life through contest) does **not** apply unless that clarifier Major is treated as Future — it is: Future is replaced by the clarifier for rules 2 and 5.
- Otherwise the clarifier is discarded with no extra effect (you paid to contest and missed).

v1 digital: the human does not get a timed prompt. The AI opponent may clarifier automatically when it can pay and holds a same-element card. The human’s readings against the AI still go through this. Human-vs-human clarifier UI is later.

Training AI: still performs readings; it does **not** clarifier, so the lesson is readable.

## What combat no longer does

- Per-unit click → nexus or unit.
- Attack token gating.
- Summoning sickness gating of combat (tableau cards may be read the turn they enter).
- Generic reversed ATK penalty / unused `defenseBonus` as the meaning of reversed.

Reversed matters because the **face ability** changes, and because a reversed clarifier can invert Future.

## Data that must exist on runtime cards

- `category`: `'major' | 'minor'` from the content path. Must survive `card_loader`.
- `suit`: `'wands' | 'cups' | 'swords' | 'pentacles'` for minors, omitted for majors.
- `element`, `isReversed`, `uprightAbilities`, `reversedAbilities` already exist.

Do not infer Major from cost.

## AI

Replace `makeSmartAttackDecision` / `declareAttack` with building a spread:

1. Prefer a Major in Future if one is in hand or tableau and payable.
2. Else highest-pip payable minor as Future.
3. Fill Present then Past with remaining payable cards, same-element as Future if possible.
4. One reading per turn.

Training: max one extra card play (existing) plus one reading. No random attack values.

## UI

- Three slots under the player tableau: Past, Present, Future.
- Click a hand card or your unit, then a slot (or click the next empty slot).
- **Read** commits. Disabled without Future, if already read this turn, or if you cannot pay hand cards in the spread.
- Escape clears the spread.
- Player rail no longer shows Attack token / Attack nexus.

## Rules copy

`/rules` combat section describes this reading. It must not mention Taunt, Windfury, Charge, or the attack token as the combat model.
