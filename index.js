require('dotenv').load();
const axios = require('axios');
const cheerio = require('cheerio');
const storage = require('@google-cloud/storage')();

const CACHE_LINK = 'https://webcache.googleusercontent.com/search?q=cache:kK5T6Z39UOIJ:gothamist.com/+&cd=20&hl=en&ct=clnk&gl=us';

const bucket = storage.bucket('amp-archive');

const wait = (milliseconds) => {
  return new Promise((resolve, reject) => setTimeout(resolve, milliseconds));
}

const getAmpUrls = (originalUrls) => {
  console.log('getting amped');
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

const authorPageURLs = (name) => {
  return [
    `gothamist.com/author/${encodeURIComponent(name)}`,
    `laist.com/author/${encodeURIComponent(name)}`,
    `dcist.com/author/${encodeURIComponent(name)}`,
    `chicagoist.com/author/${encodeURIComponent(name)}`,
    `sfist.com/author/${encodeURIComponent(name)}`,
    `shanghaiist.com/author/${encodeURIComponent(name)}`,
  ];
}

const recurseAmpScrape = (urls) => {
  if (!urls.length) return Promise.resolve();
  const batch = urls.shift();

  // Googles rate limits are really strict
  return getAmpUrls(batch)
    .then((cacheUrls) => {
      const scrapePromises = cacheUrls.map((url) => storeArticle(url).catch(err => {
        if (err.message !== 'nosrc') throw err;
      }));
      return Promise.all(scrapePromises);
    })
    .then(() => wait(15000))
    .then(() => recurseAmpScrape(urls));
}

const scrapeAuthor = (name) => {
  // Search google for cache link

  //do something here
  const queryURLs = [
  'http://gothamist.com/author/Colin%20Dodds',
  'http://gothamist.com/author/David%20Brand',
  'http://gothamist.com/author/Eliza%20Relman',
  'http://gothamist.com/author/Erica%20Siudzinski',
  'http://gothamist.com/author/Gaby%20Del%20Valle',
  'http://gothamist.com/author/Garth%20Johnston',
  'http://gothamist.com/author/Gothamist',
  'http://gothamist.com/author/Jake%20Offenhartz',
  'http://gothamist.com/author/Jamie%20Feldmar',
  'http://gothamist.com/author/Jay%20Barmann',
  'http://gothamist.com/author/Jaya%20Saxena',
  'http://gothamist.com/author/Jen%20Chung',
  'http://gothamist.com/author/Joe%20Schumacher',
  'http://gothamist.com/author/Joseph%20Alexiou',
  'http://gothamist.com/author/Marc%20Yearsley',
  'http://gothamist.com/author/Max%20Kyburz',
  'http://gothamist.com/author/Nathan%20Tempey',
  'http://gothamist.com/author/Nell%20Casey',
  'http://gothamist.com/author/Nick%20Pinto',
  'http://gothamist.com/author/Sarah%20Aziza',
  'http://gothamist.com/author/Scott%20Lynch',
  'http://gothamist.com/author/Sean%20Ludwig',
  'http://gothamist.com/author/Sophie%20Kleeman',
  'http://gothamist.com/author/Steven%20Wishnia',
  'http://gothamist.com/author/Victoria%20Law',];
  const promises = queryURLs.map((queryURL) => {
    let currentTimestamp = '';
    return axios.get(`http://archive.org/wayback/available?url=${encodeURIComponent(queryURL)}`)
      .then((response) => {
        currentTimestamp = response.data.archived_snapshots.closest.timestamp;
        return axios.get(response.data.archived_snapshots.closest.url);
      })
      .then((resp) => {
        const $ = cheerio.load(resp.data);

        const articleLinks = $('.main-item-summary-content a');
        const articleUrls = [];

        articleLinks.each((i, linkEl) => {
          const link = $(linkEl);

          const articleTitle = link.text();
          const articleURL = link.attr('href').replace(`http://web.archive.org/web/${currentTimestamp}/`, '');
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
      })
      .catch(err => {
        console.log('nocacheurl', name);
        if (err === 'nocacheurl') return;
        throw err;
      })
      .catch(err => {
        // If its an axios error, not all is lost
        if (err.response) {
          console.error(err.response);
          return;
        }
        throw err;
      });
  });
  return promises;
}

const storeArticle = (url) => {
  if (!url) return Promise.reject(new Error('nosrc'));

  return axios({
    method:'get',
    url: url,
    headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Version/10.0 Mobile/14D27 Safari/602.1'}
  })
  .then((response) => {
    const $ = cheerio.load(response.data);
    const iframeSrc = $('iframe').attr('src');

    if (!iframeSrc) throw new Error('nosrc');
    return axios({
      method:'get',
      url: iframeSrc,
      headers: {'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Version/10.0 Mobile/14D27 Safari/602.1'}
    });
  })
  .then((response) => {
    const $ = cheerio.load(response.data);
    const title = $('h1').text();
    const authorSubtitlePieces = $('h1').next('p').text().split(' ');

    // Do a little dance to get the author
    let i;
    const authorPieces = [];
    for (i = 0; i < authorSubtitlePieces.length; i++) {
      const piece = authorSubtitlePieces[i];
      if (piece === 'by') continue;
      if (piece === 'in') break;
      authorPieces.push(piece);
    }

    const authorName = authorPieces.join(' ');
    const deslashedTitle = title.replace('/', '-');
    const filename = `${authorName}/${deslashedTitle}.html`;
    console.log('aboutta save');
    return bucket.file(filename).save(
      response.data,
      {
        metadata: {
          contentType: 'text/html',
        }
    });
  })
  .catch(err => {
    // If its an axios error, not all is lost
    if (err.response) {
      console.log('axios error', err.response.status);
      return;
    }
    throw err;
  });;
}

scrapeAuthor('').reduce(function(cur, next) {
    console.log('hello');
    return cur.then(next);
}, Promise.resolve([]));
