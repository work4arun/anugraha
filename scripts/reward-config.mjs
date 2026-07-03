import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'https://rathinamglobal.edu.in';
const LOGIN_URL = `${BASE_URL}/gc/admin`;
const REWARD_CONFIG_URL = `${BASE_URL}/gc/admin/qpa/reward-config`;

const USERNAME = 'rarunkumar@rathinam.in';
const PASSWORD = 'All4Good@123';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    try {
        // Step 1: Go to login page
        console.log('Navigating to login page...');
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(2000);

        console.log('Page title:', await page.title());
        console.log('Current URL:', page.url());

        // Step 2: Fill login form
        console.log('\nFilling login credentials...');

        // Wait for the email input to be visible
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        const emailInput = await page.$('input[type="email"]');
        if (emailInput) {
            await emailInput.click();
            await emailInput.type(USERNAME, { delay: 30 });
            console.log('Email entered');
        }

        await sleep(300);

        const passwordInput = await page.$('input[type="password"]');
        if (passwordInput) {
            await passwordInput.click();
            await passwordInput.type(PASSWORD, { delay: 30 });
            console.log('Password entered');
        }

        await sleep(300);

        // Click Sign In button
        const signInBtn = await page.$('button[type="submit"]');
        if (signInBtn) {
            await signInBtn.click();
            console.log('Clicked Sign In');
        } else {
            console.log('No submit button found');
            await page.keyboard.press('Enter');
        }

        console.log('Waiting for login to complete...');
        await sleep(5000);
        console.log('After login URL:', page.url());

        // Step 3: Navigate to reward config page
        console.log('\nNavigating to reward config page...');
        await page.goto(REWARD_CONFIG_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(3000);
        console.log('Reward config URL:', page.url());
        console.log('Page title:', await page.title());

        // Check if we're still on login page (auth failed)
        if (page.url().includes('/login') || page.url().includes('/gc/admin') && !page.url().includes('reward-config')) {
            console.log('Still on login page - authentication may have failed. Checking for error messages...');
            const errorText = await page.evaluate(() => {
                const errEl = document.querySelector('.text-red-500, .error, [role="alert"]');
                return errEl ? errEl.textContent : 'No error message found';
            });
            console.log('Error:', errorText);

            // Try again with a different approach - maybe the form needs to be submitted differently
            console.log('\nTrying alternative login approach...');

            // Clear and retry
            await page.evaluate(() => {
                const emailInput = document.querySelector('input[type="email"]');
                const passInput = document.querySelector('input[type="password"]');
                if (emailInput) emailInput.value = '';
                if (passInput) passInput.value = '';
            });

            await sleep(500);

            // Type credentials again
            const emailInput2 = await page.$('input[type="email"]');
            if (emailInput2) {
                await emailInput2.type(USERNAME, { delay: 20 });
            }

            const passwordInput2 = await page.$('input[type="password"]');
            if (passwordInput2) {
                await passwordInput2.type(PASSWORD, { delay: 20 });
            }

            await sleep(500);

            // Click Sign In
            const btn2 = await page.$('button[type="submit"]');
            if (btn2) {
                await btn2.click();
            }

            console.log('Waiting after retry login...');
            await sleep(8000);
            console.log('After retry URL:', page.url());

            // Try navigating again
            await page.goto(REWARD_CONFIG_URL, { waitUntil: 'networkidle2', timeout: 60000 });
            await sleep(3000);
            console.log('Final URL:', page.url());
        }

        // Step 4: Analyze the reward config page
        console.log('\n=== Analyzing Reward Config Page ===');

        const pageAnalysis = await page.evaluate(() => {
            const results = [];

            // All selects
            document.querySelectorAll('select').forEach(s => {
                results.push({
                    type: 'select',
                    id: s.id,
                    name: s.name,
                    class: s.className,
                    options: Array.from(s.options).map(o => ({
                        value: o.value,
                        text: o.text.trim()
                    }))
                });
            });

            // All tables
            document.querySelectorAll('table').forEach((t, i) => {
                results.push({
                    type: 'table',
                    index: i,
                    id: t.id,
                    class: t.className,
                    headers: Array.from(t.querySelectorAll('th')).map(h => h.textContent.trim()),
                    rowCount: t.rows.length,
                    rows: Array.from(t.querySelectorAll('tr')).map((tr, ri) => ({
                        index: ri,
                        cells: Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim())
                    }))
                });
            });

            // All links
            document.querySelectorAll('a').forEach(a => {
                const text = a.textContent.trim();
                if (text) {
                    results.push({
                        type: 'link',
                        text: text.substring(0, 200),
                        href: a.href,
                        class: a.className
                    });
                }
            });

            // All buttons
            document.querySelectorAll('button').forEach(b => {
                results.push({
                    type: 'button',
                    text: b.textContent.trim().substring(0, 200),
                    id: b.id,
                    class: b.className,
                    onclick: b.getAttribute('onclick')
                });
            });

            // All headings
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                results.push({
                    type: 'heading',
                    tag: h.tagName,
                    text: h.textContent.trim()
                });
            });

            // All inputs
            document.querySelectorAll('input:not([type="hidden"])').forEach(i => {
                results.push({
                    type: 'input',
                    name: i.name,
                    id: i.id,
                    type: i.type,
                    placeholder: i.placeholder,
                    value: i.value
                });
            });

            // All divs with id
            document.querySelectorAll('div[id]').forEach(d => {
                results.push({
                    type: 'div',
                    id: d.id,
                    class: d.className
                });
            });

            return results;
        });

        console.log('\n=== Page Analysis Results ===');
        pageAnalysis.forEach(item => console.log(JSON.stringify(item, null, 2)));

        // Save full HTML
        const html = await page.content();
        fs.writeFileSync('/tmp/rathinam-reward-config.html', html);
        console.log('\nFull HTML saved to /tmp/rathinam-reward-config.html');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }

    console.log('\nScript completed. Browser is open for inspection.');
}

main().catch(console.error);
