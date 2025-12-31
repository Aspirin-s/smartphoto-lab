const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

/**
 * 安全解析JSON数据
 */
const safeParse = (data) => {
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

/**
 * 清理孤立文件
 */
const cleanOrphanedFiles = async () => {
  try {
    const [photos] = await pool.query('SELECT url FROM photos');
    const dbFilenames = new Set(
      photos.map(p => p.url.split('/').pop())
    );
    
    const uploadDir = path.join(__dirname, '../../uploads');
    const files = fs.readdirSync(uploadDir);
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      if (!dbFilenames.has(file)) {
        const filepath = path.join(uploadDir, file);
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }
    return deletedCount;
  } catch (err) {
    console.error('Error cleaning orphaned files:', err);
    throw err;
  }
};

/**
 * 删除文件
 */
const deleteFile = (filepath) => {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
};

module.exports = {
  safeParse,
  cleanOrphanedFiles,
  deleteFile
};
