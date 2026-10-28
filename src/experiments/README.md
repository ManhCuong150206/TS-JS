# experiments

Module nghiệp vụ chính: quản lý vòng đời một experiment (tạo, xem, sửa, thay thế, nhân bản, xóa).

## Các file

### `experiment.enums.ts`
Các tập giá trị cố định, dùng chung cho schema, DTO và service.

| Enum | Giá trị | Ý nghĩa |
|---|---|---|
| `AlgorithmType` | `linear_regression`, `polynomial_regression`, `ridge_regression`, `lasso_regression` | Loại thuật toán |
| `ExperimentStatus` | `draft`, `queued`, `running`, `completed`, `failed` | Trạng thái **huấn luyện** |
| `SyncStatus` | `synced`, `pending_sync`, `conflict` | Trạng thái **đồng bộ** (tách riêng với trạng thái huấn luyện) |
| `SplitMethod` | `random`, `stratified`, `sequential` | Cách chia dữ liệu train/validation/test |
| `PreprocessingStepType` | `standard_scaler`, `min_max_scaler`, `impute_mean`, `impute_median`, `drop_missing`, `remove_outliers` | Các bước tiền xử lý |

### `experiments.module.ts`
Đăng ký controller, service và 2 schema (`Experiment`, `Counter`) qua `MongooseModule.forFeature`.

### `experiments.controller.ts`
Lớp **giao tiếp HTTP**: nhận request, gọi service, trả kết quả. Không chứa logic nghiệp vụ.
`ParseIntPipe` ép `:id` thành số, truyền chữ vào thì trả 400.

| Route | Hàm service |
|---|---|
| `POST /experiments` | `create()` |
| `GET /experiments` | `findAll()` |
| `GET /experiments/:id` | `findOne()` |
| `PUT /experiments/:id` | `replace()` |
| `PATCH /experiments/:id` | `update()` |
| `POST /experiments/:id/duplicate` | `duplicate()` |
| `DELETE /experiments/:id` | `remove()` |

### `experiments.service.ts`
Lớp **nghiệp vụ**, nơi xử lý chính.

**Hàm phụ (private):**

| Hàm | Hoạt động |
|---|---|
| `nextId()` | Tăng bộ đếm trong collection `counters` bằng `$inc` nguyên tử, trả số mới |
| `assertSplit()` | Kiểm tra `trainRatio + validationRatio + testRatio` bằng 1 (sai số 0.001), sai thì 400 |
| `normalizeSplit()` | Không gửi `splitConfig.method` thì gán `random` |
| `getOrThrow()` | Lấy theo ID, không có thì 404 |
| `updateWithVersion()` | Hàm dùng chung của PUT và PATCH: khớp `syncVersion` thì cập nhật, lệch thì 409, không tồn tại thì 404 |

**Hàm nghiệp vụ:**

| Hàm | Hoạt động |
|---|---|
| `create()` | Kiểm tra tỉ lệ chia, kiểm tra trùng `clientId`, lấy ID mới, lưu. `clientId` trống thì tự sinh UUID |
| `findAll()` | Lọc theo `algorithm`, `status`, `search` (tên); sắp xếp theo `updatedAt`; phân trang; trả kèm `total`, `totalPages` |
| `findOne()` | Lấy chi tiết, không có thì 404 |
| `update()` | **PATCH**: chỉ cập nhật field được gửi |
| `replace()` | **PUT**: thay thế toàn bộ, field không gửi về mặc định |
| `duplicate()` | Sao chép cấu hình sang experiment mới: ID mới, `clientId` mới, tên `"<tên> (copy)"`, status `draft` |
| `remove()` | `deleteOne`, xóa hẳn khỏi MongoDB, không tìm thấy thì 404 |

Response luôn đổi `_id` thành `id`.

---

## Cơ chế ID tự tăng

Collection `counters` có 1 document `{ _id: "experiments", seq: N }`. Mỗi lần tạo, `seq` tăng 1 bằng `$inc` nguyên tử (hai request đồng thời không thể nhận cùng một số).

Counter chỉ tăng, không phụ thuộc số document hiện có, nên:

```
Có 1, 2, 3 → xóa 2 → còn 1, 3 → tạo mới → ID = 4
```

Khi tạo với `clientId` do client gửi, service kiểm tra trùng **trước khi cấp ID**, nên lỗi 409 vì trùng không làm hụt số ID.

---

## Cơ chế chống ghi đè (optimistic locking)

Mỗi experiment có `syncVersion` (bắt đầu từ 1, tăng 1 sau mỗi lần PUT/PATCH thành công). Client gửi `version` = số đang giữ:

```
findOneAndUpdate(
  { _id, syncVersion: version },
  { $set: ..., $inc: { syncVersion: 1 } }
)
```

| Kết quả | Mã |
|---|---|
| Khớp: cập nhật, `syncVersion` +1 | 200 |
| Lệch và bản ghi còn tồn tại: trả `yourVersion`, `currentVersion` | 409 |
| Bản ghi không tồn tại | 404 |

Kiểm tra và ghi nằm trong **một câu lệnh**, nên không có race condition.

Ví dụ hai người cùng sửa:

```
A và B cùng mở experiment 1 (version = 1)
A sửa tên    → khớp → thành công, version thành 2
B sửa mô tả  → B vẫn gửi version 1 → lệch → 409 (thay đổi của A không bị ghi đè)
```

B phải `GET` lại để lấy version 2 rồi sửa tiếp.

---

## PUT và PATCH: dùng cái nào?

| | PATCH `update()` | PUT `replace()` |
|---|---|---|
| Ý nghĩa | Sửa **một phần** | **Thay thế toàn bộ** |
| Body | Chỉ gửi field cần đổi | Phải gửi đủ `name`, `algorithm`, `splitConfig`, `seed` |
| Field không gửi | Giữ nguyên giá trị cũ | Về giá trị mặc định (bảng dưới) |
| `version` | Bắt buộc | Bắt buộc |
| Không đổi được | `id`, `clientId` | `id`, `clientId` |

Giá trị mặc định của PUT khi không gửi field:

| Field | Mặc định |
|---|---|
| `description` | `""` |
| `status` | `draft` |
| `syncStatus` | `synced` |
| `datasetRef` | `null` |
| `preprocessing` | `{ "steps": [] }` |
| `splitConfig.method` | `random` |

**Lưu ý:** experiment đang `running` mà PUT không gửi `status` thì bị reset về `draft`. Muốn giữ nguyên thì gửi lại `status`, hoặc dùng PATCH.

Với object con (`algorithm`, `splitConfig`, `preprocessing`, `datasetRef`), cả PUT lẫn PATCH đều **thay thế cả object**, không gộp từng field. Muốn đổi mỗi `trainRatio` vẫn phải gửi đủ `splitConfig`.

Luồng của `replace()`:

```
PUT /experiments/1 (kèm version)
  → ValidationPipe kiểm tra ReplaceExperimentDto (sai thì 400)
  → assertSplit() (sai thì 400)
  → dựng dữ liệu đầy đủ, field thiếu lấy mặc định
  → updateWithVersion() → 200 / 409 / 404
```

---

## Quy tắc nghiệp vụ khác

- `syncStatus` tách riêng khỏi `status`: đổi sang `pending_sync` **không** làm đổi trạng thái huấn luyện.
- `datasetRef` cho phép `null` (chưa gắn dataset). PATCH gửi `null` để gỡ dataset.
- `duplicate()` luôn tạo bản `draft`, `syncVersion = 1`, `clientId` mới, bất kể bản gốc đang ở trạng thái nào.
- Danh sách sắp xếp mặc định theo `updatedAt` giảm dần (mới sửa nhất đứng đầu), `_id` giảm dần làm tiêu chí phụ.
- Tìm kiếm `search` escape ký tự đặc biệt của regex, nên gõ `a.b` hay `(abc` không gây lỗi.