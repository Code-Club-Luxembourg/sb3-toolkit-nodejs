# CLI: project-download

Download a single Scratch project by its ID from the Scratch API.

## Usage

```bash
npm run sb3:project-download -- <project_id> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output-dir <dir>` | Output directory for the `.sb3` file (default: `project_downloads`) |
| `--delay <seconds>` | Delay between asset download requests (default: `0.2`) |
| `--no-skip-existing` | Re-download even if the `.sb3` already exists and the remote project has not changed |

## Examples

Download project `123456789` to the default directory:
```bash
npm run sb3:project-download -- 123456789
```

Download to a specific directory with a shorter delay:
```bash
npm run sb3:project-download -- 123456789 -o ./downloads --delay 0.1
```

## Output

```
Downloaded <project_id> -> <output.sb3>
Done. Downloaded 1 project(s).
```

## Notes

- The output file is named `<projectId>.sb3`.
- A `<projectId>.meta.json` sidecar file is written alongside the `.sb3`. It stores the last seen `history.modified` timestamp and `project_token`, so subsequent runs can skip the download if nothing has changed — including rapid successive edits within the same modification timestamp.
- If the project token returns raw JSON instead of a zip, assets are fetched individually and repackaged into a proper `.sb3`.
- Use `--no-skip-existing` to force a fresh download regardless of the sidecar state.
