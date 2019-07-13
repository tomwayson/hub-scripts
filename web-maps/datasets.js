const fs = require('fs');
const fetch = require('node-fetch');
require('isomorphic-form-data');
const { getItemData } = require('@esri/arcgis-rest-portal');

const outFileName = `./web-maps/output/${Date.now()}.csv`;
// TODO: log to file instead of console?
// const logFileName = `./web-maps/output/${Date.now()}.log`;
// TODO: read at least env and num (maxPages?) from environment vars
// const portal = 'https://qaext.arcgis.com/sharing/rest';
const env = 'qa'; // or 'qa' or 'dev';
const num = 99; // API max
const maxPages = Math.floor(9999 / num); // API max
const apiUrl = `https://${getApiDomain(env)}.arcgis.com/api/v3/datasets?filter[type]=any(Web%20Map)&filter[openData]=true&fields[datasets]=itemModified,name,owner&page[size]=${num}&page[number]=1`;
const portal = `https://${getPortalDomain(env)}.arcgis.com/sharing/rest`;
let pageCount = 0;
let csv = '';

// kick this off by requesting the first page of results
processPage(apiUrl);

// fetch and process a page of results
async function processPage (url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`error fetching ${url}`);
    // output partial CSV to a file
    fs.writeFileSync(outFileName, csv);
    return;
  }
  pageCount = pageCount + 1;
  const json = await response.json();
  if (pageCount === 1) {
    // first page, log the total
    const meta = json && json.meta;
    const stats = meta && meta.stats;
    const totalCount = stats && stats.totalCount;
    console.log(`Processing up to ${maxPages * num} of ${totalCount} search results`);
  // } else {
  //   console.log(`processing page ${pageCount}...`);
  }
  const data = json && json.data;
  // loop through search results and fetch the version from the webmap's data for each
  // NOTE: I tried `for (const d of data)` to make the item data requests sequentially
  // but it was going to take ~2hrs and crashed when my mac went to sleep
  // instead we make simultaneous requests in a batch for each page of results w/ Promise.all()
  const requests = data && data.map(async (d) => fetchVersion(d));
  const responses = await Promise.all(requests);
  responses && responses.forEach(r => {
    const id = r.id;
    const error = r.error;
    if (error) {
      // log error
      console.log(`webmap: ${id} ${error}`);
      return;
    }
    const version = r.version;
    if (!version || parseFloat(version) < 2) {
      // web map has invalid version, add it to the CSV
      const name = r.name;
      csv = csv + `"${id}","${version}","${r.itemModifiedISO}","${r.owner}","${name && name.replace('"', '')}"\n`;
    }
  });
  // check if there's more pages to fetch
  const canPage = pageCount < maxPages;
  const links = canPage && json.links;
  const next = links && links.next;
  if (next) {
    // fetch the next page
    processPage(next);
  } else {
    // output complete CSV to a file
    fs.writeFileSync(outFileName, csv);
  }
}

function getApiDomain (env) {
  switch (env) {
    case 'dev':
      return 'opendatadev';
    case 'qa':
      return 'opendataqa';
    default:
      return 'opendata';
  }
}

function getPortalDomain (env) {
  switch (env) {
    case 'dev':
      return 'devext';
    case 'qa':
      return 'qaext';
    default:
      return 'www';
  }
}

// fetch the web map's data and return the version
// and trap any errors to emulate allSettled() when used in Promise.all()
async function fetchVersion (dataset) {
  const { id, attributes } = dataset;
  try {
    const itemData = await getItemData(id, {
      fetch,
      portal
    });
    // TODO: also get name and owner?
    const { name, owner } = attributes;
    const itemModified = attributes.itemModified;
    const itemModifiedISO = itemModified && new Date(itemModified).toISOString();
    return {
      id,
      name,
      owner,
      itemModifiedISO,
      version: itemData.version
    };
  } catch (error) {
    return { id, error };
  }
}
