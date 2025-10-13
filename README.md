# Zedify

Enhanced YouTube volume control for Firefox.

## What It Does

Zedify adds a large, precise volume slider to YouTube video pages. The slider provides fine-grained control with 1% increments and supports both mouse and keyboard input.

Features:

- Large volume slider (up to 400px wide) placed next to YouTube's native controls
- Mouse wheel support: 5% steps (normal), 1% steps (with Shift)
- Keyboard arrow keys for 1% adjustments
- Volume percentage HUD display
- Auto-mute at 0% volume
- Syncs with YouTube's native controls and keyboard shortcuts
- Works in normal, theater, and fullscreen modes

## Installation

### Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to the `src` folder and select `manifest.json`

The extension will now be active on all YouTube pages.

### Building from Source

Requirements: PowerShell 5.0+

```powershell
git clone https://github.com/yourusername/zedify.git
cd zedify
.\tools\build.ps1
```

Output: `build/zedify-1.0.0.zip`

## Usage

Once installed, visit any YouTube video page. The enhanced volume slider will appear next to YouTube's native volume controls.

Controls:

- Click and drag the slider for precise positioning
- Use mouse wheel over the slider for quick adjustments
- Hold Shift while scrolling for fine 1% steps
- Press arrow up/down keys for 1% increments
- Press Home to mute, End for maximum volume

## Configuration

Edit `src/content.js` to customize behavior:

```javascript
const config = {
  sliderWidthPx: 400, // Maximum slider width
  sliderHeightPx: 12, // Track height
  knobSizePx: 16, // Knob size
  stepSize: 0.01, // 1% increments
  wheelStep: 0.05, // 5% per scroll
  shiftWheelStep: 0.01, // 1% per Shift+scroll
  showHudMs: 700, // HUD duration (ms)
};
```

## Technical Details

- Manifest V2 for Firefox compatibility
- Runs at document_end and handles YouTube SPA navigation
- Uses mutation observers to detect DOM changes
- Captures events before YouTube's handlers for reliable control
- No external dependencies

## License

MIT License - see LICENSE file for details.
