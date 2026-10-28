# src

Điểm vào của ứng dụng ML Lab: API quản lý các **experiment** huấn luyện mô hình hồi quy.

## Cấu trúc

```
src/
├── main.ts                      # Khởi động app (giữ mặc định, không cấu hình thêm)
├── app.module.ts                # Module gốc: kết nối MongoDB + bật validate toàn cục
└── experiments/                 # Toàn bộ nghiệp vụ experiment
    ├── experiment.enums.ts      # Các tập giá trị cố định
    ├── experiments.module.ts
    ├── experiments.controller.ts
    ├── experiments.service.ts
    ├── schemas/                 # Cấu trúc dữ liệu lưu trong MongoDB
    │   ├── counter.schema.ts
    │   └── experiment.schema.ts
    └── dto/                     # Quy tắc kiểm tra dữ liệu client gửi lên
        ├── algorithm.dto.ts
        ├── create-experiment.dto.ts
        ├── update-experiment.dto.ts
        ├── replace-experiment.dto.ts
        ├── query-experiments.dto.ts
        └── duplicate-experiment.dto.ts
```

## Các file

### `main.ts`
Chỉ tạo ứng dụng và lắng nghe cổng (`PORT`, mặc định 3000). **Không cấu hình gì thêm**, nên:
- Không có prefix: route là `/experiments`, không phải `/api/v1/experiments`.
- Không có Swagger (dự án không dùng `@nestjs/swagger`).

### `app.module.ts`
Module gốc, làm 2 việc:
1. **Kết nối MongoDB** qua `MONGO_URI`.
2. **Bật validate toàn cục** bằng provider `APP_PIPE`:

```ts
{
  provide: APP_PIPE,
  useValue: new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
}
```

| Tùy chọn | Tác dụng |
|---|---|
| `whitelist: true` | Bỏ các field không khai báo trong DTO |
| `forbidNonWhitelisted: true` | Gửi field lạ thì trả **400** thay vì lặng lẽ bỏ qua |
| `transform: true` | Chuyển JSON/query thành instance của DTO. Cần cho validate lồng nhau, validate theo loại thuật toán và ép kiểu `page`, `limit` |

Nếu thiếu provider này, mọi quy tắc trong DTO không có tác dụng, dữ liệu sai đi thẳng xuống MongoDB và lỗi lòi ra dưới dạng 500.

## Danh sách API

Base URL: `http://localhost:3000`

| Method | URL | Chức năng |
|---|---|---|
| POST | `/experiments` | Tạo mới (ID tự tăng, không cần gửi ID) |
| GET | `/experiments` | Danh sách: phân trang, lọc, tìm kiếm, sắp xếp |
| GET | `/experiments/:id` | Xem chi tiết |
| PUT | `/experiments/:id` | **Thay thế toàn bộ** (bắt buộc `version`) |
| PATCH | `/experiments/:id` | **Sửa một phần** (bắt buộc `version`) |
| POST | `/experiments/:id/duplicate` | Nhân bản |
| DELETE | `/experiments/:id` | Xóa hẳn khỏi MongoDB |

## Luồng một request

```
Client (Postman)
  → ValidationPipe          kiểm tra body/query theo DTO (sai thì 400)
  → Controller              nhận request, ParseIntPipe ép :id thành số
  → Service                 xử lý nghiệp vụ
  → Mongoose Model          đọc/ghi
  → MongoDB
```

## Mã trạng thái

| Mã | Khi nào |
|---|---|
| 200 | Thành công (GET, PUT, PATCH, DELETE) |
| 201 | Tạo mới thành công (POST) |
| 400 | Dữ liệu sai, thiếu field, field lạ, `:id` không phải số, tổng tỉ lệ chia dữ liệu khác 1 |
| 404 | Không tìm thấy experiment |
| 409 | Trùng `clientId`, hoặc `version` cũ (bản ghi đã bị sửa ở nơi khác) |
| 500 | Lỗi không lường trước. Xem log ở terminal để biết nguyên nhân |

## Quy ước chung

- **Không dùng `any`**: mọi dữ liệu đều có kiểu rõ ràng (enum, class, interface).
- **ID tự tăng**: 1, 2, 3... và không bao giờ dùng lại ID đã xóa.
- **Xóa cứng**: DELETE xóa document khỏi MongoDB, không có `deletedAt`.
- **Chống ghi đè**: PUT và PATCH bắt buộc gửi `version` (xem README trong `experiments/`).
- **Import có đuôi `.js`** (ví dụ `'./experiments.service.js'`), theo cấu hình ESM của project.

## Chạy dự án

```bash
npm install
# .env:
#   MONGO_URI=mongodb://127.0.0.1:27017/ml_lab
#   PORT=3000
npm run start:dev
```

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| 500 + log `Document failed validation` (code 121) | Collection trong MongoDB có sẵn `$jsonSchema` validator từ trước (ví dụ bắt buộc `deletedAt`) | `db.experiments.drop()` và `db.counters.drop()` trong mongosh |
| Thiếu `version` nhưng nhận **409** thay vì 400 | `ValidationPipe` chưa chạy | Kiểm tra `APP_PIPE` trong `app.module.ts` |
| 409 dù vừa mới `GET` | Gửi sai `version` hoặc bỏ sót | `version` phải bằng `syncVersion` trong response của `GET` |
| ID nhảy cóc (1, 2, 5) | Các lần tạo lỗi trước đó vẫn làm bộ đếm tăng | Bình thường. Muốn đếm lại từ 1 thì drop `counters` |