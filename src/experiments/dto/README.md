# dto

**Data Transfer Object**: định nghĩa hình dạng và quy tắc hợp lệ của dữ liệu client gửi lên.
`ValidationPipe` dùng các class này để kiểm tra tự động; dữ liệu sai bị chặn trả **400** trước khi vào service.
Swagger cũng đọc các class này để sinh tài liệu và form thử API.

## Các file

### `create-experiment.dto.ts`
Dữ liệu khi **tạo** experiment (`POST /experiments`). Gồm các class:
- `CreateExperimentDto`: `name` (bắt buộc, tối đa 120 ký tự), `description`, `status`, `syncStatus`, `seed` (số nguyên ≥ 0), và 4 object con bên dưới. **Không có ID** vì ID do server tự cấp. `clientId` là tùy chọn.
- `DatasetRefDto`: `datasetId` (bắt buộc), `version`.
- `PreprocessingDto`: `scaling`, `missingValues`, `removeOutliers`.
- `SplitConfigDto`: 3 tỉ lệ trong khoảng 0–1 và `shuffle`. Tổng 3 tỉ lệ phải bằng 1 (service kiểm tra).

### `algorithm.dto.ts`
Validate cấu hình thuật toán **theo loại** (discriminator).

| `algorithm.type` | Class kiểm tra `config` | Ràng buộc |
|---|---|---|
| `linear` | `LinearConfigDto` | `learningRate > 0`, `maxIterations` nguyên ≥ 1, `tolerance > 0` |
| `polynomial` | `PolynomialConfigDto` | như linear + `degree` nguyên ≥ 2 (bắt buộc) |
| `ridge`, `lasso` | `RegularizedConfigDto` | như linear + `lambda ≥ 0` (bắt buộc) |

**Cách hoạt động:** decorator `@Transform` trên `config` đọc `type` của object cha, chọn class phù hợp rồi chuyển `config` thành instance của class đó; `@ValidateNested` sẽ validate theo class đã chọn. Vì bật `forbidNonWhitelisted` nên field không thuộc loại đó (ví dụ `degree` trong linear) bị từ chối.

### `update-experiment.dto.ts`
Dữ liệu khi **sửa** (`PATCH`). Kế thừa `CreateExperimentDto` với:
- Mọi field đều **tùy chọn** (`PartialType`): chỉ gửi field cần đổi.
- **Bỏ `clientId`** (`OmitType`): không cho đổi định danh.
- Thêm `version` **bắt buộc**: `syncVersion` client đang giữ, dùng để phát hiện xung đột.

Lưu ý: object con (`algorithm`, `splitConfig`...) nếu gửi thì phải gửi đủ, vì sẽ thay thế cả object.
### `replace-experiment.dto.ts`
Dữ liệu khi **thay thế toàn bộ** (`PUT /experiments/:id`).

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `version` | Có | `syncVersion` client đang giữ, nguyên số ≥ 1 |
| `name` | Có | Tối đa 120 ký tự |
| `algorithm` | Có | Kiểm tra theo loại thuật toán (xem `algorithm.dto.ts`) |
| `splitConfig` | Có | Tổng 3 tỉ lệ phải bằng 1 |
| `seed` | Có | Số nguyên ≥ 0 |
| `description`, `status`, `syncStatus` | Không | Không gửi thì về mặc định |
| `datasetRef`, `preprocessing` | Không | Không gửi thì về `null` và `{ "steps": [] }` |

**Khác `UpdateExperimentDto`:** ở PATCH mọi field đều tùy chọn, ở PUT bốn field `name`, `algorithm`, `splitConfig`, `seed` là bắt buộc, vì PUT thay thế cả bản ghi.

**Khác `CreateExperimentDto`:** không có `clientId` (định danh không được đổi) và có thêm `version`.

Gửi `id` hoặc `clientId` vào PUT sẽ bị từ chối với 400, do `forbidNonWhitelisted` bật toàn cục.
### `query-experiments.dto.ts`
Tham số query của `GET /experiments`.

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `page` | 1 | Trang hiện tại (≥ 1) |
| `limit` | 10 | Số bản ghi/trang (1–100) |
| `algorithm` | – | Lọc theo loại thuật toán |
| `status` | – | Lọc theo trạng thái huấn luyện |
| `search` | – | Tìm theo tên, không phân biệt hoa thường |
| `sortOrder` | `desc` | Sắp xếp theo `updatedAt` (`asc`/`desc`) |

`@Type(() => Number)` giúp ép `page`, `limit` từ chuỗi trên URL sang số.

### `duplicate-experiment.dto.ts`
Body của `POST /experiments/:id/duplicate`. Chỉ có `name` tùy chọn; bỏ trống thì tên bản sao là `"<tên gốc> (copy)"`.

## DTO và Schema khác nhau thế nào?

| | DTO | Schema |
|---|---|---|
| Dùng cho | Dữ liệu **vào** API | Dữ liệu **lưu** DB |
| Kiểm tra bởi | class-validator (tầng API) | Mongoose (tầng DB) |
| Có ID, syncVersion, timestamps | Không (server tự quản lý) | Có |