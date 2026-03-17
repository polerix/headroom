# 🌊 Max Headroom 3D Lip Sync 🌊

💧 An interactive 3D wireframe and textured lip-sync experiment featuring a controllable Max Headroom model with real-time audio-reactive animation. 🫧

## 🐚 Features

- **Phonetic Lip Sync**: Real-time mouth animation with 8 phonetic shapes that respond to audio input, styled like paper cutout mouth animations, flowing like water.
- **Interactive Eye Control**: Independent eye movement controlled via keyboard or gamepad analog sticks with smooth interpolation.
- **Gamepad Support**: Full PS4/Xbox controller support for puppet-style character puppetry with analog stick character control.
- **Multiple Rendering Modes**: Switch between four distinct visual styles:
  - Wireframe (neon grid)
  - Flat Shaded (solid colors)
  - Cyber-Glow (emissive materials with glow effects)
  - Opaque-Textured (full material rendering)
- **Animated Sunglasses**: Toggle Max's iconic sunglasses with physics-based drop animation.
- **Cyber-Console UI**: Retro 80s-inspired interface with adjustable settings.
- **Real-time Audio Analysis**: Web Audio API integration for dynamic, responsive mouth movement.
- **Performance Monitoring**: Optional FPS counter and performance metrics.

## 💧 Controls

### 🐚 Character Animation
| Key | Action |
|-----|--------|
| ↑ ↓ ← → | Rotate Head |
| I / J / K / L | Move Eyes |
| G | Toggle Sunglasses |
| SPACE | Force Jaw Open |

### 🌊 Camera & View
| Key | Action |
|-----|--------|
| W / A / S / D | Rotate & Zoom Camera |
| SHIFT + W / A / S / D | Translate Camera |
| SHIFT | Toggle Camera Mode |
| Mouse Drag | Rotate Camera View |

### 🫧 Render Modes
| Key | Mode |
|-----|------|
| 1 | Wireframe |
| 2 | Flat Shaded |
| 3 | Cyber-Glow (Default) |
| 4 | Opaque-Textured |

### 🐚 Interface
| Key | Action |
|-----|--------|
| ? | Show Controls Reference |
| F | Toggle Fullscreen |
| ESC | Close Panels |

### 💧 Gamepad Controller (PS4 / Xbox)
| Input | Action |
|-------|--------|
| Left Stick | Head Rotation |
| Right Stick | Eye Movement |
| D-Pad | Discrete Head Rotation |
| A / Cross | Force Jaw Open |
| X / Square | Toggle Sunglasses |
| Start | Show Controls |
| Back / Select | Close Panels |

**Note**: See [CONTROLLER.md](CONTROLLER.md) for detailed gamepad documentation and customization options.

## 🌊 Requirements

- **Browser**: Modern browser with WebGL 2.0 support (Chrome, Firefox, Safari, Edge) 🫧
- **Audio**: Microphone access required for audio-reactive features 🐚
- **Performance**: Recommended GPU for smooth rendering in Opaque mode 💧

## 🐚 Setup & Development

### 🌊 Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5173` (or port shown in terminal)

3. **Build for Production**:
   ```bash
   npm run build
   ```
   Output is generated in the `dist/` folder.

4. **Preview Production Build**:
   ```bash
   npm run preview
   ```

## 🫧 Technical Architecture

- **Framework**: [Vite](https://vitejs.dev/) - Fast build tool and dev server 🌊
- **3D Engine**: [Three.js](https://threejs.org/) - WebGL 3D graphics 💧
- **Model Format**: OBJ/MTL with high-resolution textures 🐚
- **Audio Processing**: Web Audio API with FFT frequency analysis 🫧
- **Input Handling**: Keyboard + Gamepad API for cross-platform controller support
- **Rendering Techniques**:
  - Custom shader materials for cyber-glow effects
  - Wireframe rendering with edge detection
  - Emissive and metallic material properties
  - Depth-based transparency

## 🐚 Project Structure

```
headroom/
├── index.html                    # Main HTML entry point
├── package.json                 # Dependencies and scripts
├── src/
│   ├── main.js                 # Core application logic
│   ├── gamepad-controller.js   # Gamepad/Controller handler
│   └── style.css               # Styling and UI
├── textures/                    # Model textures (normals, etc.)
├── README.md                    # Main documentation
├── CONTROLLER.md               # Gamepad controller guide
└── uploads_files_5692496_max+headroom.mtl  # 3D model
```

## 🌊 Browser Compatibility

Requires WebGL 2.0 support with audio input capabilities:
- ✅ Chrome/Chromium 56+
- ✅ Firefox 51+
- ✅ Safari 15+
- ✅ Edge 79+

## 🫧 Audio Permissions

The application requires microphone access to work with audio-reactive features. You will be prompted to allow access on first launch. 💧

## 🐚 Credits

Created as an interactive 3D web experiment exploring audio-reactive animation and retro-futuristic UI design. 🌊

---
*Be like water, my friend. It can flow or it can crash.* 🌊
