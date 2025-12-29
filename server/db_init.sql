CREATE DATABASE IF NOT EXISTS photo_lab;
USE photo_lab;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT,
  url VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  tags JSON,
  exif JSON,
  timestamp BIGINT,
  width INT,
  height INT,
  size INT,          -- 【新增】文件大小 (bytes)
  type VARCHAR(50),  -- 【新增】MIME类型 (image/jpeg)
  FOREIGN KEY (user_id) REFERENCES users(id)
);