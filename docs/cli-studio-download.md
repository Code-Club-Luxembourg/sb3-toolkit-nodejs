# CLI: studio-download

Download all projects from a Scratch studio via the Scratch API.

## Usage

```bash
npm run sb3:studio-download -- <studio_id> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output-dir <dir>` | Output directory for `.sb3` files (default: `studio_downloads`) |
| `--page-size <count>` | Projects per API page (default: `40`) |
| `--max-projects <count>` | Stop after downloading this many projects; `0` means no limit (default: `0`) |
| `--delay <seconds>` | Delay between API requests (default: `0.2`) |
| `--no-skip-existing` | Re-download even if the `.sb3` already exists and the remote project has not changed |

## Examples

Download all projects from studio `1234567`:
```bash
npm run sb3:studio-download -- 1234567
```

Download up to 10 projects with a shorter delay:
```bash
npm run sb3:studio-download -- 1234567 --max-projects 10 --delay 0.1
```

Download to a custom directory:
```bash
npm run sb3:studio-download -- 1234567 -o ./my-studio
```

## Output

```
Downloaded <project_id> -> <output.sb3>
...
Done. Downloaded <N> project(s). (X failed)
```

The failure count is only shown when at least one project failed.

## Notes

- Output files are named `<projectId>.sb3`.
- A `<projectId>.meta.json` sidecar is written for each project. It stores the last seen `history.modified` timestamp and `project_token`, so unchanged projects are skipped on subsequent runs — including rapid successive edits within the same modification timestamp.
- If a project token returns raw JSON instead of a zip, assets are fetched individually and repackaged.
- Projects that fail to download are counted and reported in the summary line; the command continues with remaining projects.
- Use `--no-skip-existing` to force re-download of all projects regardless of sidecar state.
