# Local Assets Guide

Use these folders for local files that feed ReelForge Studio without committing user media to Git.

## Editing References

Place editing reference videos in:

`storage/references`

Use this for reels, shorts, pacing examples, transitions, typography references, sports edits, documentary pacing, and other examples you want to study manually.

Example file URL for `/editing-references`:

`file:///C:/Users/Pichau/Documents/New%20project/reelforge-studio-clean/storage/references/football-hype-01.mp4`

## Music

Place authorized music in:

`storage/assets/music`

Only use tracks that are yours, licensed, royalty-free, platform-safe, or otherwise explicitly authorized for your project.

## SFX

Place local sound effects in:

`storage/assets/sfx`

Recommended categories include whoosh, hit, riser, boom, crowd, whistle, impact, flash, transition, and ambience.

## Microclips

Place local or authorized microclips in:

`storage/assets/microclips`

Use this for short clips that can support an editorial scene as evidence, impact, quick reference, or highlight-style insert.

## Manual Imports

Place temporary files you are preparing to import in:

`storage/assets/imports`

This folder is for manual staging. Move files into the correct library folder after organizing them.

## Git Safety

Real media files in these folders must not be committed:

- `storage/references/*`
- `storage/assets/music/*`
- `storage/assets/sfx/*`
- `storage/assets/microclips/*`
- `storage/assets/imports/*`

Only `.gitkeep` files are versioned so the folder structure exists after cloning.
