# Backend source (`src`)

Đây là backend NestJS chính của dự án Hồi quy 3D. Ứng dụng dùng TypeScript, Mongoose và MongoDB.

## Cấu trúc chính

- `main.ts`: khởi động HTTP server và cấu hình tiền tố API.
- `app.module.ts`: nạp cấu hình, kết nối MongoDB và đăng ký các module.
- `datasets/`: API, service, DTO và schema quản lý dataset.
- `experiments/`: tạo, xem, cập nhật, xóa mềm và nhận lô thí nghiệm đồng bộ từ frontend.
- `training-runs/`: lưu và truy vấn các lần huấn luyện.
- `sync/`: nhận thao tác offline và trả thay đổi cần đồng bộ.
- `common/`: thành phần dùng chung như guard và kiểm tra CSV.

Mỗi module thường chia thành Controller (HTTP), Service (nghiệp vụ), DTO (dữ liệu request) và Schema (cấu trúc MongoDB).

## Tiền tố và cấu hình

API dùng tiền tố `/api/v1` theo cấu hình trong `main.ts`. URI MongoDB được đọc từ `MONGODB_URI`, nếu chưa khai báo thì dùng `connection_string` theo `app.module.ts`. Tạo `.env` cục bộ theo `.env.example`; không đưa mật khẩu hoặc secret lên Git.

## Kiểm tra cơ bản

Từ thư mục gốc dự án:

```bash
npm install
npm run start:dev
```

Các lệnh `npm test`, `npm run test:e2e`, `npm run build` được khai báo trong `package.json`. E2E có thể cần MongoDB và biến môi trường hoạt động.

## Ghi chú tích hợp frontend

Frontend Angular hiện gửi lô thí nghiệm tới `POST /api/v1/experiments/bulk`. Khi thay đổi API hoặc schema experiment, cần giữ tương thích payload này hoặc cập nhật frontend cùng lúc. `clientId` là mã chuỗi ổn định do client tạo; không đổi sang ID số nếu chưa cập nhật hợp đồng FE/API.
