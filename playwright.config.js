// UI tests for the admin dashboard and the public blog pages, on desktop and mobile.
// Runs against tests/mock-supabase.js, never the real Supabase project.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'tests/ui',
    fullyParallel: false,
    workers: 1, // the mock keeps one in-memory database
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:8790',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 1366 } } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: {
        command: 'node tests/mock-supabase.js',
        url: 'http://127.0.0.1:8790/admin/index.html',
        reuseExistingServer: false,
    },
});
