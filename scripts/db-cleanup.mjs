import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const DB = process.env.DB_NAME;
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB,
  ssl: process.env.DB_SSL === 'true' ? {} : undefined,
  multipleStatements: true,
  connectTimeout: 30000,
});

async function q(sql, params=[]) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

const ALLOW_NONDEFAULT = process.env.ALLOW_NONDEFAULT === 'true';
const TABLES_TO_DROP = ['feed_items_seen', 'post_categories', 'categories', 'nav_links', 'pages', 'site_settings', 'feed_sources'];
const POSTS_DROP_COLS = ['status', 'source_feed_id', 'source_guid', 'source_canonical_url', 'content_text'];
const USERS_DROP_COLS = ['theme', 'palette',
  'color_background','color_foreground','color_background_dark','color_foreground_dark',
  'color_primary','color_primary_foreground','color_secondary','color_secondary_foreground',
  'color_accent','color_accent_foreground','color_muted','color_muted_foreground',
  'color_destructive','color_destructive_foreground'];

console.log('\n=== STEP 1: PRE-FLIGHT CHECKS ===');
const issues = [];

for (const t of TABLES_TO_DROP) {
  const [exists] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
    [DB, t]
  );
  if (exists[0].c === 0) { console.log(`  ${t}: (table absent — already dropped)`); continue; }
  const r = await q(`SELECT COUNT(*) AS c FROM \`${t}\``);
  console.log(`  ${t}: ${r[0].c} rows`);
  if (r[0].c > 0) {
    const sample = await q(`SELECT * FROM \`${t}\` LIMIT 5`);
    console.log(`    SAMPLE rows from ${t}:`, JSON.stringify(sample, null, 2));
    issues.push(`${t} contains ${r[0].c} rows`);
  }
}

async function postsCol(col) {
  const [exists] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='posts' AND COLUMN_NAME=?`,
    [DB, col]);
  return exists[0].c > 0;
}
console.log('\n  posts extra cols (non-default values):');
const postsChecks = {
  status: `status IS NOT NULL AND status <> 'published' AND status <> ''`,
  source_feed_id: `source_feed_id IS NOT NULL`,
  source_guid: `source_guid IS NOT NULL`,
  source_canonical_url: `source_canonical_url IS NOT NULL`,
  content_text: `content_text IS NOT NULL AND content_text <> ''`,
};
for (const [col, cond] of Object.entries(postsChecks)) {
  if (!(await postsCol(col))) { console.log(`    posts.${col}: (column absent — already dropped)`); continue; }
  const r = await q(`SELECT COUNT(*) AS c FROM posts WHERE ${cond}`);
  console.log(`    posts.${col} (non-default): ${r[0].c}`);
  if (col === 'status') {
    const dist = await q(`SELECT status, COUNT(*) c FROM posts GROUP BY status`);
    console.log(`      status distribution:`, dist);
  }
  if (r[0].c > 0) issues.push(`posts.${col} has ${r[0].c} non-default values`);
}

console.log('\n  users extra cols (non-NULL values):');
async function usersCol(col) {
  const [exists] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME=?`,
    [DB, col]);
  return exists[0].c > 0;
}
for (const col of USERS_DROP_COLS) {
  if (!(await usersCol(col))) { console.log(`    users.${col}: (column absent — already dropped)`); continue; }
  const r = await q(`SELECT COUNT(*) AS c FROM users WHERE \`${col}\` IS NOT NULL`);
  if (r[0].c > 0) {
    console.log(`    users.${col}: ${r[0].c} non-null  ⚠️`);
    issues.push(`users.${col} has ${r[0].c} non-null values`);
  } else {
    console.log(`    users.${col}: 0 non-null`);
  }
}

if (issues.length > 0) {
  console.log('\n⚠️  PRE-FLIGHT GATE: NON-DEFAULT DATA DETECTED:');
  for (const i of issues) console.log(`    - ${i}`);
  if (!ALLOW_NONDEFAULT) {
    await conn.end();
    throw new Error(
      `Refusing to drop because ${issues.length} target(s) hold data. ` +
      `Investigate the rows above. To override (after explicit human review), ` +
      `re-run with ALLOW_NONDEFAULT=true.`
    );
  }
  console.log('\nALLOW_NONDEFAULT=true set — proceeding with documented override.');
}

console.log('\n=== STEP 2: BUILDING MIGRATION SQL ===');

const migration = `-- Auto-generated database cleanup migration
-- Generated: ${new Date().toISOString()}
-- Database: ${DB}
-- Reference: docs/db-cleanup-report.md

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop unused columns and FK from posts (releases FK on feed_sources)
ALTER TABLE posts DROP FOREIGN KEY posts_source_feed_id_fk;
ALTER TABLE posts DROP INDEX posts_source_feed_idx;
ALTER TABLE posts DROP INDEX posts_status_idx;
ALTER TABLE posts DROP INDEX posts_content_text_fulltext;
ALTER TABLE posts
  DROP COLUMN status,
  DROP COLUMN source_feed_id,
  DROP COLUMN source_guid,
  DROP COLUMN source_canonical_url,
  DROP COLUMN content_text;

-- 2. Drop unused tables (children before parents)
DROP TABLE IF EXISTS feed_items_seen;
DROP TABLE IF EXISTS post_categories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS nav_links;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS feed_sources;

-- 3. Drop unused theming columns from users
ALTER TABLE users
  DROP COLUMN theme,
  DROP COLUMN palette,
  DROP COLUMN color_background,
  DROP COLUMN color_foreground,
  DROP COLUMN color_background_dark,
  DROP COLUMN color_foreground_dark,
  DROP COLUMN color_primary,
  DROP COLUMN color_primary_foreground,
  DROP COLUMN color_secondary,
  DROP COLUMN color_secondary_foreground,
  DROP COLUMN color_accent,
  DROP COLUMN color_accent_foreground,
  DROP COLUMN color_muted,
  DROP COLUMN color_muted_foreground,
  DROP COLUMN color_destructive,
  DROP COLUMN color_destructive_foreground;

-- 4. Drop the duplicate username index (keep users_username_unique)
ALTER TABLE users DROP INDEX username;

SET FOREIGN_KEY_CHECKS = 1;
`;

const date = new Date().toISOString().slice(0, 10);
const migPath = `docs/migrations/${date}-db-cleanup.sql`;
fs.mkdirSync(path.dirname(migPath), { recursive: true });
fs.writeFileSync(migPath, migration);
console.log(`  Wrote ${migPath}`);

console.log('\n=== STEP 3: EXECUTING MIGRATION ===');
await conn.query(migration);
console.log('  Migration executed successfully.');

console.log('\n=== STEP 4: VERIFICATION ===');
const [tablesAfter] = await conn.query(
  `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`,
  [DB]
);
const tableNames = tablesAfter.map(t => t.TABLE_NAME);
console.log('  Tables remaining:', tableNames.join(', '));

const expected = ['accounts','comments','posts','reactions','sessions','users','verification_tokens'].sort();
const actual = [...tableNames].sort();
const ok = JSON.stringify(expected) === JSON.stringify(actual);
console.log(`  Expected exactly: ${expected.join(', ')}`);
console.log(`  Match: ${ok ? '✓' : '✗'}`);
if (!ok) throw new Error('Surviving tables do not match expected set!');

const [postsCols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='posts' ORDER BY ORDINAL_POSITION`, [DB]);
console.log('  posts columns:', postsCols.map(c => c.COLUMN_NAME).join(', '));

const [usersCols] = await conn.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' ORDER BY ORDINAL_POSITION`, [DB]);
console.log('  users columns:', usersCols.map(c => c.COLUMN_NAME).join(', '));

const [usersIdx] = await conn.query(
  `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' GROUP BY INDEX_NAME ORDER BY INDEX_NAME`, [DB]);
console.log('  users indexes:', usersIdx.map(i => i.INDEX_NAME).join(', '));

console.log('\n  Row counts (post-migration):');
for (const t of tableNames) {
  const r = await q(`SELECT COUNT(*) AS c FROM \`${t}\``);
  console.log(`    ${t}: ${r[0].c}`);
}

await conn.end();
console.log('\n✓ Cleanup complete.');
