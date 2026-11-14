# Datasets — dữ liệu đầu vào và tệp CSV

[Về mục lục backend](../README.md) · [Experiments](../experiments/README.md) · [Bộ kiểm tra CSV](../common/README.md)

## Module làm gì?

`DatasetsModule` quản lý dữ liệu đầu vào của thí nghiệm hồi quy: tải CSV lên, phân tích cấu trúc/thống kê cột, lưu metadata, xem danh sách/chi tiết, tải lại tệp và xóa mềm dataset. Có hai cách tạo: upload tệp thực hoặc gửi metadata cho dữ liệu mẫu/sinh tự động.

MongoDB lưu metadata trong collection `datasets`; bytes CSV nằm trên ổ đĩa server. Tạo metadata không sinh tệp CSV, không chạy thuật toán và không tự tạo thí nghiệm.

## Điều kiện gọi API

Đăng nhập qua [login](../login/README.md), gửi cookie `hq3d.sid`. Khi dùng trình duyệt, đặt `credentials: 'include'`. Mọi POST/DELETE cần `X-Requested-With: XMLHttpRequest`.

User thường chỉ truy cập dữ liệu có `ownerId` của mình. Admin có thể truy cập dữ liệu của các user khác. Dữ liệu không thuộc quyền truy cập được trả 404. `ownerId` luôn được server gán khi tạo; client không thể chuyển quyền sở hữu bằng body.

## API

Các route bên dưới có tiền tố `/api/v1`.

| Method, route | Đầu vào | Kết quả |
|---|---|---|
| `POST /datasets/upload` | Multipart: `file` bắt buộc, `name` tùy chọn | 201, document dataset và metadata đã phân tích |
| `POST /datasets` | JSON metadata | 201, document dataset mới |
| `GET /datasets?page=1&limit=20` | Phân trang | 200, `{ items, total, page, limit, totalPages }` |
| `GET /datasets/:id` | `_id` hoặc `clientId` | 200, document dataset |
| `GET /datasets/:id/download` | `_id` hoặc `clientId` | 200, tệp tải xuống với tên gốc |
| `DELETE /datasets/:id` | `_id` hoặc `clientId` | 200, `{ "success": true, "message": "Đã xóa dataset thành công." }` |

Danh sách sắp theo `createdAt` giảm dần, loại bản ghi có `deletedAt`. `page` mặc định 1, `limit` mặc định 20, tối đa 100; cả hai phải là số nguyên dương. Không có endpoint PATCH dataset riêng; chỉnh metadata qua cơ chế [sync](../sync/README.md).

## Upload CSV: định dạng và luồng xử lý

Tệp phải có đuôi `.csv` và MIME thuộc `text/csv`, `application/csv`, `text/plain`, `application/vnd.ms-excel` hoặc `application/octet-stream`. Server kiểm tra tiếp nội dung, không chỉ tin đuôi/MIME.

- Dùng UTF-8, phân cột bằng dấu phẩy; hỗ trợ CRLF/LF, ô được bao bằng dấu nháy kép, dấu phẩy/xuống dòng trong ô và escape `""`.
- Có header và ít nhất một dòng dữ liệu; ít nhất hai cột. Tên cột không rỗng, không trùng sau trim.
- Mỗi dòng dữ liệu phải có số cột khớp header; tối đa mặc định 50.000 dòng dữ liệu. Dòng hoàn toàn trống bị bỏ qua.
- Không nhận nội dung nhị phân/ký tự điều khiển không được phép hoặc UTF-8 hỏng.
- Giá trị thiếu được thống kê, không tự làm tệp thất bại. CSV hợp lệ không đồng nghĩa tất cả cột đều phù hợp để huấn luyện số.

Ví dụ tệp `sample.csv`:

```csv
x1,x2,y
1,2,5
2,3,8
3,4,11
```

Luồng upload: kiểm tra size/MIME → parse/validate → tính SHA-256, thống kê cột, tối đa 20 preview rows → ghi tệp `<UUID>.csv` → lưu document với `status: ready`, `syncVersion: 1`, owner hiện tại. Nếu lưu MongoDB thất bại sau khi ghi tệp, service cố xóa tệp vừa tạo. Tên dataset lấy từ `name` đã trim; nếu không có thì dùng tên file bỏ phần mở rộng.

Ví dụ upload từ giao diện, với `file` là đối tượng File đã chọn:

```js
const form = new FormData();
form.append('file', file);
form.append('name', 'Dữ liệu hồi quy mẫu');
const response = await fetch('http://localhost:3000/api/v1/datasets/upload', {
  method: 'POST', credentials: 'include',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  body: form,
});
if (!response.ok) throw new Error(await response.text());
const dataset = await response.json();
```

Không tự đặt `Content-Type` khi gửi FormData; trình duyệt cần tự thêm multipart boundary.

## Tạo dataset bằng metadata

Body ví dụ cho `POST /api/v1/datasets`:

```json
{
  "clientId": "dataset-demo-001",
  "name": "Dữ liệu sinh minh họa",
  "sourceType": "generated",
  "rowCount": 3,
  "columns": [
    { "name": "x", "inferredType": "number" },
    { "name": "y", "inferredType": "number" }
  ],
  "previewRows": [{ "x": 1, "y": 3 }],
  "generationConfig": { "seed": 42 }
}
```

`name` bắt buộc, trim, tối đa 120 ký tự. `sourceType` bắt buộc thuộc `upload/sample/generated`. `clientId` tùy chọn; server sinh UUID nếu thiếu và yêu cầu unique trên toàn collection. Các trường metadata nhận thêm: `originalFileName` (tối đa 255 ký tự), `contentType`, `sizeBytes`, `rowCount`, `columns`, `previewRows`, `generationConfig`. Kích thước/số dòng nếu có phải không âm theo schema.

DTO này chỉ khai báo kiểu TypeScript, không có bộ decorator validation như login/users. Service lọc trường được phép và Mongoose kiểm tra schema khi lưu; không nên giả định mọi body sai đều có thông báo 400 đẹp. Metadata do client gửi không được chạy lại bộ phân tích CSV. `storage`, `ownerId`, `deletedAt`, `syncVersion` từ body không được dùng để ghi đè giá trị server.

## Hiểu document trả về

| Nhóm trường | Ý nghĩa |
|---|---|
| `_id`, `clientId` | ID MongoDB và ID chuỗi dùng phía client; cả hai đều dùng được ở route chi tiết |
| `name`, `sourceType`, `originalFileName`, `contentType` | Tên và nguồn dữ liệu |
| `sizeBytes`, `rowCount` | Dung lượng tệp và số dòng dữ liệu, không tính header |
| `columns` | Tên cột, kiểu suy luận, số ô thiếu/không thiếu; min/max/mean nếu phù hợp |
| `previewRows` | Mẫu xem trước; upload tự giới hạn 20 dòng, không phải toàn bộ CSV |
| `storage` | Upload tạo provider `local-volume`, key UUID, format `csv`, SHA-256 và filePath |
| `generationConfig` | Metadata cấu hình sinh dữ liệu; server không thực thi nó |
| `status` | Schema cho phép `processing/ready/failed`; hai API tạo hiện đều ghi `ready` |
| `ownerId`, `syncVersion`, `deletedAt`, timestamps | Chủ sở hữu, phiên bản sync, dấu xóa mềm, thời gian tạo/cập nhật |

Schema có enum storage `gridfs/object-storage` và format `json`, nhưng luồng upload/download hiện chỉ triển khai CSV trên local volume.

## Lưu trữ, xóa và lỗi thường gặp

`DATASET_STORAGE_DIR` mặc định `./data/uploads`, được resolve theo thư mục chạy tiến trình. `MAX_DATASET_FILE_SIZE` là số nguyên dương tính bằng byte, mặc định 10 MiB (10.485.760 byte). Giá trị như `10MB`, `0` hoặc số thập phân làm cấu hình lỗi.

Download tra dataset theo quyền, kiểm tra key đúng dạng UUID CSV, dựng đường dẫn từ storage directory và kiểm tra file còn tồn tại. Nó không tin đường dẫn do client gửi. Dataset metadata không có storage hoặc file đã mất trả 404.

DELETE chỉ đặt `deletedAt`, không xóa tệp vật lý, không xóa dây chuyền experiment/run và hiện không tăng `syncVersion` ở route này. `updatedAt` vẫn được Mongoose cập nhật. Trong luồng sync, xóa dataset có tăng phiên bản; hai luồng có hành vi khác nhau.

| Mã | Trường hợp thường gặp |
|---|---|
| 400 | Thiếu file, sai extension/MIME, CSV lỗi cấu trúc, phân trang sai |
| 401/403 | Lỗi phiên hoặc header/Origin |
| 404 | Không thấy dataset, không có quyền, không có tệp để tải |
| 413 | Vượt giới hạn upload |

Lỗi CSV có body chứa `message` và mảng `details` để hiển thị nguyên nhân cụ thể. Lỗi schema/unique index có thể đi qua xử lý lỗi mặc định, không có ánh xạ lỗi riêng trong service.

## Thành phần và kiểm tra

`datasets.controller.ts` nhận HTTP; `datasets.service.ts` điều phối file và MongoDB; `upload.config.ts` cấu hình Multer; `dto/create-dataset.dto.ts` mô tả metadata; `schemas/dataset.schema.ts` định nghĩa document và index. Module xuất DatasetsService cùng model cho experiments, sync và users.

Từ gốc dự án: `npm test -- src/datasets/upload.config.spec.ts src/common/csv-validator.spec.ts` kiểm tra cấu hình upload và CSV. Bộ `npm run test:e2e` có các ca upload/download và quyền sở hữu.
