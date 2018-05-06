const express = require('express');
const puppeteer = require('puppeteer');
const _ = require('lodash');
const csvjson = require('csvjson');
const fs = require('fs');
const fsPath = require('fs-path');
const path = require('path');
const chalk = require('chalk');
const log = console.log;

require('dotenv').config();

const app = express();

function waitForFrame(page, frameName) {
  let fulfill;
  const promise = new Promise(x => (fulfill = x));
  checkFrame();
  return promise;

  function checkFrame() {
    const frame = page.frames().find(f => f.name() === framename);
    if (frame) fulfill(frame);
    else page.once('frameattached', checkFrame);
  }
}

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

app.listen(5051, async () => {
  log(chalk.bold.magenta('Opening browser...'));
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 10
  });
  const page = await browser.newPage();

  // Go to login page and authenticate
  log(chalk.bold.magenta('Automagically signing in...'));
  const loginDomain = 'https://sabor.connectmls.com';
  await page.goto(`${loginDomain}/cvlogin.jsp`);

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
  await page.waitForSelector('#search > div');

  // Go to search Tab
  log(chalk.bold.magenta('Successfully signed in!'));
  log(chalk.bold.magenta('Navigating to search form...'));
  const SEARCH_SELECTOR = '#search > div';

  await page.click(SEARCH_SELECTOR);
  await page.waitFor(+process.env.NAVIGATE_TO_SEARCH_FORM_DELAY);

  // Manipulate search form
  log(chalk.bold.magenta('Automagically filling up details...'));
  let workspaceFrame = await page.frames().find(f => f.name() === 'workspace');

  async function setElementValue(sel, val) {
    workspaceFrame.evaluate(
      data => {
        return (document.querySelector(data.sel).value = data.val);
      },
      { sel, val }
    );
  }

  await workspaceFrame.waitForSelector('.searchFieldContainer > table');

  await setElementValue('#STATUSID', PARAMS.status);
  await setElementValue('#minSRCHPRICE', PARAMS.searchPriceMin);
  await setElementValue('#maxSRCHPRICE', PARAMS.searchPriceMax);
  await setElementValue('#MONTHS_BACKID', PARAMS.monthsBack);

  // Search results
  log(chalk.bold.magenta('Waiting for results...'));
  const searchButton = await workspaceFrame.$('#searchButtonTop');
  await searchButton.click();
  await workspaceFrame.waitForSelector('div#listingspane');

  log(chalk.bold.magenta('Preparing magic...'));
  let table = await workspaceFrame.$('div#listingspane > table');
  let rows = await table.$$('tr');
  let firstRow = await rows.find((row, index) => {
    if (index === 1) return row;
  });
  let firstRowMLSNumber = await firstRow.$('td:nth-child(3)');
  let link = await firstRowMLSNumber.$('a');
  await link.click();

  // Listing
  await workspaceFrame.waitForSelector('div#listingspane div.report');
  let domain = page.url().match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i)[0];

  let navpanelFrame = await page.frames().find(f => f.name() === 'navpanel');

  let totalListings = await navpanelFrame.$eval(
    'table td:nth-child(3) b:nth-child(2)',
    element => +element.innerText
  );
  let currentListingCount = 1;

  let allAgentDetails = [];

  log(chalk.bold.magenta('Magic start!'));  
  while (currentListingCount <= totalListings) {
    if (currentListingCount === 5) break;
    log(chalk.bold.bgGreen.white(`Processing listing ${currentListingCount} out of ${totalListings}`));
    let agentDetails = {
      Name: '',
      Company: '',
      Email: '',
      Office: '',
      DirectLine: '',
      Cell: '',
      Fax: '',
      PersonalFax:''
    };

    let nextButton = await navpanelFrame.$(
      'table td:nth-child(4) > div.nextBtn'
    );

    let agentTable = await workspaceFrame.$(
      'div#listingspane div.report table:nth-child(8)'
    );
    let agentLink = await agentTable.$('tr:nth-child(2) td:nth-child(2) a');
    let href = await agentLink.getProperty('href');
    let value = await href.jsonValue();
    value = value.split(`'`)[1];

    await nextButton.click();
    await navpanelFrame.waitFor(+process.env.LISTING_PAGE_DELAY);

    let currentAgentPage = await browser.newPage();
    await currentAgentPage.goto(`${domain}${value}`, { waitUntil: 'load' });
    await currentAgentPage.waitFor(+process.env.AGENT_PAGE_DELAY);

    let agent = await currentAgentPage.$eval(
      'table table table table tr strong',
      element => element.innerText
    );
    log(chalk.bold.green(`Agent Name: ${agent}`));

    let details = await currentAgentPage.$eval(
      'table table table table tr:nth-child(2) td:last-child',
      element => element.innerText.split('\n')
    );
    log(chalk.bold.green(`Raw details scraped:`));
    log(chalk.bold.green(JSON.stringify(details, null, 2)));

    agentDetails.Name = agent.split(',')[0];
    agentDetails.Company = details.shift(); // First item, set company

    let detailsLastItem = details[details.length - 1].trim();
    if (detailsLastItem.includes('@')) {
      agentDetails.Email = detailsLastItem; // Set email
      details.pop();
    }

    details.forEach(detail => {
      detail = detail.trim().toLowerCase();

      if (detail.startsWith('office')) {
        detail = detail.replace('office', '').trim();
        agentDetails.Office = detail;
      } else if (detail.startsWith('direct line')) {
        detail = detail.replace('direct line', '').trim();
        agentDetails.DirectLine = detail;
      } else if (detail.startsWith('cell')) {
        detail = detail.replace('cell', '').trim();
        agentDetails.Cell = detail;
      } else if (detail.startsWith('fax')) {
        detail = detail.replace('fax', '').trim();
        agentDetails.Fax = detail;
      } else if (detail.startsWith('personal fax')) {
        detail = detail.replace('personal fax', '').trim();
        agentDetails.PersonalFax = detail;
      } else if (detail.includes('@')) {
        agentDetails.Email = detail;
      }
    });

    log(chalk.bold.blue(`Processed details:`));
    log(chalk.bold.blue(JSON.stringify(agentDetails, null, 2)));
    log('');

    allAgentDetails.push(agentDetails);
    await currentAgentPage.close();
    currentListingCount++;
  }

  await browser.close();

  log(chalk.bold.magenta('Preparing data for writing to CSV...'));

  let dateNow = new Date().getTime();

  let csv = csvjson.toCSV(allAgentDetails, {
    headers: 'key',
    wrap: true
  });

  const instancePath = (fileName) => {
    return path.join(__dirname, `output/instances${(fileName) ? `/${fileName}`: ''}`);
  }

  const checkpointsPath = (fileName) => {
    return path.join(__dirname, `output/checkpoints${(fileName) ? `/${fileName}`: ''}`);
  }

  const outputPath = (fileName) => {
    return path.join(__dirname, `output${(fileName) ? `/${fileName}`: ''}`);
  }

  log(chalk.bold.magenta(`Writing instance data to file @ ${instancePath(`${dateNow}.csv`)}...`));
  fsPath.writeFileSync(instancePath(`${dateNow}.csv`), csv, 'utf8');
  log(chalk.bold.magenta('Successfully written to instances!'));

  log(chalk.bold.magenta('Checking if agents.csv exists...'));
  if (!fs.existsSync(outputPath('agents.csv'))) {
    log(chalk.bold.red('agents.csv NOT FOUND! Initializing...'));

    fsPath.writeFileSync(checkpointsPath(`agents-${dateNow}.csv`), csv, 'utf8'); 
    fsPath.writeFileSync(outputPath(`agents.csv`), csv, 'utf8'); 

    log(chalk.bold.magenta('Done!'));
    log('');

    log(chalk.bold.magenta('---------------------- SUMMARY ----------------------'));
    log(chalk.bold.magenta(`-> Number of NEW agents FOUND for this scrape instance: ${allAgentDetails.length}`));
  } else {
    log(chalk.bold.magenta('agents.csv FOUND! Preparing...'));      

    let data = fs.readFileSync(outputPath('agents.csv'), { encoding: 'utf8' });
    data = csvjson.toSchemaObject(data, { quote: true });

    let dataCountBefore = data.length;
    let agentsUpdatedCount = 0;

    log(chalk.bold.magenta('Updating data...'));
    
    allAgentDetails.forEach(agent => {
      let dataAgentIndex = _.findIndex(data, dataAgent => dataAgent.Name === agent.Name);

      // If agent exists, update fields
      if (dataAgentIndex > -1) {
        agentsUpdatedCount++;
        let dataAgent = data[dataAgentIndex];
        for (let key in agent) {
          // Condition to NOT REPLACE existing dataAgent if newly scraped agent has no value for it
          if (!!agent[key].trim()) {
            dataAgent[key] = agent[key];
          }
        } 
      } else {  // Agent is new, insert
        data.push(agent);
      }
    });

    let dataCountAfter = data.length;

    fsPath.writeFileSync(checkpointsPath(`agents-${dateNow}.csv`), csv, 'utf8');     
    fsPath.writeFileSync(outputPath(`agents.csv`), csv, 'utf8');

    log(chalk.bold.magenta('Done!'));
    log('');

    log(chalk.bold.magenta('---------------------- SUMMARY ----------------------'));
    log(chalk.bold.magenta(`-> Number of agents BEFORE this scrape instance: ${dataCountBefore}`));
    log(chalk.bold.magenta(`-> Number of agents AFTER this scrape instance: ${dataCountAfter}`));
    log(chalk.bold.magenta(`-> Number of EXISTING (and possibly updated) agents for this scrape instance: ${agentsUpdatedCount}`));    
    log(chalk.bold.magenta(`-> Number of NEW agents FOUND for this scrape instance: ${dataCountAfter - dataCountBefore}`));
  }

  process.exit(0);
});
