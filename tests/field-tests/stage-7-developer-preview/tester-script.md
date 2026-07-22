# Tester Script for Stage 7

## Install

```bash
git clone https://github.com/zenithbuild/zentext.git
cd zentext
npm install
npm run build
npm pack

mkdir /tmp/zentext-consumer
cd /tmp/zentext-consumer
cat > package.json <<'JSON'
{
  "name": "zentext-consumer",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "allowScripts": {
    "better-sqlite3": true,
    "esbuild": true,
    "fsevents": true
  }
}
JSON
npm install --save /path/to/zentext-0.1.0.tgz
```

## Smoke test

```bash
cd /tmp/some-project
npx zentext init
npx zentext status
npx zentext repack
```

## Handoff test

Use a small Node script or the existing project records to create an active task, then:

```bash
npx zentext handoff create \
  --from agent:A \
  --stopping-point "Describe exactly where you stopped." \
  --next-action "Describe the very next step." \
  --completed "Completed item A" \
  --completed "Completed item B"

npx zentext handoff acknowledge
npx zentext handoff validate
```

## Report

Report any of these:

- installation failures
- unclear commands
- incorrect context
- repeated work
- invented work
- wrong stopping point
- stale-write handling problems
- confusing errors
- cleanup problems
