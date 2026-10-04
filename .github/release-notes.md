## Download

| Computer | File |
|---|---|
| Mac with Apple chip (M1 or newer) | `Tramus-…-mac-arm64.dmg` |
| Mac with Intel processor | `Tramus-…-mac-x64.dmg` |
| Windows 10 or 11 (64-bit) | `Tramus-…-win-x64.exe` |
| Linux (Ubuntu 22.04 or newer, 64-bit) | `Tramus-…-linux-x86_64.AppImage` |

Not sure which Mac you have? Apple menu → About This Mac: "Chip" means Apple, "Processor" means Intel. Tramus needs macOS 14 (Sonoma) or newer.

## First launch

These builds aren't signed with a paid developer certificate yet, so your computer warns you the first time you open Tramus.

- **macOS:** open the `.dmg` and drag Tramus to Applications. Open it once. When macOS says it can't verify the app, go to System Settings → Privacy & Security, scroll down and click **Open Anyway**.
- **Windows:** when "Windows protected your PC" appears, click **More info** → **Run anyway**.
- **Linux:** make the file executable (`chmod +x Tramus-*.AppImage`), then run it. If it won't start, install FUSE (`sudo apt install libfuse2`, or `libfuse2t64` on Ubuntu 24.04). On Ubuntu 24.04 and later, if it still won't start, run it with `--no-sandbox`.

Tramus runs entirely on your computer: videos and results are never uploaded.
