// LocalStorage utility

const STORAGE_KEYS = {
  SETTINGS: 'energySettings',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
  LAST_PAGE: 'lastPage'
};

class StorageService {
  // Settings
  getSettings() {
    const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return settings ? JSON.parse(settings) : null;
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Theme
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  }

  saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  // Sidebar state
  getSidebarCollapsed() {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  }

  saveSidebarCollapsed(collapsed) {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed.toString());
  }

  // Last visited page
  getLastPage() {
    return localStorage.getItem(STORAGE_KEYS.LAST_PAGE) || 'dashboard';
  }

  saveLastPage(page) {
    localStorage.setItem(STORAGE_KEYS.LAST_PAGE, page);
  }

  // Clear all
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

export default new StorageService();
