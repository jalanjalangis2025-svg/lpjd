const https = require('https');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL missing' });
  }

  const followRedirect = (currentUrl, hops = 0) => {
    if (hops > 5) {
      return res.status(200).json({ finalUrl: currentUrl });
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(currentUrl, options, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        followRedirect(response.headers.location, hops + 1);
      } else {
        res.status(200).json({ finalUrl: currentUrl });
      }
      response.resume();
    }).on('error', (e) => {
      res.status(200).json({ finalUrl: currentUrl, error: e.message });
    });
  };

  followRedirect(url);
}
