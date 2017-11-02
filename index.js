const axios = require('axios');
const cheerio = require('cheerio');

const CACHE_LINK = 'https://webcache.googleusercontent.com/search?q=cache:kK5T6Z39UOIJ:gothamist.com/+&cd=20&hl=en&ct=clnk&gl=us';

axios.get(CACHE_LINK)
  .then((resp) => {
    console.log(resp.data);
    const $ = cheerio.load(resp.data);

    // Find article links

    // Follow as mobile agent

    // Download html
  })
  .catch((err) => {

  })
