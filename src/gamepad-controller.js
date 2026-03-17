/**
 * GamepadController — PS4 / Xbox controller input handler for Max Headroom
 *
 * PS4 DualShock 4 Standard Gamepad API layout:
 *   Buttons: 0=✕  1=○  2=□  3=▲  4=L1  5=R1  6=L2  7=R2
 *            8=Share  9=Options  10=L3  11=R3  12=↑  13=↓  14=←  15=→  16=PS
 *   Axes:    0=LX  1=LY  2=RX  3=RY
 *
 * Control scheme:
 *   Left  stick       → Head yaw / pitch
 *   Right stick       → Camera orbit (default) | Eye look (while L2 held)
 *   L2 held           → Engage eye-look mode on right stick
 *   R2 analog         → Jaw open (analog pressure)
 *   ✕  (0)            → Jaw snap open (digital)
 *   ○  (1)            → Calibrate head zero
 *   □  (2)            → Toggle sunglasses
 *   ▲  (3)            → Cycle render mode
 *   D-pad ↑↓←→        → Discrete head rotation
 *   Share (8)         → Help modal
 *   Options (9)       → Settings panel
 */

const BTN = {
  CROSS: 0,   // ✕
  CIRCLE: 1,   // ○
  SQUARE: 2,   // □
  TRIANGLE: 3,   // ▲
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  SHARE: 8,
  OPTIONS: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DN: 13,
  DPAD_L: 14,
  DPAD_R: 15,
  PS: 16,
};

const AXES = { LX: 0, LY: 1, RX: 2, RY: 3 };

class GamepadController {
  constructor() {
    this.controllers = {};
    this.isActive = false;
    this.deadzone = 0.12;
    this.sensitivity = 1.0;

    // Processed output state (read each frame by main loop)
    this.headRotation = { x: 0, y: 0 };   // yaw / pitch delta
    this.eyeMovement = { x: 0, y: 0 };   // eye look delta
    this.cameraRotation = { x: 0, y: 0 };   // orbit delta

    // Button-driven flags
    this.jawOpenAnalog = 0;      // 0–1 from R2 trigger
    this.isSpacebarPressed = false;  // digital jaw (✕)
    this.sunglassesToggle = false;  // set true on □, cleared by consumer
    this.renderCycleToggle = false;  // set true on ▲, cleared by consumer
    this.calibrateToggle = false;  // set true on ○, cleared by consumer

    // Internal
    this._eyeMode = false;           // true while L2 held
    this._pollingId = null;

    window.addEventListener('gamepadconnected', e => this._onConnect(e));
    window.addEventListener('gamepaddisconnected', e => this._onDisconnect(e));
  }

  /* -------- connection -------- */

  _onConnect(event) {
    const gp = event.gamepad;
    console.log(`🎮 Gamepad connected [${gp.index}]: ${gp.id}`);
    this.controllers[gp.index] = {
      gamepad: gp,
      prevButtons: new Array(gp.buttons.length).fill(false),
    };
    this.isActive = true;
    this._updateStatus();
    if (!this._pollingId) this._poll();
  }

  _onDisconnect(event) {
    const idx = event.gamepad.index;
    console.log(`🎮 Gamepad disconnected [${idx}]`);
    delete this.controllers[idx];
    if (Object.keys(this.controllers).length === 0) {
      this.isActive = false;
      this._pollingId = null;
    }
    this._updateStatus();
  }

  _poll() {
    this.update();
    if (this.isActive) {
      this._pollingId = requestAnimationFrame(() => this._poll());
    }
  }

  /* -------- per frame -------- */

  update() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;
      if (!this.controllers[i]) {
        this.controllers[i] = {
          gamepad: gp,
          prevButtons: new Array(gp.buttons.length).fill(false),
        };
      }
      this._process(gp, i);
    }
  }

  _process(gp, idx) {
    const ctrl = this.controllers[idx];
    if (!ctrl) return;

    /* ---- buttons ---- */
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed;
      const wasPressed = ctrl.prevButtons[i];
      if (pressed && !wasPressed) this._onBtnDown(i);
      if (!pressed && wasPressed) this._onBtnUp(i);
      ctrl.prevButtons[i] = pressed;
    }

    /* ---- analog sticks ---- */
    const lx = this._dz(gp.axes[AXES.LX]);
    const ly = this._dz(gp.axes[AXES.LY]);
    const rx = this._dz(gp.axes[AXES.RX]);
    const ry = this._dz(gp.axes[AXES.RY]);

    // L2 value for eye mode (some browsers give L2 as button value, others axis)
    const l2Val = gp.buttons[BTN.L2]?.value ?? 0;
    const r2Val = gp.buttons[BTN.R2]?.value ?? 0;
    this._eyeMode = l2Val > 0.1;

    // D-pad discrete nudge
    const dpU = gp.buttons[BTN.DPAD_UP]?.pressed ? 1 : 0;
    const dpD = gp.buttons[BTN.DPAD_DN]?.pressed ? 1 : 0;
    const dpL = gp.buttons[BTN.DPAD_L]?.pressed ? 1 : 0;
    const dpR = gp.buttons[BTN.DPAD_R]?.pressed ? 1 : 0;

    // Head: left stick + d-pad
    this.headRotation.x = (lx + (dpR - dpL)) * this.sensitivity;
    this.headRotation.y = (ly + (dpD - dpU)) * this.sensitivity;

    if (this._eyeMode) {
      // L2 held: right stick drives eyes
      this.eyeMovement.x = rx * this.sensitivity;
      this.eyeMovement.y = ry * this.sensitivity;
      this.cameraRotation.x = 0;
      this.cameraRotation.y = 0;
    } else {
      // Normal: right stick drives camera orbit
      this.cameraRotation.x = rx * this.sensitivity;
      this.cameraRotation.y = ry * this.sensitivity;
      this.eyeMovement.x = 0;
      this.eyeMovement.y = 0;
    }

    // R2 analog jaw
    this.jawOpenAnalog = r2Val;
  }

  _onBtnDown(b) {
    switch (b) {
      case BTN.CROSS: this.isSpacebarPressed = true; break;
      case BTN.SQUARE: this.sunglassesToggle = true; break;
      case BTN.TRIANGLE: this.renderCycleToggle = true; break;
      case BTN.CIRCLE: this.calibrateToggle = true; break;
      case BTN.SHARE:
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
        break;
      case BTN.OPTIONS:
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', key: 'o' }));
        break;
    }
  }

  _onBtnUp(b) {
    if (b === BTN.CROSS) this.isSpacebarPressed = false;
  }

  _dz(v) {
    if (Math.abs(v) < this.deadzone) return 0;
    const sign = Math.sign(v);
    return sign * (Math.abs(v) - this.deadzone) / (1 - this.deadzone);
  }

  /* -------- UI status -------- */

  _updateStatus() {
    window.dispatchEvent(new CustomEvent('gamepadstatuschange', {
      detail: this.getStatus()
    }));
  }

  /* -------- public API -------- */

  getHeadRotation() { return { ...this.headRotation }; }
  getEyeMovement() { return { ...this.eyeMovement }; }
  getCameraRotation() { return { ...this.cameraRotation }; }
  getCameraTranslate() { return { x: 0, y: 0, z: 0 }; }

  isSpacePressed() { return this.isSpacebarPressed; }
  isSunglassesToggled() { return this.sunglassesToggle; }
  clearSunglassesToggle() { this.sunglassesToggle = false; }

  isRenderCycled() { return this.renderCycleToggle; }
  clearRenderCycleToggle() { this.renderCycleToggle = false; }

  isCalibrating() { return this.calibrateToggle; }
  clearCalibrateToggle() { this.calibrateToggle = false; }

  getJawAnalog() { return this.jawOpenAnalog; }

  setSensitivity(v) { this.sensitivity = Math.max(0.1, Math.min(3.0, v)); }
  setDeadzone(v) { this.deadzone = Math.max(0, Math.min(0.5, v)); }

  getStatus() {
    const ctrlList = Object.values(this.controllers);
    if (!ctrlList.length) return { connected: false, name: '---', count: 0 };
    const first = ctrlList[0].gamepad;
    // Try to extract a short readable name
    const name = first.id
      .replace(/Unknown Gamepad|STANDARD GAMEPAD/gi, '')
      .replace(/\(.*?\)/g, '')
      .trim()
      .slice(0, 24) || 'Controller';
    return { connected: true, name, count: ctrlList.length };
  }

  getConnectedControllers() {
    return Object.keys(this.controllers).map(i => ({
      index: parseInt(i),
      id: this.controllers[i].gamepad.id,
    }));
  }
}

export default GamepadController;
