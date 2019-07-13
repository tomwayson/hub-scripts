# Hub Scripts

Node scripts for working with ArcGIS Hub.

## Install

`npm install`

## Running the scripts

### Find v1.x Web Maps

The scripts in the `web-maps` folder find public web maps used by ArcGIS Hub that do not declare a version of at least v2.x of the [web map spec](https://developers.arcgis.com/web-map-specification/). The ArcGIS JS API v4.x. will only render v2.x web maps.

To find public v1.x web maps in the Hub index (i.e. in "Open Data" groups) run: `node ./web-maps/datasets.js`.

To find public v1.x web maps used in public Hub sites run `node ./web-maps/sites.js`.

To find public v1.x web maps used in public Hub pages, update the `type` variable in `sites.js` and run `node ./web-maps/sites.js`.

All scripts write the output in CSV format to a file in the `./web-maps/output` directory.
