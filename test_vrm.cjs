const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    console.log('Clicking start button...');
    await page.click('#start-btn');

    await page.waitForTimeout(2000);
    console.log('Test complete closing...');
    await browser.close();
})();
