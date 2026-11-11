const express = require('express');
const request = require('supertest');
const sharp = require('sharp');
const avatarUpload = require('../middleware/avatarUpload');
const { processAvatar, MAX_FILE_BYTES } = require('../services/avatarImage');

function makeImage(format, options = {}) {
  return sharp({
    create: { width: 400, height: 200, channels: 3, background: '#2050a0', ...options },
  })
    .toFormat(format)
    .toBuffer();
}

describe('avatar image processing', () => {
  test.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ])('converts %s into a 256 by 256 WebP', async (format, mimeType) => {
    const output = await processAvatar(await makeImage(format), mimeType);
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  test('applies orientation before cropping and strips original metadata', async () => {
    // Top half is red, bottom half blue. EXIF 6 rotates these to left/right.
    const pixels = Buffer.alloc(256 * 256 * 3);
    for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        pixels[(y * 256 + x) * 3 + (y < 128 ? 0 : 2)] = 255;
      }
    }
    const input = await sharp(pixels, { raw: { width: 256, height: 256, channels: 3 } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const output = await processAvatar(input, 'image/jpeg');
    const { data, info } = await sharp(output)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x, y, channel) => data[(y * info.width + x) * info.channels + channel];
    expect(pixel(32, 128, 2)).toBeGreaterThan(200);
    expect(pixel(224, 128, 0)).toBeGreaterThan(200);
    expect((await sharp(output).metadata()).exif).toBeUndefined();
  });

  test('rejects mismatched declared and actual types', async () => {
    await expect(
      processAvatar(await makeImage('png'), 'image/jpeg'),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  test.each([undefined, Buffer.alloc(0), Buffer.from('not an image')])(
    'rejects missing, empty, or non-image bytes: %j',
    async (input) => {
      await expect(processAvatar(input, 'image/png')).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  test('rejects SVG even if declared as PNG', async () => {
    await expect(
      processAvatar(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        'image/png',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a truncated image with a valid signature', async () => {
    const input = await makeImage('jpeg');
    await expect(
      processAvatar(input.subarray(0, input.length - 100), 'image/jpeg'),
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects images exceeding the pixel limit', async () => {
    const input = await makeImage('png', { width: 5001, height: 5000 });
    expect(input.length).toBeLessThan(MAX_FILE_BYTES);
    await expect(processAvatar(input, 'image/png')).rejects.toMatchObject({
      status: 400,
    });
  });

  test('rejects animated WebP', async () => {
    const input = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();
    expect((await sharp(input).metadata()).pages).toBe(2);
    await expect(processAvatar(input, 'image/webp')).rejects.toMatchObject({
      status: 400,
      message: 'Animated pictures are not supported.',
    });
  });

  test('rejects PNG animation control chunks before decoding', async () => {
    const png = await makeImage('png');
    // Insert an acTL chunk after IHDR; detection must not silently flatten it.
    const chunk = Buffer.alloc(20);
    chunk.writeUInt32BE(8, 0);
    chunk.write('acTL', 4);
    chunk.writeUInt32BE(2, 8);
    const input = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
    await expect(processAvatar(input, 'image/png')).rejects.toMatchObject({
      status: 400,
      message: 'Animated pictures are not supported.',
    });
  });

  test('rejects files exceeding the byte limit', async () => {
    await expect(
      processAvatar(Buffer.alloc(MAX_FILE_BYTES + 1), 'image/png'),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe('avatar upload middleware', () => {
  let app;
  let png;

  beforeAll(async () => {
    png = await makeImage('png');
  });

  beforeEach(() => {
    app = express();
    // Isolated harness: production route authentication is connected in step 5.
    app.put('/upload', avatarUpload, (req, res) => {
      res.json({
        processed: Buffer.isBuffer(req.avatarImage),
        originalReleased: !req.file,
      });
    });
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  test('receives a file in memory and passes only processed bytes downstream', async () => {
    const response = await request(app)
      .put('/upload')
      .attach('avatar', png, { filename: '../../picture.png', contentType: 'image/png' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ processed: true, originalReleased: true });
  });

  test('rejects the former JSON request', async () => {
    const response = await request(app)
      .put('/upload')
      .send({ avatarUrl: 'https://example.com/a.jpg' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  test('rejects missing multipart boundaries', async () => {
    const response = await request(app)
      .put('/upload')
      .set('Content-Type', 'multipart/form-data')
      .send('invalid');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed picture upload.' });
  });

  test('rejects truncated multipart bodies', async () => {
    const response = await request(app)
      .put('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=test')
      .send(
        '--test\r\nContent-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\npartial',
      );
    expect(response.status).toBe(400);
  });

  test('rejects a missing file', async () => {
    const response = await request(app)
      .put('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=test')
      .send('--test--\r\n');
    expect(response.status).toBe(400);
  });

  test('rejects an unexpected file field', async () => {
    const response = await request(app).put('/upload').attach('photo', png, 'a.png');
    expect(response.status).toBe(400);
  });

  test('rejects multiple files', async () => {
    const response = await request(app)
      .put('/upload')
      .attach('avatar', png, 'a.png')
      .attach('avatar', png, 'b.png');
    expect(response.status).toBe(400);
  });

  test('rejects extra text fields', async () => {
    const response = await request(app)
      .put('/upload')
      .field('userId', '999')
      .attach('avatar', png, 'a.png');
    expect(response.status).toBe(400);
  });

  test('rejects unsupported MIME types', async () => {
    const response = await request(app)
      .put('/upload')
      .attach('avatar', png, { filename: 'a.gif', contentType: 'image/gif' });
    expect(response.status).toBe(400);
  });

  test('rejects spoofed image content', async () => {
    const response = await request(app)
      .put('/upload')
      .attach('avatar', Buffer.from('not an image'), {
        filename: 'a.png',
        contentType: 'image/png',
      });
    expect(response.status).toBe(400);
  });

  test('accepts a valid picture at exactly the byte limit', async () => {
    const padded = Buffer.concat([png, Buffer.alloc(MAX_FILE_BYTES - png.length)]);
    const response = await request(app)
      .put('/upload')
      .attach('avatar', padded, { filename: 'a.png', contentType: 'image/png' });
    expect(response.status).toBe(200);
  });

  test('rejects an oversized file with 413', async () => {
    const response = await request(app)
      .put('/upload')
      .attach('avatar', Buffer.alloc(MAX_FILE_BYTES + 1), {
        filename: 'a.png',
        contentType: 'image/png',
      });
    expect(response.status).toBe(413);
  });
});
