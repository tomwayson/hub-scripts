/* eslint-env node */

const fs = require('fs');
const fetch = require('node-fetch');
require('isomorphic-form-data');
const { searchItems, getItemData } = require('@esri/arcgis-rest-portal');

// test data
// const site = require('./test/data/site.json');
// const webmap = require('./test/data/webmap.json');

const outFileName = `./output/${Date.now()}.csv`;
// TODO: log to file instead of console?
// const logFileName = `./output/${Date.now()}.log`;
// TODO: read at least portal and maxPages from environment vars
// const portal = 'https://qaext.arcgis.com/sharing/rest';
const portal = 'https://www.arcgis.com/sharing/rest';
const type = 'page'; // or 'site'
const q = type === 'page'
  ? '(typekeywords:hubPage AND !typekeywords:hubSolutionTemplate)'
  : '(typekeywords:hubSite)';
const maxPages = 50;
const num = 100; // AGO max
let pageCount = 0;
let csv = '';

searchItems({
  q,
  num,
  fetch,
  portal
})
.then(response => {
  console.log(`Processing up to ${maxPages * num} of ${response.total} items`);
  processSearchResults(response);
});

function processSearchResults (response) {
  pageCount = pageCount + 1;
  const results = response.results;
  results && results.forEach(result => {
    getItemData(result.id, {
      fetch,
      portal
    })
    .then(site => {
      const webmaps = parseWebmaps(site);
      if (!webmaps) {
        return;
      }
      // fetch web map data
      webmaps.forEach((webmap, i) => {
        if (!webmap) {
          // empty web map id, don't bother trying to fetch it
          console.log(`webmap-card: ${result.id} webmap-card ${i} has an empty id`);
        } else {
          getItemData(webmap, {
            fetch,
            portal
          })
          .then(response => {
            // add a row to the CSV
            csv = csv + printRow(result, webmap, response);
          })
          .catch(e => {
            // log the error
            console.log(`webmap: ${webmap} ${e.message}`);
          });
        }
      });
    })
    .catch(e => {
      // log the error
      console.log(`result: ${result.id} ${e.message}`);
    });
  });
  if (response.nextPage && pageCount <= maxPages) {
    // fetch the next page of results
    response.nextPage()
    .then(processSearchResults);
  } else {
    // output
    fs.writeFileSync(outFileName, csv);
    // console.log(csv);
  }
}

// parse web map cards from site/page layout
function parseWebmaps (page) {
  const values = page && page.values;
  const layout = values && values.layout;
  const sections = layout && layout.sections;
  return sections && sections.reduce((accum, section) => {
    const rows = section.rows;
    rows && rows.forEach(row => {
      const cards = row.cards;
      cards && cards.forEach(card => {
        if (card.component.name === 'webmap-card') {
          accum.push(card.component.settings.webmap);
        }
      });
    });
    return accum;
  }, []);
}

function printRow (page, webmap, data) {
  // TODO: write this to a CSV
  const { id, url, title, modified } = { ...page };
  const { version, authoringApp, authoringAppVersion } = { ...data };
  const row = [id, url, title, new Date(modified).toISOString(), webmap, version, authoringApp, authoringAppVersion].join(',');
  // console.log(row);
  return row + '\n';
}
