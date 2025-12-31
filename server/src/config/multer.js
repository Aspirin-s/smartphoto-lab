const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    fieldSize: 50 * 1024 * 1024
  }
});

module.exports = upload;
