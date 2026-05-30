# Database Cleanup Report

This file is now historical only.

## Current Status

Do not use the old cleanup guidance in this document against the current shipped app.

As of `2026-05-29`, the live app and the deployed Replit runtime expect the following tables to exist:

- `users`, `accounts`, `sessions`, `verification_tokens`
- `user_ai_vendor_settings`
- `posts`, `comments`, `reactions`
- `feed_sources`, `feed_items_seen`
- `categories`, `post_categories`
- `pages`, `nav_links`, `site_settings`
- `media_assets`
- `art_pieces`, `art_piece_versions`
- `exhibits`, `piece_exhibits`, `media_asset_exhibits`
- `platform_connections`, `platform_oauth_apps`

They also expect the richer `users` and `posts` column sets that support:

- per-user theme customization
- owner AI vendor settings
- inbound feed ingestion and pending moderation
- public search backed by `posts.content_text`
- site settings, categories, pages, and nav management
- local media storage with title/alt text metadata
- reusable interactive pieces and current-version embeds
- immersive exhibit walls composed from pieces and images
- outbound syndication connection metadata and OAuth app credentials

## Why This Was Superseded

An earlier branch of project history produced cleanup guidance that treated several now-live tables and columns as dead code. That guidance is no longer safe for the current product surface and no longer reflects the deployed Replit app.

## Current Schema Truth

For current operations, use these sources instead:

- [lib/db/src/migrate.ts](/Users/Fornesus/Code/fornesusart-platform/lib/db/src/migrate.ts:1)
- [lib/db/src/schema/index.ts](/Users/Fornesus/Code/fornesusart-platform/lib/db/src/schema/index.ts:1)
- [README.md](/Users/Fornesus/Code/fornesusart-platform/README.md:1)
- [replit.md](/Users/Fornesus/Code/fornesusart-platform/replit.md:1)

If you need to reconcile a database, reconcile it forward to the current shipped schema rather than trimming it back to the older reduced schema described in the superseded report.
