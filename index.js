const express = require('express');
const Xray = require('x-ray');
const xray = Xray();
const puppeteer = require('puppeteer');

require('dotenv').config();

const app = express();

app.listen(5051, async () => {
  const CREDENTIALS = {
    username: process.env.USERID,
    password: process.env.PASSWORD
  };

  const PARAMS = {
    status: process.env.STATUS_VALUE,
    searchPriceMin: process.env.SEARCH_PRICE_MIN,
    searchPriceMax: process.env.SEARCH_PRICE_MAX,
    monthsBack: process.env.MONTHS_BACK
  };

  console.log('credentials:', CREDENTIALS);
  console.log('params:', PARAMS);

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 10
  });
  const page = await browser.newPage();

  // Go to login page and authenticate
  await page.goto('https://sabor.connectmls.com/cvlogin.jsp');

  const USERNAME_SELECTOR =
    '.login-credentials .login-input input[name=userid]';
  const PASSWORD_SELECTOR =
    '.login-credentials .login-input input[name=password]';
  const SIGN_IN_SELECTOR = '.login-button input[name=login]';

  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(CREDENTIALS.username);

  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(CREDENTIALS.password);

  await page.click(SIGN_IN_SELECTOR);
  await page.waitFor(2 * 1000); // Workaround for now, waitForNavigation is not firing

  // Go to search Tab
  const SEARCH_SELECTOR = '#search > div';

  await page.click(SEARCH_SELECTOR);
  await page.waitFor(5 * 1000);

  // Manipulate search form
  let frame = await page.frames().find(f => f.name() === 'workspace');

  async function setElementValue(sel, val) {
    frame.evaluate(
      data => {
        return (document.querySelector(data.sel).value = data.val);
      },
      { sel, val }
    );
  }

  await setElementValue('#STATUSID', PARAMS.status);
  await setElementValue('#minSRCHPRICE', PARAMS.searchPriceMin);
  await setElementValue('#maxSRCHPRICE', PARAMS.searchPriceMax);
  await setElementValue('#MONTHS_BACKID', PARAMS.monthsBack);

  // Search results
  const VIEW_RESULTS_SELECTOR = await frame.$('#searchButtonTop');
  await VIEW_RESULTS_SELECTOR.click();
});
