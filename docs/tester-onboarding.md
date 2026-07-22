# Zentext Tester Onboarding

Install Zentext from a locally packed tarball and run the core commands without any repository-specific knowledge.

## Install from tarball

```bash
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

## First commands

```bash
# See available commands
npx zentext --help

# Initialize Zentext for the current project
npx zentext init

# View current project memory
npx zentext status

# Generate a focused context payload
npx zentext repack

# Inspect a handoff
npx zentext handoff acknowledge
```

## Report back

When testing Zentext, report:

- installation failures
- unclear commands
- incorrect context
- repeated work
- invented work
- wrong stopping point
- stale-write handling
- package-boundary drift
- confusing errors
- uninstall or cleanup problems

Do not report whether you "like" the product. Report where it breaks or misleads.

## Cleanup

Zentext stores data under `~/.zentext/projects/`. To remove a project:

```bash
rm -rf ~/.zentext/projects/<project-id>
```
