# ScreenFlow Player

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Multi-Display Setup

### Running multiple screens from one PC

Create one Windows shortcut per screen. Right-click desktop → New → Shortcut. Set the target like this:

**Screen 1 (Monitor 0):**
`"C:\Program Files\ScreenFlow Player\ScreenFlow Player.exe" --display=0 --device-id=YOUR-DEVICE-ID-1 --server=http://192.168.1.50:8000`

**Screen 2 (Monitor 1):**
`"C:\Program Files\ScreenFlow Player\ScreenFlow Player.exe" --display=1 --device-id=YOUR-DEVICE-ID-2 --server=http://192.168.1.50:8000`

**Screen 3 (Monitor 2):**
`"C:\Program Files\ScreenFlow Player\ScreenFlow Player.exe" --display=2 --device-id=YOUR-DEVICE-ID-3 --server=http://192.168.1.50:8000`

### Auto-start all screens on boot

Place all shortcuts in:
`C:\Users\YourUser\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

All instances will launch automatically when Windows starts.

### Linux (AppImage)

```bash
./ScreenFlow-Player.AppImage --display=0 --device-id=xxx --server=http://192.168.1.50:8000
./ScreenFlow-Player.AppImage --display=1 --device-id=yyy --server=http://192.168.1.50:8000
```

Add to `/etc/xdg/autostart/` for boot launch.

## Getting Device IDs

1. Open ScreenFlow dashboard
2. Go to Screens → Register Screen for each TV
3. Copy the Device ID shown on each screen card
4. Paste into the shortcut target as `--device-id=`
