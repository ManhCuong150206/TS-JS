# CSV và lịch sử kết quả theo tài khoản

## Kết quả rà soát experiment

Schema `Experiment` hiện đã có các nhóm dữ liệu để phục hồi một lần chạy:

- Thuật toán/cấu hình: `algorithm`, `learningRate`, `maxIterations`, `degree`, `lambda`, `synthetic`, `seed`, `noise`, `trainRatio`.
- Kết quả: `iterations`, `w`, `b`, `train`, `test` (mse/rmse/mae/r2).
- Dữ liệu nguồn: `datasetId`, `dataSource`, `csvName`, `csvData`, `sampleCount`, `featureCount`.
- Theo dõi bản lưu: `clientId`, `clientCreatedAt`, `lastMutationId`, `syncVersion`, timestamps, `deletedAt`.
- Tài khoản sở hữu: `ownerId`.

Lỗi được sửa: `dataFields(..., 'experiment')` chỉ giữ nhóm trường cũ, khiến các tham số,
trọng số, metric, cấu hình synthetic và dữ liệu CSV bị bỏ trước khi ghi DB qua create/PATCH/bulk/sync.
Đã bổ sung các trường khớp schema và DTO. `ownerId` vẫn do server quyết định và nay là trường
bắt buộc trong schema Dataset/Experiment/TrainingRun. Không lưu tên tài khoản làm khóa vì tên có thể đổi.

AppModule trước đó đăng ký cả AuthModule cũ lẫn LoginModule, trùng route auth. Đã bỏ đăng ký
AuthModule cũ để dùng một luồng bcrypt + cookie `hq3d.sid`. Không chuyển/xóa dữ liệu tài khoản cũ trong DB.

## Upload CSV

`POST /api/v1/datasets/upload`, multipart form-data, đúng một file ở field `file`;
field `name` là tùy chọn. Cần cookie đăng nhập và header `X-Requested-With: XMLHttpRequest`.

- Mặc định tối đa **10 MiB = 10.485.760 byte**; cấu hình bằng `MAX_DATASET_FILE_SIZE`.
- Giá trị phải là số nguyên dương; cấu hình không hợp lệ khiến startup báo lỗi.
- Multer và service dùng chung cách đọc cấu hình sau khi `.env` được nạp; chặn khi nhận file.
- Bắt buộc phần mở rộng `.csv` (chấp nhận `.CSV`), không chấp nhận `.txt`, `.xlsx`, `.csv.exe` dù MIME giả là `text/csv`.
- MIME hỗ trợ: `text/csv`, `application/csv`, `text/plain`, `application/vnd.ms-excel`, `application/octet-stream`.
  Đây là các MIME trình duyệt có thể gửi cho CSV; MIME không thay thế kiểm tra nội dung.
- Nội dung UTF-8 (có thể có BOM), phân cách dấu phẩy, header và ít nhất một dòng dữ liệu;
  tối thiểu hai cột cho dữ liệu hồi quy; tên cột không rỗng/trùng, số cột mỗi dòng phải khớp.
- Hỗ trợ CRLF/LF, trường quoted chứa dấu phẩy/xuống dòng/ngoặc kép kép.
- Chặn dấu ngoặc kép sai/chưa đóng, dữ liệu nhị phân/ký tự điều khiển, UTF-8 lỗi, quá 50.000 dòng dữ liệu.
- Tệp vượt dung lượng: **413**. Sai định dạng/cấu trúc/thiếu file/nhiều file: **400**.
- File bị từ chối không được ghi ổ đĩa hoặc DB. Nếu ghi metadata DB thất bại, dọn file vừa ghi.
- Metadata lưu `contentType: text/csv`, `sizeBytes` thực tế và `ownerId` từ session.

## Lưu và tải lại kết quả

Frontend phải bật `withCredentials: true` và gửi header CSRF cho các request ghi.
Không gửi user ID để tự chọn chủ sở hữu; backend dùng `_id` tài khoản trong session.
Tên/email tài khoản hiện tại lấy từ `GET /api/v1/auth/me`.

- `POST /api/v1/experiments`: lưu experiment tham chiếu dataset, có thể kèm snapshot kết quả.
- `POST /api/v1/experiments/bulk`: lưu danh sách snapshot (có thể dùng cho dữ liệu synthetic không có dataset upload).
- `PATCH /api/v1/experiments/:id`: cập nhật kết quả của experiment đã lưu.
- `POST /api/v1/training-runs`: lưu một lần chạy, gồm `experimentId`, `metrics`, `modelParameters`, `history`, `configSnapshot`.
- `POST /api/v1/sync/batch`: lưu hàng đợi offline; áp dụng cùng quy tắc tài khoản và giữ các trường snapshot.

Sau khi đăng nhập lại:

1. Gọi `GET /api/v1/auth/me` để xác nhận tài khoản.
2. Gọi `GET /api/v1/experiments?page=1&limit=20` để tải các bản lưu; tiếp tục phân trang theo `totalPages`.
3. Gọi `GET /api/v1/training-runs?experimentId=<id>&page=1&limit=20` khi mở một thí nghiệm.
   `experimentId` nhận cả Mongo `_id` lẫn `clientId`; không tồn tại/không có quyền trả 404, không trả nhầm mọi lần chạy.
4. Nếu dùng sync, gọi `GET /api/v1/sync/changes?since=<ISO>` và xử lý `deletedAt` để cập nhật bộ nhớ offline.

User thường chỉ thấy dữ liệu của mình; admin vẫn được xem tất cả theo quy tắc đã chốt.
Admin sửa dữ liệu không đổi chủ sở hữu. `ownerId` giả trong body bị bỏ qua.
JSON request tối đa 10 MiB để chứa được snapshot có ma trận CSV; tách batch lớn thành các request nhỏ.

Ví dụ lưu snapshot qua bulk:

```json
[
  {
    "id": "experiment-client-123",
    "name": "Hồi quy lần 1",
    "algorithm": "linear",
    "dataSource": "synthetic",
    "learningRate": 0.01,
    "maxIterations": 1000,
    "iterations": 50,
    "w": [2],
    "b": 1,
    "train": { "mse": 0.1, "rmse": 0.316, "mae": 0.2, "r2": 0.99 },
    "test": { "mse": 0.2, "rmse": 0.447, "mae": 0.3, "r2": 0.98 }
  }
]
```

DB lưu thêm `ownerId` của user đang đăng nhập. `GET /experiments` trả lại các trường kết quả trên.
Backend không tự chạy thuật toán; client phải gửi kết quả khi hoàn tất hoặc lưu qua hàng đợi sync.
Thay đổi này chưa sửa frontend. Bản ghi cũ đã có owner đúng vẫn đọc được; dữ liệu chưa từng
được lưu hoặc các trường đã bị bỏ trước khi ghi không thể tự phục hồi. Không tự gán các bản ghi
thiếu owner cho một tài khoản bất kỳ; migration dữ liệu cũ phải xác định chủ sở hữu riêng.

## Kiểm tra đã chạy

- `npm run build`: thành công.
- `npm run lint`: không lỗi/cảnh báo.
- `npm test`: 33 test qua (6 file).
- `npm run test:e2e`: 20 test qua, MongoDB tạm `hoi-quy-3d-test`; không đọc/sửa DB dev.
- `git diff --check`: không lỗi whitespace.

E2e kiểm tra cấu hình upload 1.024 byte riêng cho test (không thay mặc định 10 MiB),
file đúng/vượt giới hạn, giả MIME/đuôi tệp, nội dung sai, nhiều file, không ghi file lỗi;
lưu snapshot hơn 100 KiB, giữ owner qua bulk/PATCH/sync, và lấy lại kết quả sau đăng nhập lại.
