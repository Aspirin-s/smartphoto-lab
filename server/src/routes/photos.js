const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifParser = require('exif-parser');
const pool = require('../config/database');
const upload = require('../config/multer');
const { safeParse, deleteFile } = require('../utils/helpers');

// 上传照片
router.post('/upload', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer Error:", err);
      return res.status(413).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      console.error("Unknown Upload Error:", err);
      return res.status(500).json({ error: err.message });
    }

    try {
      const photoData = JSON.parse(req.body.metadata);
      const userId = req.body.userId;
      const protocol = req.protocol;
      const host = req.get('host');
      const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
      
      // 提取EXIF数据
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
        
        if (result.tags && Object.keys(result.tags).length > 0) {
          realExif = {
            dateTaken: result.tags.DateTimeOriginal 
              ? new Date(result.tags.DateTimeOriginal * 1000).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
            location: 'Unknown Location',
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

// 获取照片列表
router.get('/photos', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM photos WHERE user_id = ? ORDER BY timestamp DESC', 
      [userId]
    );
    
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const photos = rows.map(p => ({
      ...p,
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

// 删除照片
router.delete('/photos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT url FROM photos WHERE id = ?', [req.params.id]);
    
    if (rows.length > 0) {
      const photoUrl = rows[0].url;
      const filename = photoUrl.split('/').pop();
      const filepath = path.join(__dirname, '../../uploads', filename);
      deleteFile(filepath);
    }
    
    await pool.query('DELETE FROM photos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 更新照片
router.put('/photos/:id', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(413).json({ error: `File too large: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const photoId = req.params.id;
      const updates = [];
      const values = [];

      if (req.file) {
        const [oldRows] = await pool.query('SELECT url FROM photos WHERE id = ?', [photoId]);
        if (oldRows.length > 0) {
          const oldUrl = oldRows[0].url;
          const oldFilename = oldUrl.split('/').pop();
          const oldFilepath = path.join(__dirname, '../../uploads', oldFilename);
          deleteFile(oldFilepath);
        }
        
        const protocol = req.protocol;
        const host = req.get('host');
        const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        updates.push("url = ?", "size = ?", "timestamp = ?");
        values.push(fileUrl, req.file.size, Date.now());
      }

      if (req.body.tags !== undefined) {
        let tagsToSave = req.body.tags;
        if (typeof tagsToSave === 'string') {
          try { tagsToSave = JSON.parse(tagsToSave); } catch(e) {}
        }
        updates.push("tags = ?");
        values.push(JSON.stringify(tagsToSave));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      const sql = `UPDATE photos SET ${updates.join(', ')} WHERE id = ?`;
      values.push(photoId);
      await pool.query(sql, values);

      const [rows] = await pool.query('SELECT * FROM photos WHERE id = ?', [photoId]);
      if (rows.length > 0) {
        const p = rows[0];
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

// 清理孤立文件
router.post('/cleanup', async (req, res) => {
  try {
    const { cleanOrphanedFiles } = require('../utils/helpers');
    await cleanOrphanedFiles();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
