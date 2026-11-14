# Training runs — lưu các lần huấn luyện

[Về mục lục backend](../README.md) · [Experiments](../experiments/README.md) · [Sync](../sync/README.md)

## Vai trò

Một experiment là cấu hình/bối cảnh thí nghiệm; một training run là bản ghi của một lần chạy gắn với experiment đó. Module lưu cấu hình tại thời điểm chạy, chỉ số đánh giá, tham số mô hình và lịch sử loss để xem lại hoặc so sánh.

**API này lưu dữ liệu do client gửi, không khởi chạy huấn luyện trên server.** Gửi `status: running` không tạo worker; gửi `completed` không khiến server tính lại metrics. Một experiment có thể có nhiều run.

## API

Mọi route dưới `/api/v1`, yêu cầu đăng nhập bằng cookie. User thường chỉ thấy run của mình; admin được truy cập qua bộ lọc quyền chung. POST cần header `X-Requested-With: XMLHttpRequest`, `Content-Type: application/json`.

| Method, route | Chức năng | Kết quả |
|---|---|---|
| `POST /training-runs` | Lưu một run mới | 201, document run |
| `GET /training-runs` | Liệt kê run | 200, `{ items, total, page, limit, totalPages }` |
| `GET /training-runs?experimentId=...&page=1&limit=20` | Liệt kê theo experiment | Cùng cấu trúc phân trang |
| `GET /training-runs/:id` | Xem một run bằng `_id` hoặc `clientId` | 200, run với experiment đã populate |

Danh sách sắp `createdAt` giảm dần, bỏ run đã xóa mềm. `page` mặc định 1, `limit` mặc định 20/tối đa 100, đều phải nguyên dương. Không có route PATCH/DELETE trực tiếp; [SyncModule](../sync/README.md) có thao tác update/delete cho run.

## Đầu vào tạo run

| Trường | Bắt buộc / mặc định | Ý nghĩa |
|---|---|---|
| `experimentId` | Bắt buộc | `_id` hoặc `clientId` của experiment còn tồn tại và được phép truy cập |
| `algorithmType` | Bắt buộc | `linear`, `polynomial`, `ridge`, `lasso`, `neural-network` |
| `configSnapshot` | Bắt buộc theo schema | Object cấu hình tại thời điểm chạy, giữ độc lập với thay đổi experiment về sau |
| `clientId` | Server sinh UUID nếu thiếu | Chuỗi unique toàn collection, không phải khóa tự upsert |
| `algorithmVersion` | `1.0.0` | Phiên bản thuật toán do client cung cấp hoặc mặc định |
| `status` | `queued` | `queued/running/paused/completed/cancelled/failed` |
| `seed` | 42 | Seed lưu để mô tả khả năng tái lập |
| `datasetSha256` | Tùy chọn | Chuỗi hex 64 ký tự nhận diện nội dung dataset |
| `metrics` | Tùy chọn | `mse`, `rmse`, `mae`, `r2` |
| `modelParameters` | Tùy chọn | Object hệ số/trọng số mô hình |
| `history` | Mảng rỗng | Các điểm gồm `step` không âm, `loss`, `parameters`, `recordedAt` mặc định thời gian hiện tại |
| `error` | Tùy chọn | Object lỗi, thường có `code`, `message` |
| `startedAt`, `completedAt` | Tùy chọn | Mốc thời gian của lần huấn luyện |

`ownerId` và `syncVersion` được server gán lần lượt bằng user hiện tại và 1. Payload không được ghi đè `_id`, timestamps hoặc `deletedAt`. DTO không có decorator validation như module login; Mongoose kiểm tra các yêu cầu schema khi lưu, nên không giả định mọi payload sai đều trả 400.

## Ví dụ

Sau khi tạo một experiment, thay `experiment-demo-001` bằng `clientId` thật của nó. Body cho `POST /api/v1/training-runs`:

```json
{
  "clientId": "run-demo-001",
  "experimentId": "experiment-demo-001",
  "algorithmType": "linear",
  "status": "completed",
  "algorithmVersion": "1.0.0",
  "configSnapshot": { "learningRate": 0.01, "maxIterations": 100 },
  "seed": 42,
  "metrics": { "mse": 0.04, "rmse": 0.2, "mae": 0.15, "r2": 0.98 },
  "modelParameters": { "w": [2], "b": 1 },
  "history": [
    { "step": 0, "loss": 4, "parameters": { "w": [0], "b": 0 } },
    { "step": 100, "loss": 0.04, "parameters": { "w": [2], "b": 1 } }
  ]
}
```

Đây là số liệu minh họa để mô tả hợp đồng API, không phải kết quả server tính. MSE là trung bình bình phương sai số, RMSE là căn MSE, MAE là trung bình sai số tuyệt đối, R² là hệ số xác định. Server lưu các giá trị được gửi, không kiểm tra tính nhất quán toán học giữa chúng.

## Luồng xử lý và dữ liệu trả về

1. Service tìm experiment qua `_id/clientId`, áp dụng quyền owner/admin và yêu cầu chưa xóa mềm.
2. Chuyển tham chiếu thành MongoDB ObjectId của experiment.
3. Lấy các trường được phép, gán owner/phiên bản/default và lưu collection `trainingRuns`.
4. Kết quả tạo/list chứa `experimentId` dạng ID. Endpoint chi tiết populate trường này thành document experiment được phép truy cập.

Nếu experiment bị xóa mềm hoặc không còn thấy được, GET chi tiết run có thể vẫn trả run nhưng `experimentId` là `null`. Liệt kê không có bộ lọc experiment vẫn có thể trả run này; khi truyền `experimentId` đã bị xóa thì bước xác minh experiment trả 404.

Các trường hệ thống thêm vào kết quả gồm `_id`, `ownerId`, `syncVersion`, `createdAt`, `updatedAt`; `deletedAt` dùng cho xóa mềm. Schema có index theo `clientId` unique, experiment + thời gian tạo, owner + thời gian tạo.

## Giới hạn cần hiểu

- Trạng thái là dữ liệu lưu, không có state machine bắt buộc thứ tự queued → running → completed.
- Không tự đồng bộ cấu hình mới của experiment vào `configSnapshot`.
- Không so sánh `algorithmType` của run với thuật toán experiment, không xác minh checksum với file ở đây.
- POST không idempotent: gửi lại cùng `clientId` có thể lỗi unique index. Với retry offline, dùng hợp đồng sync.
- Schema `history` hiện không có giới hạn số phần tử riêng. Request JSON của ứng dụng giới hạn 10 MB; nên lưu điểm lịch sử cần thiết, không mặc định lưu mọi frame.
- Tạo bằng sync không đi qua service này nên không tự thêm mặc định `algorithmVersion: 1.0.0`; cần gửi trường đó khi sync tạo run.

## Lỗi, phụ thuộc và kiểm tra

401/403 liên quan phiên/header/Origin. 404 khi run/experiment không tồn tại, bị xóa hoặc không thuộc quyền truy cập. 400 cho phân trang sai. Lỗi validation/duplicate key từ Mongoose không được service ánh xạ thành thông báo riêng.

`training-runs.controller.ts` là ba route HTTP; service xử lý quyền/tham chiếu; DTO mô tả request; schema định nghĩa run, metrics, history. TrainingRunsModule import ExperimentsModule và xuất service/model cho sync/users.

Từ gốc, `npm run test:e2e` có các ca quyền sở hữu, tham chiếu experiment, lưu/khôi phục kết quả và xóa qua sync. Khi sửa hợp đồng dữ liệu, kiểm tra cả sự khác nhau giữa response list và detail.
