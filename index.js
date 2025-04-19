const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Va sur PS3838
  await page.goto('https://www.ps3838.com/fr/sports/soccer', { waitUntil: 'networkidle0' });
  await page.waitForSelector('table tbody tr');

  // Récupère jusqu'à 30 URLs de matchs
  const matchUrls = await page.$$eval(
    'table tbody tr td a[href*="/sports/soccer/"]',
    els => els.slice(0,30).map(a => a.href)
  );

  const signals = [];
  for (const url of matchUrls) {
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Déplie +X si présent
    const plus = await page.$x("//button[starts-with(text(), '+')]");
    if (plus.length) await plus[0].click();
    await page.waitForTimeout(2000);

    // Clique onglet Corners
    const [tab] = await page.$x("//button[contains(translate(., 'CORNERS','corners'),'corners')]");
    if (tab) {
      await tab.click();
      await page.waitForTimeout(2000);
    }

    // Extrait ligne/cotes
    const data = await page.$$eval(
      '.marketGroupContainer:has-text(\"Corners\") tr',
      rows => rows.map(r => {
        const texts = Array.from(r.querySelectorAll('td')).map(td=>td.innerText.trim());
        const line = texts.find(t=>/\d/.test(t));
        const odds = texts.filter(t=>/^\d+(\.\d+)?$/.test(t)).map(parseFloat);
        if (!line || odds.length < 2) return null;
        const [over, under] = odds;
        return { match: window.location.href, line, over, under };
      }).filter(Boolean)
    );
    signals.push(...data);
  }

  await browser.close();
  fs.writeFileSync('output.json', JSON.stringify(signals, null, 2));
  console.log(`Found ${signals.length} signals`);
})();
