require('dotenv').load();
const axios = require('axios');
const cheerio = require('cheerio');
const Storage = require('@google-cloud/storage');

const CACHE_LINK = 'https://webcache.googleusercontent.com/search?q=cache:kK5T6Z39UOIJ:gothamist.com/+&cd=20&hl=en&ct=clnk&gl=us';

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME;

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

    // Follow as mobile agent
    // Get google AMP URL
    // Download html

      });

    })
    .catch((err) => {

    });
}

const wait = (milliseconds) => {
  return new Promise((resolve, reject) => setTimeout(resolve, milliseconds));
}

const archiveAmpArticle = (ampUrl) => {
  console.log('archiving', ampUrl);
  return axios.get(ampUrl)
    .then((resp) => {
      console.log('got resp', resp.data);
    });
}

const getAmpUrls = (originalUrls) => {
  return axios.post(`https://acceleratedmobilepageurl.googleapis.com/v1/ampUrls:batchGet?key=${process.env.GOOGLE_API_KEY}`,
    {
      'urls': originalUrls,
      'lookupStrategy': 'IN_INDEX_DOC'
    }).then((response) => {
      const cacheUrls = response.data.ampUrls.map((meta) =>
        meta.ampUrl
          .replace('http://', 'https://www.google.com/amp/')
          .replace('?', '%3f'));

      return cacheUrls;
    }).catch((error) => {
      console.error('error', error.response.data);
    });
};

const gothamistAuthorPageURL = (name) => {
  return `gothamist.com/author/${encodeURIComponent(name)}`;
}

const recurseAmpScrape = (urls) => {
  if (!urls.length) return Promise.resolve();
  const batch = urls.shift();

  // Googles rate limits are really strict
  return getAmpUrls(batch)
    .then((cacheUrls) => {
      const scrapePromises = cacheUrls.map((url) => archiveAmpArticle(url));
      return Promise.all(scrapePromises);
    })
    .then(() => wait(15000))
    .then(() => recurseAmpScrape(urls));
}

const scrapeAuthor = (name) => {
  // Search google for cache link
  const gothamistQueryURL = gothamistAuthorPageURL(name);
  return axios.get(`https://www.google.com/search?q=${encodeURIComponent(gothamistQueryURL)}`)
    .then((resp) => {
      const $ = cheerio.load(resp.data);

      const cacheUrl = $('a._Zkb').attr('href');

      return axios.get(`http://google.com${cacheUrl}`);
    })
    .then((resp) => {
      const $ = cheerio.load(resp.data);

      const articleLinks = $('.main-item-summary-content a');
      const articleUrls = [];

      articleLinks.each((i, linkEl) => {
        const link = $(linkEl);

        const articleTitle = link.text();
        const articleURL = link.attr('href');
        articleUrls.push(articleURL);
      });
      return articleUrls;
    })
    .then((articleUrls) => {
      const splitUrls = [];
      while(articleUrls.length > 0) {
        splitUrls.push(articleUrls.splice(0, 50));
      }
      return recurseAmpScrape(splitUrls);
    });
}

const storeArticle = (url, authorName) => {
  axios({
    method:'get',
    url: url,
    headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Version/10.0 Mobile/14D27 Safari/602.1'}
  }).then((response) => {
    const $ = cheerio.load(response.data);
    console.log('response: ', $('title').text())
  });
  /*const filename = `${authorName}/`
  storage
    .bucket(bucketName)
    .upload(filename)
    .then(() => {
      console.log(`${filename} uploaded to ${bucketName}.`);
    })
    .catch(err => {
      console.error('ERROR:', err);
    });*/
}

//scrapeAuthor('Rebecca Fishbein');
storeArticle('https://www.google.com/amp/amp.gothamist.com/amp/articles/create%3farticle_id=59ef493a24838400011aef75', 'Rebecca Fishbein');
