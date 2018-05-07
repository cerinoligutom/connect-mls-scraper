# connect-mls-scraper

An agent scraper for Connect MLS

# Features
* Have 4 inputs available that can be manipulated in the `.env` file
  * Status
  * Search Minimum Price
  * Search Maximum Price
  * Months Back
* Summary for scraped data
* Cross checks and updates fields of agents when duplicates are found
* Creates 3 outputs
  1. For accumulated data
  2. Checkpoint for each accumulated data
  3. Instance of accumulated data

# Prerequisites
* NodeJS (get @ https://nodejs.org/)
* `.env` file for credentials, parameters and configs 

# Install dependencies

Run this command on your terminal/cmd.
```
$ npm i
``` 

# Start scraping
Run this command on your terminal/cmd and wait for it to finish.
```
$ npm start
```

# Output directory info
## For every scrape instance, there will be 3 files that will be generated in the `~/connect-mls-scraper/output` folder.

```
~/connect-mls-scraper/output/
```
* This will contain the most recent and accumulated scraped data under the file named `agents.csv`.
* This will also contain 2 folders named `checkpoints` and `instances`.

```
~/connect-mls-scraper/output/checkpoints/
```
* File names here will be in the format `agents-<date_in_milliseconds>.csv`
* Files here will be the updated `agents.csv` for the scrape instance.

```
~/connect-mls-scraper/output/instances/
```
* File names here will be in the format `<date_in_milliseconds>.csv`
* Files here will be the agents scraped for the scrape instance.

# Example `.env` file
```
# Credentials
USERID=
PASSWORD=

# Parameters
STATUS_VALUE=ACT,NEW,BOM,EXT,PCH,AO,RFR,SLD,PND,PDB,EXP,CAN,WDN
SEARCH_PRICE_MIN=1
SEARCH_PRICE_MAX=2
MONTHS_BACK=24 Months

# Scraper Config

# Increase if it takes too long on your end to load the search form
NAVIGATE_TO_SEARCH_FORM_DELAY=5000  

# Increase if it takes too long to load each listing page on your end
LISTING_PAGE_DELAY=1000  

# Waiting time before agent tab closes
AGENT_PAGE_DELAY=2000  

# Set to "false" if you want to see the browser in action, "true" if not
SILENT=false
```

# Troubleshooting
* An error occurred midway. Terminate the process with `ctrl+C` or closing the terminal/cmd.
* If it takes too long on your end to load pages (usually due to internet connection), try increasing the `*_DELAY` values in the config as per page concerned.
* You get an error that address is in use (EADDRINUSE :: port). This is due to the Node process still being alive. Either you change the PORT in the `.env` file or give it some time and run `npm start` again. If you insist on using the same port, terminate the node process manually.

# Bugs/Issues
* Please open a ticket on the [issues section](https://github.com/zeferinix/connect-mls-scraper/issues) and I will look into it when I find time.
