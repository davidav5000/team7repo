const sharp = require('sharp');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;
const IMAGE_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function uploadError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function detectFormat(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

// Sharp's PNG decoder may expose only the first frame of an APNG.
function hasPngAnimation(buffer) {
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    if (offset + length + 12 > buffer.length) break;
    if (buffer.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += length + 12;
  }
  return false;
}

async function processAvatar(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw uploadError('Choose a picture to upload.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw uploadError('Picture must be 5 MB or smaller.', 413);
  }
  const format = detectFormat(buffer);
  if (!format || IMAGE_TYPES[format] !== mimeType) {
    throw uploadError('Upload a JPEG, PNG, or WebP picture with a matching file type.');
  }
  if (format === 'png' && hasPngAnimation(buffer)) {
    throw uploadError('Animated pictures are not supported.');
  }

  const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'warning' });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw uploadError('Picture is invalid or exceeds 25 megapixels.');
  }
  if ((metadata.pages || 1) > 1) {
    throw uploadError('Animated pictures are not supported.');
  }
  if (metadata.format !== format) {
    throw uploadError('Picture content does not match its file type.');
  }
  try {
    // rotate() applies EXIF orientation; default output strips original metadata.
    return await image
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw uploadError('Picture could not be decoded. Choose a valid image.');
  }
}

module.exports = { processAvatar, MAX_FILE_BYTES, IMAGE_TYPES, uploadError };
