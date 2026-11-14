# Backend source (`src`)

Đây là backend NestJS chính của dự án Hồi quy 3D. Ứng dụng dùng TypeScript, Mongoose và MongoDB.

## Mục lục từng module

Các README bên dưới mô tả mục đích, hợp đồng dữ liệu và hành vi hiện có. Chọn module theo chức năng cần hiểu:

| Module | Trạng thái | Nội dung |
|---|---|---|
| [Login](login/README.md) | Đang nạp | Đăng ký, đăng nhập, đăng xuất, phiên cookie, tài khoản và audit |
| [Users](users/README.md) | Đang nạp | Hồ sơ cá nhân, đổi mật khẩu, tự xóa tài khoản và dữ liệu liên quan |
| [Datasets](datasets/README.md) | Đang nạp | Upload/kiểm tra CSV, metadata, tải file, phân trang và xóa mềm |
| [Experiments](experiments/README.md) | Đang nạp; đã có README | Cấu hình thí nghiệm, cập nhật, lưu lô snapshot từ frontend |
| [Training runs](training-runs/README.md) | Đang nạp | Lưu các lần huấn luyện, metrics, tham số và lịch sử loss |
| [Sync](sync/README.md) | Đang nạp | Batch offline, retry, xung đột phiên bản và pull thay đổi |
| [Common](common/README.md) | Thư viện dùng chung | HTTP/CORS, phiên, guard, quyền sở hữu, phân trang và CSV |
| [Auth cũ](auth/README.md) | Không được AppModule nạp | Triển khai token/guest cũ; không dùng làm hợp đồng API hiện tại |

Đã rà soát toàn bộ file `*.module.ts` trong `src`: AppModule được giải thích ngay trong tài liệu này; các module còn lại đều có README tại thư mục tương ứng. Common không phải Nest module nhưng có tài liệu riêng vì nhiều module phụ thuộc vào nó. Thư mục DTO/schema của module được giải thích trong README module; riêng experiments còn có [tài liệu DTO](experiments/dto/README.md) và [tài liệu schema](experiments/schemas/README.md) sẵn có.

Ngoài backend chính, [database/backend](../database/backend/README.md) là bộ model starter độc lập, không phải nơi định nghĩa các API NestJS đang chạy. Tài liệu [triển khai](../deploy/README.md) cũng đã có README riêng.

## AppModule và luồng ứng dụng

`main.ts` tạo ứng dụng NestJS, gọi `configureApp` rồi lắng nghe ở `PORT` (mặc định 3000). `app.module.ts` nạp ConfigModule toàn cục, kết nối MongoDB và đăng ký Login, Users, Datasets, Experiments, TrainingRuns, Sync. Không có HTTP server riêng cho từng module.

Luồng sử dụng thông thường:

1. Đăng ký rồi đăng nhập qua Login để nhận cookie phiên.
2. Tạo/upload dataset làm dữ liệu đầu vào.
3. Tạo experiment mô tả thí nghiệm; frontend có thể lưu snapshot qua API bulk.
4. Lưu training run để xem lại kết quả; API lưu dữ liệu, không tự chạy thuật toán huấn luyện.
5. Khi làm việc offline, dùng Sync để gửi thay đổi và kéo dữ liệu từ server.

Users dùng các model dữ liệu để xóa mềm khi xóa tài khoản. Common cung cấp kiểm tra request và quyền cho các luồng trên.

AppController có hai route công khai:

| Route | Response | Ý nghĩa |
|---|---|---|
| `GET /api/v1` | Chuỗi `Hello World!` | Kiểm tra handler gốc hoạt động |
| `GET /api/v1/health` | `{ status: 'ok', service: 'hoi-quy-3d-api', version: '1.0.0', timestamp: ... }` | Trạng thái handler và thời gian trả lời |

Health handler không thực hiện truy vấn kiểm tra DB/storage và version là chuỗi khai báo trong controller, không tự lấy từ package.json. Route Public bỏ qua yêu cầu đăng nhập nhưng vẫn chịu middleware Origin chung.

Mỗi module thường chia thành Controller (HTTP), Service (nghiệp vụ), DTO (dữ liệu request) và Schema (cấu trúc MongoDB).

## Tiền tố và cấu hình

API dùng tiền tố `/api/v1` qua `common/configure-app.ts`. URI MongoDB được đọc từ `MONGODB_URI`, nếu chưa khai báo thì dùng `connection_string`; thiếu cả hai thì không khởi động được. Tạo `.env` cục bộ theo `.env.example`; không đưa mật khẩu hoặc secret lên Git.

Các route nghiệp vụ cần cookie `hq3d.sid`; POST/PATCH/PUT/DELETE cần header `X-Requested-With: XMLHttpRequest`. Origin giao diện phải được cấu hình trong CORS. Xem [Common](common/README.md) để biết biến môi trường, quyền admin/user và giới hạn chung.

## Kiểm tra cơ bản

Từ thư mục gốc dự án:

```bash
npm install
npm run start:dev
```

Các lệnh `npm test`, `npm run test:e2e`, `npm run build` được khai báo trong `package.json`. E2E có thể cần MongoDB và biến môi trường hoạt động.

## Ghi chú tích hợp frontend

Frontend Angular hiện gửi lô thí nghiệm tới `POST /api/v1/experiments/bulk`. Khi thay đổi API hoặc schema experiment, cần giữ tương thích payload này hoặc cập nhật frontend cùng lúc. `clientId` là mã chuỗi ổn định do client tạo; không đổi sang ID số nếu chưa cập nhật hợp đồng FE/API.
