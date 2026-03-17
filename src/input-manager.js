/**
 * InputManager — Central input routing hub
 * Controls which input sources are active: keyboard, mouse, video (face tracking), controller.
 * Emits 'inputsourcechange' on window when a source is toggled.
 */

const DEFAULT_SOURCES = {
    keyboard: true,
    mouse: true,
    video: true,
    controller: true,
};

class InputManagerClass {
    constructor() {
        this._sources = { ...DEFAULT_SOURCES };
    }

    /**
     * Enable or disable a named input source.
     * @param {'keyboard'|'mouse'|'video'|'controller'} name
     * @param {boolean} enabled
     */
    setSource(name, enabled) {
        if (!(name in this._sources)) return;
        this._sources[name] = !!enabled;
        window.dispatchEvent(new CustomEvent('inputsourcechange', {
            detail: { source: name, enabled: !!enabled, all: { ...this._sources } }
        }));
    }

    /**
     * Toggle a named input source.
     * @param {'keyboard'|'mouse'|'video'|'controller'} name
     */
    toggleSource(name) {
        this.setSource(name, !this._sources[name]);
    }

    /**
     * Query if a source is currently enabled.
     * @param {'keyboard'|'mouse'|'video'|'controller'} name
     * @returns {boolean}
     */
    getSource(name) {
        return this._sources[name] ?? false;
    }

    /**
     * Get a snapshot of all source states.
     * @returns {{ keyboard: boolean, mouse: boolean, video: boolean, controller: boolean }}
     */
    getAll() {
        return { ...this._sources };
    }
}

// Singleton export
export const InputManager = new InputManagerClass();
