# Base image từ Node.js chính thức
FROM node:18-alpine AS builder

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json & lockfile trước để cache
COPY package*.json ./

# Cài dependencies (chỉ production nếu không cần dev deps)
RUN npm install

# Copy toàn bộ source code vào container
COPY . .

# Nếu dùng TypeScript, build tại đây
# RUN npm run build

# ----------------------------------------
# Tạo image production, không có dev tool
# ----------------------------------------
FROM node:18-alpine

WORKDIR /app

# Copy node_modules và dist từ stage trước
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Nếu dùng TypeScript và có dist/
# COPY --from=builder /app/dist ./dist

# Mở port (tuỳ theo app bạn chạy)
EXPOSE 3000

# Start ứng dụng (có thể là: node ./dist/index.js hoặc node index.js)
CMD ["node", "index.js"]
