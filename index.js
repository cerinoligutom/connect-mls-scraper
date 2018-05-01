const express = require('express');
const Xray = require('x-ray');
const xray = Xray();
const puppeteer = require('puppeteer');

require('dotenv').config();

const app = express();

app.listen(5051, async () => {
  console.log('STARTING');

  const params = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    status: process.env.STATUS_VALUE,
    searchPriceMin: process.env.SEARCH_PRICE_MIN,
    searchPriceMax: process.env.SEARCH_PRICE_MAX,
    monthsBack: process.env.MONTHS_BACK,
  };
  
  console.log('params:', params);

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 250
  });
  const page = await browser.newPage();

  await page.goto('https://sabor.connectmls.com/cvlogin.jsp');
});
