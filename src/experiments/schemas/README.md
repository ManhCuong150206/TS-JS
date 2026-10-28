# schemas

Định nghĩa **cấu trúc dữ liệu lưu trong MongoDB** (Mongoose schema viết bằng decorator của `@nestjs/mongoose`).
Khác với DTO: schema là dạng dữ liệu **đã lưu**, DTO là dạng dữ liệu **client gửi lên**.

## Các file

### `counter.schema.ts`
Collection `counters`, phục vụ ID tự tăng.

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `_id` | string | Tên collection cần đếm (ví dụ `"experiments"`) |
| `seq` | number | Số ID đã cấp gần nhất |

Chỉ tăng, không bao giờ giảm, nên ID đã xóa không bị tái sử dụng.

### `experiment.schema.ts`
Collection `experiments`.

| Field | Kiểu | Ghi chú |
|---|---|---|
| `_id` | number | ID tự tăng (1, 2, 3...) |
| `clientId` | string | **Unique**, định danh do client sinh (phục vụ đồng bộ offline) |
| `name`, `description` | string | Tên và mô tả |
| `status` | enum | Trạng thái huấn luyện, mặc định `draft` |
| `syncStatus` | enum | Trạng thái đồng bộ, mặc định `synced` |
| `algorithm` | object | `{ type, version, config }` |
| `datasetRef` | object | `{ datasetId, version? }` |
| `preprocessing` | object | `{ scaling, missingValues, removeOutliers }` |
| `splitConfig` | object | `{ trainRatio, validationRatio, testRatio, shuffle }` |
| `seed` | number | Hạt giống ngẫu nhiên |
| `syncVersion` | number | Khóa lạc quan, tăng 1 sau mỗi lần PATCH |
| `createdAt`, `updatedAt` | Date | Mongoose tự sinh (`timestamps: true`) |

#### `algorithm.config`
Lưu chung một cấu trúc với các field: `learningRate`, `maxIterations`, `tolerance` (bắt buộc), `degree` (chỉ polynomial), `lambda` (chỉ ridge/lasso).
Việc field nào bắt buộc theo loại thuật toán được kiểm tra ở tầng DTO, không phải ở schema.

#### Các object con
`AlgorithmEmbedded`, `DatasetRefEmbedded`, `PreprocessingEmbedded`, `SplitConfigEmbedded` dùng `@Schema({ _id: false })` nên không sinh thêm `_id` cho object lồng.

#### Index
| Index | Phục vụ |
|---|---|
| `clientId` (unique) | Chống trùng, tra cứu theo clientId |
| `updatedAt: -1` | Sắp xếp danh sách |
| `status + updatedAt` | Lọc theo trạng thái rồi sắp xếp |
| `algorithm.type + updatedAt` | Lọc theo thuật toán rồi sắp xếp |

#### Tùy chọn
- `versionKey: false`: bỏ field `__v`, vì đã dùng `syncVersion` làm khóa đồng thời.
- Không có `deletedAt`: dự án dùng xóa cứng.