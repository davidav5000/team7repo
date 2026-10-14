const express = require('express');

const {
  StaticMapParameterError,
  buildStaticMapUrl,
} = require('../services/staticMap');

function createMapsRouter({
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  fetchImpl = fetch,
} = {}) {
  const router = express.Router();

  router.get('/static', async (req, res, next) => {
    try {
      const imageUrl = buildStaticMapUrl({
        apiKey,
        latitude: req.query.lat,
        longitude: req.query.lng,
        zoom: req.query.zoom,
        width: req.query.width,
        height: req.query.height,
        scale: req.query.scale,
        mapType: req.query.maptype,
        label: req.query.label,
      });

      const response = await fetchImpl(imageUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return res.status(502).json({ error: 'Google Maps could not create the map image' });
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      if (!contentType.startsWith('image/')) {
        return res.status(502).json({ error: 'Google Maps returned an invalid image response' });
      }

      const image = Buffer.from(await response.arrayBuffer());
      res.set('Cache-Control', 'public, max-age=300');
      return res.type(contentType).send(image);
    } catch (error) {
      if (error instanceof StaticMapParameterError) {
        return res.status(400).json({ error: error.message });
      }

      return next(error);
    }
  });

  return router;
}

module.exports = createMapsRouter;
