const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifParser = require('exif-parser');

const app = express();
app.use(cors());

// 【关键修改 1】提升 JSON 和 URL 编码的请求体限制 (例如 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 配置静态文件跨域
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // 使用时间戳 + 随机数 + 扩展名，避免文件名冲突
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

// 【关键修改 2】提升 Multer 文件上传限制
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 限制为 50MB (单位是字节)
    fieldSize: 50 * 1024 * 1024 // 限制字段值大小
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: 'photo_lab'
});

const safeParse = (data) => {
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

// --- API 路由 ---

// 1. 注册
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const [existing] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) return res.status(409).json({ error: 'User exists' });
    
    const [result] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
    res.json({ id: result.insertId, username, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const userData = { id: rows[0].id, username: rows[0].username, email: rows[0].email };
    res.json(userData);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. 上传 (增加错误处理，捕获文件过大错误)
app.post('/api/upload', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    // 捕获 Multer 错误 (如文件过大)
    if (err instanceof multer.MulterError) {
      console.error("Multer Error:", err);
      return res.status(413).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      console.error("Unknown Upload Error:", err);
      return res.status(500).json({ error: err.message });
    }

    // 正常逻辑
    try {
      const photoData = JSON.parse(req.body.metadata);
      const userId = req.body.userId;
      // 动态生成URL，支持局域网访问
      const protocol = req.protocol;
      const host = req.get('host');
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
      
      // 提取真实的EXIF数据
      let realExif = {
        dateTaken: new Date().toISOString().split('T')[0],
        location: 'Unknown Location',
        camera: 'Unknown',
        iso: 'Unknown',
        fStop: 'Unknown'
      };
      
      try {
        const buffer = fs.readFileSync(req.file.path);
        const parser = exifParser.create(buffer);
        const result = parser.parse();
        
        // 提取关键EXIF信息
        if (result.tags && Object.keys(result.tags).length > 0) {
          realExif = {
            dateTaken: result.tags.DateTimeOriginal 
              ? new Date(result.tags.DateTimeOriginal * 1000).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            location: 'Unknown Location', // AI检测的位置从前端传来
            camera: result.tags.Model || result.tags.Make || 'Unknown',
            iso: result.tags.ISO ? `ISO ${result.tags.ISO}` : 'Unknown',
            fStop: result.tags.FNumber ? `f/${result.tags.FNumber}` : 'Unknown',
            exposureTime: result.tags.ExposureTime ? `${result.tags.ExposureTime}s` : undefined,
            focalLength: result.tags.FocalLength ? `${result.tags.FocalLength}mm` : undefined
          };
        }
      } catch (exifErr) {
        // EXIF解析失败，使用默认值
      }
      
      // 如果AI检测到了位置，使用AI的位置
      if (photoData.exif && photoData.exif.location && photoData.exif.location !== 'Unknown Location') {
        realExif.location = photoData.exif.location;
      }
      
      await pool.query(
        'INSERT INTO photos (id, user_id, url, name, description, tags, exif, timestamp, width, height, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          photoData.id, userId, fileUrl, photoData.name, photoData.description, 
          JSON.stringify(photoData.tags), JSON.stringify(realExif),
          photoData.timestamp, photoData.width, photoData.height, req.file.size
        ]
      );
      res.json({ ...photoData, url: fileUrl, userId, tags: photoData.tags, exif: realExif });
    } catch (err) {
      console.error("DB Insert Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

// 4. 获取列表
app.get('/api/photos', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const [rows] = await pool.query('SELECT * FROM photos WHERE user_id = ? ORDER BY timestamp DESC', [userId]);
    
    // 动态替换URL中的localhost为当前请求的host
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const photos = rows.map(p => ({
      ...p,
      // 将存储的localhost URL替换为实际访问的host
      url: p.url ? p.url.replace(/http:\/\/localhost:3001/, baseUrl) : p.url,
      tags: safeParse(p.tags) || [],
      exif: safeParse(p.exif) || {},
      size: Number(p.size) || 0
    }));
    
    res.json(photos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. 删除（同时删除文件）
app.delete('/api/photos/:id', async (req, res) => {
  try {
    // 先查询照片信息获取文件路径
    const [rows] = await pool.query('SELECT url FROM photos WHERE id = ?', [req.params.id]);
    
    if (rows.length > 0) {
      const photoUrl = rows[0].url;
      // 从 URL 中提取文件名
      const filename = photoUrl.split('/').pop();
      const filepath = path.join(__dirname, 'uploads', filename);
      
      // 删除文件（如果存在）
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    
    // 删除数据库记录
    await pool.query('DELETE FROM photos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. 更新图片 (也增加 upload 错误处理，并删除旧文件)
app.put('/api/photos/:id', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    // 错误处理
    if (err instanceof multer.MulterError) {
       return res.status(413).json({ error: `File too large: ${err.message}` });
    } else if (err) {
       return res.status(500).json({ error: err.message });
    }

    try {
      const photoId = req.params.id;
      
      const updates = [];
      const values = [];

      // 场景 1: 上传了新文件 (裁剪/滤镜保存)
      if (req.file) {
        // 先查询旧文件路径
        const [oldRows] = await pool.query('SELECT url FROM photos WHERE id = ?', [photoId]);
        if (oldRows.length > 0) {
          const oldUrl = oldRows[0].url;
          const oldFilename = oldUrl.split('/').pop();
          const oldFilepath = path.join(__dirname, 'uploads', oldFilename);
          
          // 删除旧文件
          if (fs.existsSync(oldFilepath)) {
            fs.unlinkSync(oldFilepath);
          }
        }
        
        // 动态生成URL
        const protocol = req.protocol;
        const host = req.get('host');
        const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        updates.push("url = ?", "size = ?", "timestamp = ?");
        values.push(fileUrl, req.file.size, Date.now());
      }

      // 场景 2: 仅更新标签 (JSON body)
      // 注意：req.body.tags 可能是 JSON 数组（如果 Content-Type 是 application/json）
      // 也可能是字符串（如果是 FormData）。我们需要做兼容。
      if (req.body.tags !== undefined) {
        let tagsToSave = req.body.tags;
        // 如果是字符串，尝试解析
        if (typeof tagsToSave === 'string') {
            try { tagsToSave = JSON.parse(tagsToSave); } catch(e) {}
        }
        updates.push("tags = ?");
        values.push(JSON.stringify(tagsToSave));
      }

      // 如果没有任何要更新的内容
      if (updates.length === 0) {
          return res.status(400).json({ error: 'Nothing to update' });
      }

      // 构造 SQL
      const sql = `UPDATE photos SET ${updates.join(', ')} WHERE id = ?`;
      values.push(photoId);

      await pool.query(sql, values);

      // 返回更新后的最新数据
      const [rows] = await pool.query('SELECT * FROM photos WHERE id = ?', [photoId]);
      if (rows.length > 0) {
        const p = rows[0];
        
        // 动态替换URL中的localhost为当前请求的host
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        const updatedPhoto = {
            ...p,
            url: p.url ? p.url.replace(/http:\/\/localhost:3001/, baseUrl) : p.url,
            tags: safeParse(p.tags) || [],
            exif: safeParse(p.exif) || {},
            size: Number(p.size)
        };
        res.json(updatedPhoto);
      } else {
        res.status(404).json({ error: 'Photo not found' });
      }
    } catch (err) {
      console.error("PUT Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

// 清理孤立文件的工具函数
async function cleanOrphanedFiles() {
  try {
    // 获取数据库中所有文件名
    const [photos] = await pool.query('SELECT url FROM photos');
    const dbFilenames = new Set(
      photos.map(p => p.url.split('/').pop())
    );
    
    // 获取 uploads 目录中的所有文件
    const uploadDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadDir);
    
    let deletedCount = 0;
    for (const file of files) {
      // 跳过隐藏文件和目录
      if (file.startsWith('.')) continue;
      
      // 如果文件不在数据库中，删除它
      if (!dbFilenames.has(file)) {
        const filepath = path.join(uploadDir, file);
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }
  } catch (err) {
    console.error('Error cleaning orphaned files:', err);
  }
}

// 添加手动清理接口（仅开发环境使用）
app.post('/api/cleanup', async (req, res) => {
  try {
    await cleanOrphanedFiles();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // 启动时清理一次
  cleanOrphanedFiles();
  
  // 每小时清理一次孤立文件
  setInterval(cleanOrphanedFiles, 60 * 60 * 1000);
});