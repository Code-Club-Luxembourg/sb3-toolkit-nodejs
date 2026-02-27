# CLI: pack

Package a Scratch `.sb3` project into a standalone HTML file using [TurboWarp Packager](https://packager.turbowarp.org/).

## Usage

```bash
npm run sb3:pack -- <project.sb3> -o <output.html> --stage-width <px> --stage-height <px> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output `.html` file path (required) |
| `--stage-width <px>` | Stage width in pixels (required) |
| `--stage-height <px>` | Stage height in pixels (required) |
| `--autoplay` | Start the project automatically on load |
| `--countdown-seconds <seconds>` | Inject a reload-on-change script; writes a SHA-256 checksum file |
| `--checksum-file <file>` | Path for the checksum file (default: `<output>.sha256`) |
| `--checksum-url <url>` | URL the injected script fetches to check for changes (default: basename of checksum file) |

## Examples

Basic pack at double resolution:
```bash
npm run sb3:pack -- project.sb3 -o project.html --stage-width 960 --stage-height 720
```

Autoplay with a 60-second countdown that reloads when the project changes:
```bash
npm run sb3:pack -- project.sb3 -o project.html \
  --stage-width 960 --stage-height 720 \
  --autoplay --countdown-seconds 60
```

## Output

```
Packed <project.sb3> to <output.html>
```

## Notes

- `--countdown-seconds` enables a live-reload mechanism: the packed HTML polls the checksum URL and reloads the page when the checksum changes. Useful for kiosk or classroom setups where the teacher re-packs and re-deploys while the page is open.
- The checksum file contains the SHA-256 hash of the output HTML. Regenerate it by re-running `pack` after any change.
