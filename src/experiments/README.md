# Module experiments

Module này quản lý cấu hình thí nghiệm hồi quy và cung cấp API cho frontend hiện tại.

## API hiện có

Các endpoint nằm dưới tiền tố `/api/v1`:

- `POST /experiments`: tạo experiment, yêu cầu dataset đã tồn tại.
- `POST /experiments/bulk`: nhận lô experiment từ frontend/offline sync, upsert theo `clientId`.
- `GET /experiments?page=1&limit=20`: danh sách có phân trang.
- `GET /experiments/:id`: tìm theo MongoDB ObjectId hoặc `clientId`.
- `PATCH /experiments/:id`: cập nhật một phần và tăng `syncVersion`.
- `DELETE /experiments/:id`: xóa mềm bằng `deletedAt`.

Frontend hiện gửi bốn thuật toán `linear`, `polynomial`, `ridge`, `lasso`. Service cũng có nhánh kiểm tra `neural-network`; đây không đồng nghĩa UI hiện tại đã hỗ trợ thuật toán đó.

## Luồng xử lý

`ExperimentsController` nhận HTTP request → `ExperimentsService` kiểm tra dữ liệu và quy tắc thuật toán → Mongoose schema lưu document vào collection `experiments`.

`ExperimentsModule` đăng ký schema Experiment và phụ thuộc DatasetModule để kiểm tra dataset tham chiếu. API hiện dùng `clientId` dạng chuỗi để tương thích mã định danh do trình duyệt tạo khi offline; `_id` do MongoDB cấp.
