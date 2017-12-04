// Let's get the goods.
require('dotenv').load();
const axios = require('axios');
const storage = require('@google-cloud/storage')();
const bucket = storage.bucket('api-archive-id');


const API_ENDPOINT = 'https://api.gothamist.com';

const wait = (milliseconds) => {
  return new Promise((resolve, reject) => setTimeout(resolve, milliseconds));
}

const searchforId = '587e69fe7826f50001411ea5';

const walkPaginatedAPI = (url) => {
  console.log('Crawling', url);
  return axios({
    method: 'GET',
    headers: {
      Authorization: `method=clientkey,token=${process.env.GOTHAMIST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    url,
  })
    .then((resp) => {
      const promises = resp.data.articles.map((article) => {
        if (article.authorName === 'Sponsor') return Promise.resolve();

        // Try to find the id, if it's not, resolve
        // if (article.id !== searchforId) return Promise.resolve();
        // console.log('FOUND', searchforId, resp.data.meta.pagination);
        // return Promise.reject();
        // console.log('this shouldnt happen');
        const escapedTitle = article.title.replace('/', '-').replace('#', '').replace('[', '').replace(']', '').replace('*', '').replace('?', '');
        const filename = `${article.authorName}/${escapedTitle}-${article.id}.json`;
        console.log('Saving', filename);
        return bucket.file(filename).save(
          JSON.stringify(article),
          {
            resumable: false,
            metadata: {
              contentType: 'application/json',
            }
        })
          .catch((err) => {
            if (err.code === 'FILE_NO_UPLOAD' || err.code === 'FILE_NO_UPLOAD_DELETE') {
              // I don't really care that much, dont stop the juice
              console.log('GCS Error - FILE_NO_UPLOAD or FILE_NO_UPLOAD_DELETE')
            } else {
              console.log('GCS error', filename, err);
              throw err;
            }
          });
      })

      return Promise.all(promises).then(() => wait(5 * 1000)).then(() => {

        if (resp.data.meta.pagination.next) {
          return walkPaginatedAPI(resp.data.meta.pagination.next.replace('http', 'https'));
        }
      });
    })
}

walkPaginatedAPI(`${API_ENDPOINT}/articles?limit=100&page=1073`).then(() => {
  console.log('done, supposedly');
}).catch((err) => {
  console.error('ERROR');
  console.error(err);
  process.exit(1);
});
