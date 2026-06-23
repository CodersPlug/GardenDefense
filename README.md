# Garden Defense

Simple **Plants vs Zombies**-style browser game for a ~6 year old — tap to play, no reading required.

## How to play

1. **Collect sun** — tap the falling yellow suns (+25 each).
2. **Plant flowers** — tap the flower in the bottom bar, then tap an empty lawn square (costs 50 sun).
3. **Flowers shoot petals** at slow, silly zombies walking toward the pink house.
4. **Survive 3 waves** to win. If 5 hearts run out, try again!

## Run locally

```bash
cd /Users/leo/Documents/Projects/GardenDefense
python3 -m http.server 3000
```

Open http://localhost:3000 on iPad/iPhone (same Wi‑Fi) or desktop.

## Stack

- Phaser 3 (CDN)
- Vanilla JS, no build step
- Touch-first, keyboard not needed

## Tunables

Edit constants at the top of `game.js`: `FLOWER_COST`, `ZOMBIE_SPEED`, `WAVES`, etc.
