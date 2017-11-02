const axios = require('axios');
const cheerio = require('cheerio');

const CACHE_LINK = 'https://webcache.googleusercontent.com/search?q=cache:kK5T6Z39UOIJ:gothamist.com/+&cd=20&hl=en&ct=clnk&gl=us';

const scrapeFrontpage = () => {
  axios.get(CACHE_LINK)
    .then((resp) => {
      const $ = cheerio.load(resp.data);

      // Find article links
      const articleLinks = $('.asset-name.entry-title a');

      // console.log(articleLinks);
      // Follow as mobile agent
      articleLinks.each((i, link) => {
        let articleURL, articleTitle;
        try {
          articleURL = $(link).attr('href');
          articleTitle = $(link).text();
        } catch (e) {
          console.log(e);
        }

        // Get google AMP URL
        // Download html

      });

    })
    .catch((err) => {

    });
}

const gothamistAuthorPageURL = (name) => {
  return `gothamist.com/author/${encodeURIComponent(name)}`;
}

const scrapeAuthor = (name) => {
  // Search google for cache link
  const gothamistQueryURL = gothamistAuthorPageURL(name);
  axios.get(`https://www.google.com/search?q=${encodeURIComponent(gothamistQueryURL)}`)
    .then((resp) => {
      const $ = cheerio.load(resp.data);

      const cacheUrl = $('a._Zkb').attr('href');

      return axios.get(`http://google.com${cacheUrl}`);
    })
    .then((resp) => {
      const $ = cheerio.load(resp.data);

      const articleLinks = $('.main-item-summary-content a');
      articleLinks.each((i, linkEl) => {
        const link = $(linkEl);

        const articleTitle = link.text();
        const articleURL = link.attr('href');

        console.log(articleTitle, articleURL);
      })
    })
}

scrapeAuthor('Rebecca Fishbein');
