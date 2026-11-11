const multer = require('multer');
const {
  processAvatar,
  MAX_FILE_BYTES,
  IMAGE_TYPES,
  uploadError,
} = require('../services/avatarImage');

const receiveFile = multer({
  storage: multer.memoryStorage(),
  // Busboy signals a limit at equality; the service enforces the inclusive 5 MB cap.
  limits: { fileSize: MAX_FILE_BYTES + 1, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, callback) => {
    if (!Object.values(IMAGE_TYPES).includes(file.mimetype)) {
      return callback(uploadError('Upload a JPEG, PNG, or WebP picture.'));
    }
    return callback(null, true);
  },
}).single('avatar');

function avatarUpload(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next(
      uploadError('Send one picture as multipart/form-data in the avatar field.'),
    );
  }
  return receiveFile(req, res, async (err) => {
    if (err) {
      delete req.file;
      if (err instanceof multer.MulterError) {
        return next(
          err.code === 'LIMIT_FILE_SIZE'
            ? uploadError('Picture must be 5 MB or smaller.', 413)
            : uploadError(
                'Upload exactly one picture in the avatar field, without extra fields.',
              ),
        );
      }
      return next(err.status ? err : uploadError('Malformed picture upload.'));
    }
    try {
      req.avatarImage = await processAvatar(req.file?.buffer, req.file?.mimetype);
      // Only the processed WebP buffer is needed by downstream handlers.
      delete req.file;
      return next();
    } catch (error) {
      delete req.file;
      return next(error);
    }
  });
}

module.exports = avatarUpload;
