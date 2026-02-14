const { app, BrowserWindow, globalShortcut, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Using version 6.0.1 for require compatibility
const store = new Store();

let win;
let settingsWin;
let contextMenu;
let pips = 0;

// Load persisted settings
let keyUp = store.get('keyUp', ']');
let keyDown = store.get('keyDown', '[');
let isAlwaysOnTop = store.get('isAlwaysOnTop', false);

function registerShortcuts() {
    globalShortcut.unregisterAll();
    
    // Safety shortcut to open settings
    globalShortcut.register('CommandOrControl+Shift+S', createSettingsWindow);

    try {
        globalShortcut.register(keyUp, () => {
            if (pips < 85) pips++;
            if (win) win.webContents.send('update-pips', pips);
        });

        globalShortcut.register(keyDown, () => {
            if (pips > 0) pips--;
            if (win) win.webContents.send('update-pips', pips);
        });
    } catch (e) {
        console.log("Hotkeys Error: ", e);
    }
}

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 50,
        frame: false,
        transparent: false,
        alwaysOnTop: isAlwaysOnTop,
        resizable: false,
        movable: true, // Core property to allow OS-level dragging
        hasShadow: false,
        thickFrame: false, // Prevents Win11 rounded corners/thick borders
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');

    // Block maximization (prevents the "white screen" bug on double-click)
    win.on('maximize', () => {
        win.unmaximize();
    });

    // Build the English Context Menu
    contextMenu = Menu.buildFromTemplate([
        { 
            label: 'Settings', 
            click: () => { createSettingsWindow(); } 
        },
        { type: 'separator' },
        { 
            label: 'Exit', 
            click: () => { app.quit(); } 
        }
    ]);

    registerShortcuts();

    // Right-click trigger from the Renderer process
    ipcMain.on('show-context-menu', (event) => {
        const senderWin = BrowserWindow.fromWebContents(event.sender);
        if (senderWin && contextMenu) {
            contextMenu.popup(senderWin);
        }
    });

    win.on('closed', () => {
        win = null;
    });
}

function createSettingsWindow() {
    if (settingsWin) {
        settingsWin.focus();
        return;
    }

    settingsWin = new BrowserWindow({
        width: 280,
        height: 320,
        title: "Settings",
        parent: win,             // Makes it a child of the main overlay
        modal: false,            // Doesn't freeze the main window
        alwaysOnTop: true,       // Ensures it stays above the overlay
        resizable: false,
        minimizable: false,
        maximizable: false,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Force settings window to stay at the highest level
    settingsWin.setAlwaysOnTop(true, 'screen-saver');

    settingsWin.setMenuBarVisibility(false);
    settingsWin.loadFile('settings.html');
    
    settingsWin.on('closed', () => {
        settingsWin = null;
    });
}

// IPC Handlers
ipcMain.on('update-settings', (event, newSettings) => {
    keyUp = newSettings.keyUp;
    keyDown = newSettings.keyDown;
    isAlwaysOnTop = newSettings.isAlwaysOnTop;

    store.set('keyUp', keyUp);
    store.set('keyDown', keyDown);
    store.set('isAlwaysOnTop', isAlwaysOnTop);

    if (win) {
        win.setAlwaysOnTop(isAlwaysOnTop);
    }
    
    registerShortcuts();
});

ipcMain.on('sync-pips-count', (event, count) => {
    pips = count;
});

app.whenReady().then(createWindow);

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});