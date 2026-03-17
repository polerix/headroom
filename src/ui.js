export class UIManager {
    constructor() {
        this.settings = {
            audioSensitivity: 60.0,
            audioThreshold: 10,
            cameraSpeed: 0.05,
            theme: 'green'
        };
        this.currentTheme = 'green';
        this.THEME_COLORS = {
            green: { primary: '#00ff41', secondary: '#004411', accent: '#4040ff' },
            cyan: { primary: '#00ffff', secondary: '#004444', accent: '#0044ff' },
            magenta: { primary: '#ff00ff', secondary: '#440044', accent: '#4400ff' },
            yellow: { primary: '#ffff00', secondary: '#444400', accent: '#ffaa00' }
        };
    }

    init() {
        this.loadSettings();
        this.attachEventListeners();
    }

    setTheme(themeName) {
        const theme = this.THEME_COLORS[themeName] || this.THEME_COLORS.green;
        this.currentTheme = themeName;
        document.documentElement.style.setProperty('--neon-green', theme.primary);
        document.documentElement.style.setProperty('--glass-border', `rgba(${this.hexToRgb(theme.primary).join(', ')}, 0.2)`);
        document.documentElement.style.setProperty('--glass-bg', `rgba(${this.hexToRgb(theme.primary).join(', ')}, 0.05)`);
        this.settings.theme = themeName;
        this.saveSettings();
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 255, 65];
    }

    saveSettings() {
        localStorage.setItem('headroom-settings', JSON.stringify(this.settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('headroom-settings');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                this.settings = { ...this.settings, ...s };
                this.setTheme(this.settings.theme);

                const themeSelect = document.getElementById('theme-select');
                if (themeSelect) themeSelect.value = this.settings.theme;
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }

    attachEventListeners() {
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                document.getElementById('settings-panel').classList.toggle('show');
            });
        }

        const settingsCloseBtn = document.getElementById('settings-close');
        if (settingsCloseBtn) {
            settingsCloseBtn.addEventListener('click', () => {
                document.getElementById('settings-panel').classList.remove('show');
            });
        }

        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
    }
}
