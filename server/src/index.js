const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const photosRoutes = require('./routes/photos');
const { cleanOrphanedFiles } = require('./utils/helpers');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// 路由
app.use('/api', authRoutes);
app.use('/api', photosRoutes);

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // 启动时清理一次孤立文件
  cleanOrphanedFiles().catch(err => 
    console.error('Initial cleanup failed:', err)
  );
  
  // 每小时清理一次孤立文件
  setInterval(() => {
    cleanOrphanedFiles().catch(err => 
      console.error('Scheduled cleanup failed:', err)
    );
  }, 60 * 60 * 1000);
});

module.exports = app;
