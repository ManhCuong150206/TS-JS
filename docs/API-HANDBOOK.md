# API HANDBOOK — Hồi quy 3D, dành cho AI tích hợp

> Đối chiếu source đang có trong workspace ngày 08/11/2026 (Asia/Saigon).
> Tài liệu tự chứa thông tin để chọn/gọi API, tên hàm, dữ liệu và luồng xử lý.
> Mô tả hành vi hiện tại, không phải tính năng dự định. Cần cập nhật khi backend thay đổi.

## Mục lục

1. Phạm vi và quy tắc chung
2. Toàn bộ endpoint và tên hàm
3. Auth và quản lý tài khoản
4. Datasets/upload CSV
5. Experiments và cấu hình thuật toán
6. Training runs
7. Sync offline
8. Ví dụ tích hợp hoàn chỉnh
9. Lỗi và giới hạn hiện tại
10. Collections và hàm nội bộ
11. Cấu hình, lệnh chạy, migration và code cũ
12. Phạm vi kiểm chứng

## 1. Phạm vi và quy tắc chung

- Backend chính: NestJS 12 + TypeScript ES modules + Mongoose 9; entrypoint `src/main.ts`, module gốc `src/app.module.ts`.
- Base URL local: **`http://localhost:3000/api/v1`**. Path trong tài liệu nối vào base này.
- **Không có API chạy thuật toán/train/predict/start/stop.** Backend lưu cấu hình và kết quả do client tính rồi gửi lên.
- Experiments dùng chung API cho `linear`, `polynomial`, `ridge`, `lasso`, `neural-network`; không có `/linear`, `/ridge` riêng.
- `src/login` là auth module đang hoạt động, controller path `auth`; không có endpoint `/login`.
- `src/auth` là code cũ **không được đăng ký trong AppModule**. Không gọi `/auth/guest`, `/auth/session`, không dùng cookie `regression_sid` hoặc response `{user: ...}` của code cũ.
- `database/backend` là starter model/kết nối DB riêng, không có REST server. Model Lesson ở đó không đồng nghĩa có `/lessons`.

### 1.1 Header, cookie và quyền

| Trường hợp            | Yêu cầu                                                             |
| --------------------- | ------------------------------------------------------------------- |
| Mọi request browser   | Angular `withCredentials:true` hoặc Fetch `credentials:'include'`   |
| POST/PATCH/PUT/DELETE | `X-Requested-With: XMLHttpRequest`, kể cả login/register/upload     |
| JSON body             | `Content-Type: application/json`                                    |
| Multipart upload      | Browser tự đặt Content-Type/boundary, không tự gắn application/json |
| Download              | Đọc Blob/ArrayBuffer, không parse JSON khi thành công               |
| CORS mặc định         | http://localhost:4200 và http://localhost:5173, credentials=true    |

Thiếu custom header hoặc Origin ngoài allowlist → 403. OPTIONS do CORS xử lý.
Angular gọi URL tuyệt đối không tự gắn XSRF header: cần interceptor riêng.
Cookie `hq3d.sid`, HttpOnly, SameSite=Lax, path `/`, maxAge 7 ngày; Secure ở production hoặc COOKIE_SECURE=true.
Session lưu MongoDB; không JWT. `x-user-id` và Bearer userId không cấp quyền.

- Public: GET `/`, GET `/health`, POST `/auth/register`, POST `/auth/login`.
- Mọi route còn lại cần user active có session hợp lệ. User thường chỉ đọc/ghi dữ liệu của mình, admin có quyền mọi owner.
- Route quản trị users kiểm tra RolesGuard + role admin.
- AuthGuard nạp user từ DB mỗi request, kiểm tra status/sessionVersion. User mất/disabled/version lệch → hủy session và 401.
- Khi 401, client dừng sync queue, xóa trạng thái user và yêu cầu đăng nhập lại. Phân vùng cache/queue theo user ID.
- `ownerId` lấy từ session; không dùng email/tên làm khóa. Tên/email hiện tại lấy ở `/auth/me`.

### 1.2 ID, response, thời gian và phân trang

- `_id`: Mongo ObjectId, JSON là chuỗi 24 hex, do DB sinh.
- `clientId`: chuỗi định danh phía client (nên UUID), unique toàn collection, không chỉ unique theo owner.
- `ownerId`: chuỗi `_id` user. Khi update giữ owner cũ, kể cả admin sửa.
- Dataset/experiment/training-run `:id` nhận `_id` hoặc `clientId`. Users `:id` chỉ nhận Mongo `_id`.
- Bulk experiment `id` là alias của `clientId`; response `items[].id` cũng là clientId.
- Sync định danh bản ghi bằng `entityClientId`, không phải Mongo `_id`.
- Reference input datasetId/experimentId nhận cả Mongo ID/clientId, server resolve sang ObjectId.
- Date response là ISO string. `clientCreatedAt` là number (client nên dùng epoch milliseconds).
- Resource thường trả document trực tiếp, không bọc `{data:...}`; có thể có `__v`, nên bỏ qua và dùng syncVersion cho sync.
- Optional field có thể vắng mặt; không giả định luôn null.

```ts
interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
// totalPages = ceil(total/limit), bằng 0 khi total=0.
```

Mặc định `page=1`, `limit=20`. Các API danh sách users, datasets, experiments và training runs nhận số nguyên dương và giới hạn `limit` tối đa 100. Giá trị không hợp lệ trả `400`.
Sort dataset/run theo createdAt giảm dần, experiment theo updatedAt giảm dần, users theo createdAt rồi _id giảm dần.

## 2. Toàn bộ endpoint và tên hàm

**31 route** đang đăng ký. Path sau `/api/v1`. Mọi route ghi có thể lỗi CSRF/CORS 403;
mọi route bảo vệ có thể 401. Chi tiết body/response/lỗi ở các mục sau.

| Method | Path                     | Controller.method → service/hàm chính                                       | Input                    | Response thành công      | Quyền                 |
| ------ | ------------------------ | --------------------------------------------------------------------------- | ------------------------ | ------------------------ | --------------------- |
| GET    | `/`                      | AppController.getHello → AppService.getHello                                | —                        | 200 text Hello World!    | Public                |
| GET    | `/health`                | AppController.getHealth                                                     | —                        | 200 Health               | Public                |
| POST   | `/auth/register`         | LoginController.register → LoginService.register                            | RegisterDto              | 201 User                 | Public                |
| POST   | `/auth/login`            | LoginController.signIn → LoginService.authenticate, saveSession             | LoginDto                 | 200 User + cookie        | Public                |
| POST   | `/auth/logout`           | LoginController.logout → destroySession                                     | —                        | 200 {success:true}       | User                  |
| GET    | `/auth/me`               | LoginController.me → publicUser                                             | —                        | 200 User                 | User                  |
| GET    | `/users/me`              | UsersController.me → publicUser                                             | —                        | 200 User                 | User                  |
| PATCH  | `/users/me`              | UsersController.updateMe → UsersService.updateProfile                       | UpdateProfileDto         | 200 User                 | Chính mình            |
| PATCH  | `/users/me/password`     | UsersController.password → UsersService.changePassword, saveSession         | ChangePasswordDto        | 200 User                 | Chính mình            |
| DELETE | `/users/me`              | UsersController.deleteMe → verifyPassword, deleteAccount, destroySession    | DeleteAccountDto         | 200 {success:true}       | Chính mình            |
| GET    | `/users`                 | UsersController.list → UsersService.list                                    | page,limit,search        | 200 Page<User>           | Admin                 |
| GET    | `/users/:id`             | UsersController.findOne → UsersService.findOne, publicUser                  | Mongo id                 | 200 User                 | Admin                 |
| PATCH  | `/users/:id`             | UsersController.update → UsersService.adminUpdate                           | AdminUpdateUserDto       | 200 User                 | Admin                 |
| DELETE | `/users/:id`             | UsersController.remove → UsersService.deleteAccount                         | Mongo id                 | 200 {success:true}       | Admin                 |
| POST   | `/datasets/upload`       | DatasetsController.uploadFile → DatasetsService.uploadCsv                   | multipart file,name?     | 201 Dataset              | User                  |
| POST   | `/datasets`              | DatasetsController.create → DatasetsService.create                          | CreateDatasetDto         | 201 Dataset              | User                  |
| GET    | `/datasets`              | DatasetsController.findAll → DatasetsService.findAll                        | page,limit               | 200 Page<Dataset>        | User                  |
| GET    | `/datasets/:id`          | DatasetsController.findOne → DatasetsService.findOne                        | id                       | 200 Dataset              | Owner/admin           |
| GET    | `/datasets/:id/download` | DatasetsController.downloadFile → DatasetsService.getFilePath, res.download | id                       | 200 file                 | Owner/admin           |
| DELETE | `/datasets/:id`          | DatasetsController.remove → DatasetsService.remove                          | id                       | 200 {success,message}    | Owner/admin           |
| POST   | `/experiments`           | ExperimentsController.create → ExperimentsService.create                    | CreateExperimentDto      | 201 Experiment           | User                  |
| POST   | `/experiments/bulk`      | ExperimentsController.bulkUpsert → ExperimentsService.bulkUpsert            | array snapshot           | 200 BulkResult           | User, owner từng item |
| GET    | `/experiments`           | ExperimentsController.findAll → ExperimentsService.findAll                  | page,limit               | 200 Page<Experiment>     | User                  |
| GET    | `/experiments/:id`       | ExperimentsController.findOne → ExperimentsService.findOne                  | id                       | 200 Experiment           | Owner/admin           |
| PATCH  | `/experiments/:id`       | ExperimentsController.update → ExperimentsService.update                    | UpdateExperimentDto      | 200 Experiment           | Owner/admin           |
| DELETE | `/experiments/:id`       | ExperimentsController.remove → ExperimentsService.remove                    | id                       | 200 {success,message}    | Owner/admin           |
| POST   | `/training-runs`         | TrainingRunsController.create → TrainingRunsService.create                  | CreateTrainingRunDto     | 201 TrainingRun          | User                  |
| GET    | `/training-runs`         | TrainingRunsController.findAll → TrainingRunsService.findAll                | experimentId?,page,limit | 200 Page<TrainingRun>    | User                  |
| GET    | `/training-runs/:id`     | TrainingRunsController.findOne → TrainingRunsService.findOne                | id                       | 200 TrainingRun          | Owner/admin           |
| POST   | `/sync/batch`            | SyncController.batchSync → SyncService.processBatch                         | SyncBatchRequestDto      | 201 SyncBatchResponseDto | User                  |
| GET    | `/sync/changes`          | SyncController.getChanges → SyncService.getChanges                          | since?                   | 200 Changes              | User                  |

```json
{
  "status": "ok",
  "service": "hoi-quy-3d-api",
  "version": "1.0.0",
  "timestamp": "2026-11-08T00:00:00.000Z"
}
```

Đây là Health response, không ping DB tại request đó. Không có PUT route, PATCH dataset,
PATCH/DELETE training-run trực tiếp, endpoint auditLogs, reset password, xác minh email hay Swagger được đăng ký.

## 3. Auth và quản lý tài khoản

```ts
type Role = 'user' | 'admin';
type UserStatus = 'active' | 'disabled';
interface User {
  _id: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}
interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}
interface LoginDto {
  email: string;
  password: string;
}
interface UpdateProfileDto {
  displayName: string;
}
interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
interface DeleteAccountDto {
  password: string;
}
interface AdminUpdateUserDto {
  displayName?: string;
  role?: Role;
  status?: UserStatus;
}
interface ListUsersDto {
  page?: number;
  limit?: number;
  search?: string;
}
```

- Email trim/lowercase, email hợp lệ, tối đa 254 ký tự. DisplayName trim, 1–120 ký tự.
- Password không trim, ít nhất 8 ký tự và tối đa **72 byte UTF-8**; áp dụng login/đăng ký/đổi/xác nhận xóa. Bcrypt cost 12.
- Auth/users dùng ValidationPipe transform + whitelist + forbidNonWhitelisted. Register bỏ qua riêng role/ownerId, còn field lạ khác 400.
- Profile chỉ sửa displayName. Admin update cũng không sửa email/password. Search tối đa 120 ký tự, tìm phần email/displayName không phân biệt hoa thường, escape regex.
- Response User không chứa passwordHash/salt/sessionVersion.
- Register trả 201 User, **không tự đăng nhập**; email trùng 409, input sai 400.
- Login trả 200 User trực tiếp; regenerate session. Sai email/password hoặc disabled đều 401: `Email hoặc mật khẩu không đúng`.
- Login/register mỗi endpoint **5 request/phút/IP**, tính cả thành công, quá giới hạn 429; bộ đếm trong RAM backend.
- Logout cần session hợp lệ; hủy session, clear cookie. Gọi lại sau logout → 401.
- Đổi password cần currentPassword đúng (sai 401), tăng sessionVersion; giữ phiên đang gọi, các phiên khác hết hiệu lực.
- Xóa mình cần password; khóa/tăng version, soft-delete datasets/experiments/trainingRuns, hard-delete user, clear cookie. Không xóa CSV vật lý.
- Admin đổi role/status thực sự thay đổi mới tăng version; mọi phiên target hết hiệu lực kể cả admin tự sửa.
- Admin DELETE :id không cần password; clear cookie nếu xóa chính mình.
- Admin active cuối cùng không thể bị xóa/khóa/hạ quyền → 400. User thường gọi admin route → 403; target không có/sai id → 404.
- Xóa nhiều collection không atomic; nếu DB lỗi giữa chừng user đã khóa, admin có thể retry. Bảo vệ admin cuối cùng serialize trong một tiến trình.

Register body mẫu (login chỉ lấy email/password):

```json
{
  "email": "linh@example.com",
  "password": "example-password-123",
  "displayName": "Linh"
}
```

User response mẫu, ID/ngày do server sinh thực tế:

```json
{
  "_id": "690d10000000000000000001",
  "email": "linh@example.com",
  "displayName": "Linh",
  "role": "user",
  "status": "active",
  "createdAt": "2026-11-08T00:00:00.000Z",
  "updatedAt": "2026-11-08T00:00:00.000Z"
}
```

## 4. Datasets/upload CSV

### 4.1 POST /datasets — metadata

```ts
interface DatasetColumn {
  name: string;
  inferredType?: 'number' | 'string' | 'date' | 'boolean' | 'unknown';
  missingCount?: number;
  min?: number;
  max?: number;
  mean?: number;
  count?: number;
}
interface CreateDatasetDto {
  clientId?: string; // thiếu thì server sinh UUID
  name: string; // trim, tối đa 120
  sourceType: 'upload' | 'sample' | 'generated';
  originalFileName?: string; // tối đa 255
  contentType?: string;
  sizeBytes?: number;
  rowCount?: number; // size/rows >=0
  columns?: DatasetColumn[];
  previewRows?: Record<string, unknown>[];
  generationConfig?: Record<string, unknown>;
}
```

Dataset response thêm `_id`, clientId, ownerId, status (create/upload ép ready), syncVersion ban đầu 1,
createdAt/updatedAt, __v?, deletedAt?, storage?. Columns/previewRows mặc định [].
Schema status có processing/ready/failed, nhưng create/upload luôn ready.
Không gửi storage/ownerId/deletedAt/syncVersion, chúng bị bỏ qua trong payload ghi thông thường.
Tạo metadata sourceType=upload **không upload file**, không tạo storage; download record đó 404.

```json
{
  "clientId": "dataset-local-1",
  "name": "Dữ liệu mẫu",
  "sourceType": "generated",
  "columns": [
    { "name": "x", "inferredType": "number" },
    { "name": "y", "inferredType": "number" }
  ],
  "previewRows": [
    { "x": 1, "y": 3 },
    { "x": 2, "y": 5 }
  ],
  "generationConfig": { "seed": 42 }
}
```

### 4.2 POST /datasets/upload

Multipart có **một file** ở field `file`, text `name` tùy chọn. Thiếu name thì lấy tên file bỏ đuôi.
ClientId server sinh, không nhận clientId qua multipart.

- Default **10 MiB = 10485760 byte**, cấu hình MAX_DATASET_FILE_SIZE; vượt giới hạn 413.
- Bắt buộc đuôi `.csv` (chấp nhận .CSV). .txt/.xlsx/.csv.exe bị từ chối dù MIME text/csv.
- MIME hỗ trợ: text/csv, application/csv, text/plain, application/vnd.ms-excel, application/octet-stream.
- Kiểm tra nội dung UTF-8 (BOM được), delimiter dấu phẩy, header không rỗng/trùng, ít nhất 2 cột và 1 dòng dữ liệu,
  số cột mỗi dòng khớp header, tối đa 50.000 dòng dữ liệu.
- Hỗ trợ CRLF/LF, quoted multiline, dấu phẩy trong quoted field, escaped quote `""`.
- Sai quote, UTF-8 lỗi, binary/control characters, thiếu file/nhiều file/sai nội dung → 400.
- Excel binary/UTF-16/delimiter chấm phẩy không được xử lý như CSV dấu phẩy.
- Preview giữ tối đa **20 dòng**, không phải toàn bộ dữ liệu; muốn đọc hết phải download CSV gốc.
- Type cột suy luận nếu >=80% giá trị không thiếu là number/boolean/date; còn lại string.
  Chuỗi rỗng/null/undefined/NaN được đếm thiếu; mean số làm tròn 4 chữ số.
- Chỉ ghi file khi nội dung hợp lệ; nếu DB save lỗi thì dọn file vừa ghi.

Response Dataset có thêm:

```ts
storage: { provider:'local-volume'; key:string; format:'csv'; sha256:string; filePath?:string };
// contentType='text/csv', sizeBytes thực tế, rowCount, columns, previewRows.
```

Không dùng filePath làm URL. Download qua `/datasets/:id/download` trả attachment tên file gốc.
Schema có provider gridfs/object-storage và format json nhưng upload implementation hiện tại chỉ local-volume/csv.
Không có storage hoặc file vật lý đã mất → 404.
DELETE là soft-delete, trả `{"success":true,"message":"Đã xóa dataset thành công."}`;
không xóa file vật lý, không cascade experiment/run. List/detail không trả record đã deletedAt.

## 5. Experiments và cấu hình thuật toán

### 5.1 Dữ liệu nhận và lưu

```ts
type AlgorithmType =
  'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'error';
interface Algorithm {
  type: AlgorithmType;
  version?: string;
  config: Record<string, unknown>;
}
interface SyntheticConfig {
  kind: 'curved';
  version?: 1;
  sampleCount: number;
  featureCount: number;
  noise: number;
  seed: number;
  trainRatio: number;
}
interface Metric {
  mse: number;
  rmse: number;
  mae: number;
  r2: number | null;
}
interface Snapshot {
  clientCreatedAt?: number;
  learningRate?: number;
  maxIterations?: number;
  degree?: number;
  lambda?: number;
  dataSource?: 'synthetic' | 'csv';
  csvName?: string | null;
  sampleCount?: number;
  featureCount?: number;
  noise?: number;
  seed?: number;
  trainRatio?: number;
  iterations?: number;
  w?: number[];
  b?: number;
  train?: Metric;
  test?: Metric;
  csvData?: Record<string, unknown>;
  lastMutationId?: string;
}
interface CreateExperimentDto extends Snapshot {
  clientId?: string;
  name: string;
  description?: string;
  status?: ExperimentStatus;
  datasetId: string;
  algorithm: Algorithm;
  targetColumn: string;
  featureColumns: string[];
  synthetic?: SyntheticConfig;
  preprocessing?: {
    missingValues?: 'reject' | 'drop-rows' | 'mean-imputation';
    standardizeFeatures?: boolean;
  };
  split?: { testRatio?: number; seed?: number };
}
// UpdateExperimentDto: Snapshot và các field nghiệp vụ trên là tùy chọn,
// không đổi clientId/datasetId/ownerId. algorithm có thể partial theo DTO,
// nhưng nên gửi đầy đủ object vì server không deep-merge config.
```

POST yêu cầu dataset tồn tại/chưa xóa/có quyền; thiếu/sai/không có quyền dataset → 404.
Name tối đa 120, description tối đa 1000, targetColumn không rỗng, featureColumns ít nhất 1.
**Schema cho datasetId optional, create service vẫn yêu cầu.** Dùng bulk cho snapshot synthetic không có dataset.
Default: status=draft, algorithm.version=1.0.0, csvName=null, preprocessing reject/false,
split.testRatio=0.2 và seed=42; split.testRatio trong 0.05..0.5.

Synthetic khi gửi: kind=curved; version=1; sampleCount nguyên 2..1.000.000; featureCount nguyên 1..1000;
noise 0..50; seed safe integer; trainRatio 0.5..0.95. Backend **không sinh dữ liệu** từ cấu hình này.

### 5.2 Thuật toán

| algorithm.type | config mẫu                      | Kiểm tra trong create service                                    |
| -------------- | ------------------------------- | ---------------------------------------------------------------- |
| linear         | `{"solver":"gradient-descent"}` | solver là gradient-descent (default) hoặc ordinary-least-squares |
| polynomial     | `{"degree":2}`                  | degree nguyên 1..10                                              |
| ridge          | `{"lambda":0.1}`                | number, không NaN, >=0                                           |
| lasso          | `{"lambda":0.1}`                | như ridge                                                        |
| neural-network | `{"hiddenLayers":[16,8]}`       | mảng số nguyên dương                                             |

Config cần object. PATCH chỉ validateAlgorithm khi có cả type và config.
Create và bulk kiểm tra cấu hình thuật toán theo bảng. Với /sync/batch, dùng cấu trúc algorithm dạng object.
Top-level degree/lambda và giá trị trong algorithm.config lưu riêng; giữ chúng nhất quán.
Không tự suy ra schema có neural-network nghĩa là backend đã có hàm huấn luyện mạng.

### 5.3 Response, PATCH, DELETE

Experiment response có các field được lưu trên, `_id`, clientId, ownerId, syncVersion, timestamps, deletedAt?, __v?.
POST/create trả datasetId là ObjectId string. **GET list/detail populate datasetId thành Dataset object hoặc null**.
Sync/changes trả raw document, reference là string. Client cần chấp nhận `string | Dataset | null`.

PATCH nhận Snapshot, name/description/status/algorithm/targetColumn/featureColumns/preprocessing/split/synthetic;
datasetId bị bỏ qua. Object.assign không deep merge cấu hình lồng nhau. PATCH tăng syncVersion,
nhưng không so expected version; cần conflict thì dùng sync cho experiment.
DELETE soft-delete, tăng syncVersion, trả `{"success":true,"message":"Đã xóa thí nghiệm thành công."}`;
không cascade training run. Danh sách loại bản đã xóa. Đọc bản ghi đánh dấu xóa qua `/sync/changes`.

### 5.4 POST /experiments/bulk

Body là mảng trực tiếp, tối đa 100 mục và 10 MiB mỗi request. Mỗi mục có `id` (alias `clientId`) duy nhất trong lô. Mảng rỗng trả `200` với `items: []`. Thí nghiệm mới cần tên và thuật toán. Ví dụ tạo thí nghiệm tổng hợp ở trạng thái nháp.

```json
[
  {
    "id": "exp-client-1",
    "name": "Linear đã chạy",
    "algorithm": "linear",
    "lastMutationId": "save-1",
    "expectedVersion": 0
  }
]
```

`expectedVersion` bằng 0 khi tạo, hoặc bằng phiên bản cuối client đã đọc hoặc nhận. Dùng cùng `lastMutationId` khi thử lại và tạo mã mới cho nội dung mới. Server kiểm tra quyền, xác nhận lại thao tác đã ghi nếu nó vẫn là phiên bản hiện tại, và kiểm tra phiên bản ngay trong phép ghi MongoDB. Client cũ chỉ gửi `id` và dữ liệu vẫn dùng chế độ tương thích không kiểm tra phiên bản. Dùng luồng có phiên bản cho tích hợp mới.

```json
{
  "success": true,
  "count": 1,
  "items": [{ "id": "exp-client-1", "syncVersion": 1 }]
}
```

Khi có xung đột, API trả `409`. Ví dụ một thí nghiệm đã được ghi, một thí nghiệm đã có phiên bản mới hơn.

```json
{
  "success": false,
  "count": 1,
  "items": [{ "id": "exp-client-2", "syncVersion": 1 }],
  "conflicts": [{ "id": "exp-client-1", "syncVersion": 3 }],
  "errors": [],
  "message": "Có thí nghiệm đã thay đổi trên máy chủ."
}
```

- `items` chỉ gồm mục đã được xác nhận, kể cả khi trả mã lỗi. `syncVersion: null` trong `conflicts` nghĩa là máy chủ không trả được phiên bản hiện tại cho mục đó.
- Lỗi đầu vào phát hiện trước khi ghi trả `400`. Lỗi kiểm tra khi ghi có thể trả `400` kèm `items` và `errors`. Gián đoạn cơ sở dữ liệu trả `500` kèm những mục đã xác nhận trước lúc lỗi.
- FE giữ các mục chưa xác nhận trong IndexedDB. Với xung đột, FE đọc chi tiết bản máy chủ và cho người dùng chọn dùng bản đó hoặc giữ bản cục bộ thành bản sao. Việc thử lại bắt đầu khi người dùng bấm Đồng bộ.
- `/experiments/bulk` phục vụ đồng bộ thí nghiệm từ FE. `/sync/batch` nhận các thao tác tạo, cập nhật và xóa trên nhiều loại tài nguyên theo cấu trúc riêng ở mục 7.

### 5.5 csvData và việc phục hồi

CsvData là Mixed object. Quy ước client nên dùng:

```ts
interface CsvSnapshot {
  trainX: number[][];
  trainY: number[];
  testX: number[][];
  testY: number[];
  trainIndices?: number[];
  provenance?: {
    labels: string[];
    target: string;
    standardized: boolean;
    rows: { sourceRow: number; original: string[]; filled: number[] }[];
    stats: { mean: number; sd: number }[];
  };
}
```

Đây là hình dạng từ helper có sẵn, **không phải validation bắt buộc runtime**.
`experiments/saved-snapshot.ts::snapshotFields` có kiểm tra chi tiết/giới hạn 8 MiB nhưng
**không được gọi bởi API hiện tại**. Giới hạn JSON runtime là **10 MiB mỗi request**, gồm cả wrapper/batch.
Khi đăng nhập lại, GET /experiments trả lại w/b/iterations/train/test/csvData đã lưu của đúng owner.

## 6. Training runs

```ts
interface CreateTrainingRunDto {
  clientId?: string;
  experimentId: string; // bắt buộc, _id hoặc clientId; check owner/chưa xóa
  algorithmType: 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
  configSnapshot: Record<string, unknown>;
  algorithmVersion?: string; // POST default '1.0.0'
  status?:
    'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'; // default queued
  datasetSha256?: string; // 64 hex chars
  seed?: number; // default 42
  metrics?: { mse?: number; rmse?: number; mae?: number; r2?: number };
  modelParameters?: Record<string, unknown>;
  history?: {
    step: number;
    loss: number;
    parameters: Record<string, unknown>;
    recordedAt?: string;
  }[];
  error?: { code?: string; message?: string };
  startedAt?: string;
  completedAt?: string;
}
```

History step>=0; loss/parameters bắt buộc nếu có history point, recordedAt default hiện tại.
Response thêm `_id`, clientId, ownerId, syncVersion=1, timestamps, deletedAt?, __v?; history default [].
POST/list trả experimentId string; GET /training-runs/:id populate experimentId thành Experiment hoặc null,
không populate lồng datasetId.

POST tạo mới, không upsert; dùng clientId khác cho mỗi lần chạy mới.
List không có experimentId trả mọi run được phép; có thì resolve cả Mongo ID/clientId,
không có/không quyền → 404, không trả nhầm mọi run.
Không có PATCH/DELETE trực tiếp, dùng sync nếu cần. Status running/queued chỉ là lưu trạng thái,
không khởi động worker/job hay stream tiến độ. Lưu experiment cũng không tự tạo training run.

## 7. Sync offline

### 7.1 POST /sync/batch

```ts
interface SyncOperationItemDto {
  operationId: string;
  idempotencyKey: string;
  entityType: 'experiment' | 'dataset' | 'trainingRun';
  entityClientId: string;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>; // {} cho delete
  clientVersion: number; // integer; nên lấy version đã đọc, 0 cho mới
  clientUpdatedAt?: string; // hiện không được dùng
}
interface SyncBatchRequestDto {
  operations: SyncOperationItemDto[];
}
interface SyncOperationResultDto {
  operationId: string;
  idempotencyKey: string;
  entityType: 'experiment' | 'dataset' | 'trainingRun';
  entityClientId: string;
  status: 'applied' | 'conflict' | 'duplicate' | 'error';
  serverVersion?: number;
  conflict?: {
    reason: string;
    serverVersion: number;
    serverData: Record<string, unknown>;
  };
  error?: string;
}
interface SyncBatchResponseDto {
  success: boolean;
  syncedAt: string;
  results: SyncOperationResultDto[];
}
```

Ví dụ request/response:

```json
{
  "operations": [
    {
      "operationId": "op-1",
      "idempotencyKey": "mutation-uuid-1",
      "entityType": "experiment",
      "entityClientId": "offline-exp-1",
      "action": "create",
      "clientVersion": 0,
      "payload": {
        "name": "Offline Linear",
        "algorithm": { "type": "linear", "config": {} },
        "dataSource": "synthetic",
        "iterations": 10,
        "w": [2],
        "b": 1
      }
    }
  ]
}
```

```json
{
  "success": true,
  "syncedAt": "2026-11-08T00:00:00.000Z",
  "results": [
    {
      "operationId": "op-1",
      "idempotencyKey": "mutation-uuid-1",
      "entityType": "experiment",
      "entityClientId": "offline-exp-1",
      "status": "applied",
      "serverVersion": 1
    }
  ]
}
```

- Payload cho phép cùng nhóm field Dataset, Experiment/Snapshot, TrainingRun mô tả ở trên.
- ClientId lấy entityClientId; ownerId lấy session; không cho payload gán _id/ownerId/timestamps/deletedAt/syncVersion/storage.
- Algorithm experiment phải là **object**; sync không chuyển string như bulk.
- Tạo trainingRun qua sync cần tự gửi algorithmVersion (schema required, sync không thêm default như POST /training-runs).
- DatasetId/experimentId nếu có sẽ resolve và kiểm tra quyền; synthetic được kiểm tra.
- **HTTP 201 không có nghĩa toàn bộ thành công.** Đọc success và từng results[].status.
- Batch tuần tự, không atomic. Operation sai hình dạng có thể trả HTTP 400 sau khi các operation trước đã ghi.
- Quyền/không có dữ liệu trong operation thường trả status=error với `Không tìm thấy dữ liệu`, không HTTP 404 cả batch.
- Lỗi khác trong operation trả `Dữ liệu đồng bộ không hợp lệ`; không lộ snapshot của người khác.

### 7.2 Khác biệt giữa entity

| Entity      | create khi đã tồn tại                                                                        | update khi chưa có    | update khi đã có                                                    | delete                                            |
| ----------- | -------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| experiment  | conflict nếu serverVersion>clientVersion; nếu không vẫn thử create, có thể lỗi duplicate key | tạo từ payload đầy đủ | conflict nếu serverVersion>clientVersion; còn lại ghi, tăng version | soft-delete, tăng version, không so clientVersion |
| dataset     | duplicate                                                                                    | tạo từ payload đầy đủ | kiểm tra conflict như experiment                                    | soft-delete, tăng version, không so clientVersion |
| trainingRun | duplicate                                                                                    | error                 | ghi, tăng version, **không kiểm tra conflict version**              | soft-delete, tăng version, không so clientVersion |

Bản ghi đã deletedAt bị từ chối trước các nhánh, không dùng sync để restore.
Delete bản ghi chưa tồn tại trả applied, có thể không có serverVersion.

Idempotency:

- DB lưu SHA-256([userId,idempotencyKey]); response giữ key client.
- Key có log → duplicate trước khi xử lý payload, **kể cả log trước là conflict**.
- Retry do mất response mạng dùng lại key cũ. Sau khi giải quyết conflict/tạo mutation mới phải dùng key mới.
- Không dùng lại key cho entity/action/payload khác. Không ép clientVersion rất lớn để lách conflict.
- Lỗi giữa ghi dữ liệu và ghi log không được transaction bảo vệ; không bảo đảm exactly-once tuyệt đối.
- lastMutationId trong experiment chỉ là field lưu, không thay cho idempotencyKey.

### 7.3 GET /sync/changes

Since optional, nên là ISO UTC. Thiếu lấy epoch 1970; ngày không hợp lệ 400.
Query updatedAt>=since, lọc owner (admin tất cả), **bao gồm deletedAt**, không pagination, không populate.

```ts
interface Changes {
  serverTime: string;
  since: string;
  changes: {
    experiments: Experiment[];
    datasets: Dataset[];
    trainingRuns: TrainingRun[];
  };
}
```

Merge theo clientId/_id, xóa bản sao local nếu có deletedAt; không hiển thị tombstone như record bình thường.
Query không atomic giữa collections; polling nên dùng cửa sổ thời gian chồng lấn và khử trùng,
không coi serverTime là cursor tuyệt đối tránh mọi cập nhật đồng thời.

## 8. Ví dụ tích hợp hoàn chỉnh

### 8.1 Fetch wrapper dành cho browser

```js
const API = 'http://localhost:3000/api/v1';
async function api(path, { method = 'GET', body, binary = false } = {}) {
  const headers = {};
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart)
    headers['Content-Type'] = 'application/json';
  const response = await fetch(API + path, {
    method,
    credentials: 'include',
    headers,
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    if (response.status === 401) {
      // App: dừng sync queue, xóa trạng thái user và chuyển /login.
    }
    throw Object.assign(new Error(JSON.stringify(error.message)), {
      status: response.status,
      body: error,
    });
  }
  if (binary) return response.blob();
  return response.headers.get('content-type')?.includes('application/json')
    ? response.json()
    : response.text();
}
```

Node fetch không tự có cookie jar như browser. Client Node cần cookie jar hoặc tự quản lý Cookie/Set-Cookie.

### 8.2 Register → login → upload → lưu experiment/run → đọc lại

```js
// Register chỉ một lần; bỏ qua dòng này nếu email đã có.
await api('/auth/register', {
  method: 'POST',
  body: {
    email: 'linh@example.com',
    password: 'example-password-123',
    displayName: 'Linh',
  },
});
const user = await api('/auth/login', {
  method: 'POST',
  body: {
    email: 'linh@example.com',
    password: 'example-password-123',
  },
});
const form = new FormData();
form.append(
  'file',
  new File(['x,y\n1,3\n2,5\n3,7\n'], 'sample.csv', { type: 'text/csv' }),
);
form.append('name', 'CSV lần 1');
const dataset = await api('/datasets/upload', { method: 'POST', body: form });
const experiment = await api('/experiments', {
  method: 'POST',
  body: {
    name: 'Linear lần 1',
    datasetId: dataset._id,
    algorithm: { type: 'linear', config: { solver: 'gradient-descent' } },
    targetColumn: 'y',
    featureColumns: ['x'],
    dataSource: 'csv',
    csvName: 'sample.csv',
  },
});
// Client tự tính. Các số dưới chỉ minh họa kết quả client cung cấp.
await api('/experiments/' + experiment._id, {
  method: 'PATCH',
  body: {
    status: 'completed',
    iterations: 50,
    w: [2],
    b: 1,
    train: { mse: 0, rmse: 0, mae: 0, r2: 1 },
    test: { mse: 0, rmse: 0, mae: 0, r2: 1 },
  },
});
await api('/training-runs', {
  method: 'POST',
  body: {
    experimentId: experiment._id,
    algorithmType: 'linear',
    status: 'completed',
    configSnapshot: { learningRate: 0.01, maxIterations: 1000 },
    modelParameters: { w: [2], b: 1 },
    metrics: { mse: 0, rmse: 0, mae: 0, r2: 1 },
    history: [{ step: 50, loss: 0, parameters: { w: [2], b: 1 } }],
  },
});
const saved = await api('/experiments?page=1&limit=20');
const runs = await api(
  '/training-runs?experimentId=' + encodeURIComponent(experiment.clientId),
);
const csvBlob = await api('/datasets/' + dataset._id + '/download', {
  binary: true,
});
await api('/auth/logout', { method: 'POST' });
// Login lại cùng tài khoản rồi GET /experiments sẽ nhận lại bản lưu của user._id.
```

### 8.3 Khởi động app và quản trị

- Startup gọi /auth/me: 401 chuyển login, 200 dùng User._id chọn cache offline.
- Sau login GET /experiments, phân trang theo totalPages; mở experiment GET /training-runs?experimentId=...
- Admin list `/users?page=1&limit=20&search=linh`.
- Sửa tên mình: PATCH /users/me body `{"displayName":"Linh mới"}`.
- Đổi password: PATCH /users/me/password body `{currentPassword,newPassword}`.
- Khóa/mở khóa: PATCH /users/:id body `{"status":"disabled"}` hoặc `{"status":"active"}`.
- Phân quyền: PATCH /users/:id body `{"role":"admin"}` hoặc `{"role":"user"}`.
- Xóa mình DELETE /users/me **có JSON body** `{password}`; admin xóa DELETE /users/:id không body.
- Angular interceptor chỉ thêm credentials/header cho API của app, không cho domain khác; download dùng responseType='blob'.

## 9. Lỗi và giới hạn hiện tại

| HTTP | Ý nghĩa / nơi thường gặp                                                         |
| ---- | -------------------------------------------------------------------------------- |
| 400  | DTO auth/users sai; CSV/config/synthetic/since sai; bảo vệ admin cuối            |
| 401  | Chưa login, cookie sai/hết hạn, password sai, user disabled/deleted/version lệch |
| 403  | Origin/header CSRF sai hoặc thiếu role admin                                     |
| 404  | Resource không có/đã xóa/không thuộc user, file không có, reference không hợp lệ |
| 409  | Email trùng khi register                                                         |
| 413  | Upload vượt MAX_DATASET_FILE_SIZE hoặc JSON vượt 10 MiB                          |
| 429  | Login/register vượt 5 request/phút/IP/endpoint                                   |
| 500  | DB/filesystem lỗi hoặc input cũ chạm lỗi chưa được ánh xạ HttpException          |

Lỗi Nest thường `{statusCode,message,error?}`, message string hoặc array; middleware CSRF/CORS chỉ statusCode/message.

```json
{ "statusCode": 401, "message": "Vui lòng đăng nhập", "error": "Unauthorized" }
```

DTO dataset/experiment/run/sync chưa validate đầy đủ như auth/users. Mongoose validation, duplicate clientId,
thiếu algorithm... có thể trả **500**, không được đảm bảo 400/409. Client phải kiểm tra dữ liệu;
không retry vô hạn lỗi 4xx/schema. Sync HTTP thành công vẫn cần kiểm tra results.

- Không có endpoint restore, export audit, đổi email, tải csvData thành file; download chỉ lấy file gốc dataset.
- Dataset/experiment delete không cascade con; user delete mới soft-delete toàn bộ dữ liệu owner.
- DELETE dataset trực tiếp chưa tăng syncVersion, vẫn cập nhật updatedAt/deletedAt; đừng chỉ dựa version để nhận tombstone.
- Lưu history/snapshot là hành động client phải gọi; server không tự thu số liệu đang chạy ở frontend.
- Dữ liệu từng bị bỏ trước khi ghi DB không tự phục hồi; anonymous không tự thuộc user mới.
- Bcrypt không tự đọc/chuyển hash Argon2/scrypt cũ. Không tự sửa tài khoản DB để đoán migration.

## 10. Collections và hàm nội bộ

### 10.1 Collection backend chính

| Collection     | Nội dung                                                                                                                                                | Quan hệ/chỉ mục                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| users          | email, passwordHash(select:false), displayName, role, status, sessionVersion, timestamps                                                                | email unique; publicUser lấy field công khai                       |
| sessions       | session ID/data/expiry do connect-mongo quản lý                                                                                                         | TTL; dữ liệu nghiệp vụ userId/sessionVersion và cookie metadata    |
| datasets       | metadata, columns, previewRows, storage, ownerId, syncVersion, deletedAt                                                                                | clientId unique; ownerId/updatedAt                                 |
| experiments    | cấu hình và snapshot đã nêu                                                                                                                             | clientId unique; datasetId ref Dataset; ownerId/updatedAt          |
| trainingRuns   | configSnapshot, metrics, modelParameters, history, error                                                                                                | clientId unique; experimentId ref Experiment; ownerId/createdAt    |
| syncOperations | operationId, key hash, entityType, entityClientId, action, clientVersion/serverVersion, status, conflictReason, serverDataSnapshot, ownerId, timestamps | idempotencyKey unique; ownerId/createdAt; entityClientId/createdAt |
| auditLogs      | userId, action, targetId, ip, at                                                                                                                        | không password/hash/session token, không HTTP endpoint đọc         |

Audit action: register, login.success, login.failure, logout, password.change,
user.role.change, user.status.change, account.delete. Login email không có thì userId có thể null.
SyncOperation schema có enum rejected nhưng luồng response hiện tại dùng applied/conflict/duplicate/error.

### 10.2 Hàm nội bộ, không gọi trực tiếp qua HTTP

Hàm controller và service public cho endpoint đã liệt kê trong bảng 31 route. Helper bổ sung:

| File/class                                 | Hàm                                                                               | Vai trò                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| src/main.ts                                | bootstrap                                                                         | NestFactory.create, configureApp, listen                  |
| common/configure-app.ts                    | configureApp(app)                                                                 | prefix/proxy/CORS/CSRF/session/JSON parser                |
| common/database.config.ts                  | mongoUri(config)                                                                  | resolve URI, chặn DB sai ở test                           |
| common/session.config.ts                   | cookieOptions, createSessionStore, sessionMiddleware, saveSession, destroySession | cấu hình/vòng đời session; đổi store ở createSessionStore |
| common/auth.guard.ts                       | AuthGuard.canActivate, Public, CurrentUser                                        | public metadata, xác thực request, lấy RequestUser        |
| common/roles.guard.ts                      | Roles, RolesGuard.canActivate                                                     | role guard phía server                                    |
| common/ownership.ts                        | ownerFilter, idFilter, assertOwner, dataFields                                    | quyền, định danh, trường được ghi                         |
| common/csv-validator.ts                    | CsvValidator.validate, parseCsvLines, private inferType                           | CSV parser, thống kê, SHA-256, preview                    |
| datasets/upload.config.ts                  | datasetFileSize, assertCsvFile, datasetUploadOptions                              | cấu hình size, extension/MIME, Multer                     |
| DatasetsService                            | private ensureStorageDirectory                                                    | tạo thư mục upload                                        |
| LoginService                               | onModuleInit                                                                      | user index, dummy bcrypt hash, seed admin                 |
| login/auth.dto.ts                          | IgnoreRegistrationPrivileges.transform                                            | bỏ role/ownerId riêng register                            |
| login/user.schema.ts                       | publicUser                                                                        | response projection user                                  |
| AuditService                               | record(action,userId,targetId,ip)                                                 | ghi audit cố định field                                   |
| ExperimentsService                         | private validateAlgorithm                                                         | validation ở create/PATCH                                 |
| experiments/synthetic-config.validation.ts | validateSyntheticConfig, SYNTHETIC_KINDS                                          | validation synthetic; kind curved                         |
| experiments/saved-snapshot.ts              | snapshotFields                                                                    | helper có sẵn nhưng **không được API gọi**                |
| UsersService                               | verifyPassword, private serializeMutation, private protectLastAdmin               | password xác nhận, tuần tự hóa mutation, admin cuối       |
| SyncService                                | private syncExperiment, syncDataset, syncTrainingRun, validateReferences          | các nhánh entity và resolve reference                     |

RequestUser nội bộ `{userId,role,account}` (account là UserDocument), không phải body client.
SchemaFactory.createForClass ở các file schema tạo model DB, không tạo endpoint.
Các module còn có wiring DI, import/export MongooseModule; không có API HTTP ngầm ngoài bảng.

## 11. Cấu hình, lệnh chạy, migration và code cũ

### 11.1 Môi trường

| Biến                       | Mặc định/quy tắc                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| PORT                       | 3000                                                                             |
| MONGODB_URI                | ưu tiên hơn connection_string, cần URI MongoDB                                   |
| connection_string          | fallback URI                                                                     |
| NODE_ENV                   | test: MemoryStore/bỏ .env; production: Secure và secret bắt buộc                 |
| SESSION_SECRET             | production >=32 ký tự; dev thiếu sinh ngẫu nhiên, restart mất hiệu lực cookie cũ |
| ADMIN_EMAIL/ADMIN_PASSWORD | seed admin đầu tiên khi chưa có admin nào, không overwrite email user có sẵn     |
| CORS_ORIGINS               | comma-separated; default http://localhost:4200,http://localhost:5173; cấm '*'    |
| COOKIE_SECURE              | 'true' ép Secure, production luôn Secure                                         |
| TRUST_PROXY                | chỉ 'true' mới set trust proxy 1                                                 |
| MAX_DATASET_FILE_SIZE      | 10485760 byte, số nguyên dương; cấu hình sai báo lỗi startup                     |
| DATASET_STORAGE_DIR        | ./data/uploads, resolve theo working directory                                   |

Admin seed kiểm tra password.length>=8 và UTF-8<=72 byte; email trùng user cũ làm startup lỗi,
không nâng quyền user đó. Admin đã tồn tại thì env không reset password.
Không copy .env thật vào tài liệu, không commit secret; mẫu cấu hình ở .env.example.

### 11.2 Lệnh

```sh
npm install
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm test
npm run test:e2e
```

Build Nest; unit Vitest; e2e Supertest + MongoMemoryServer tạo riêng hoi-quy-3d-test, MemoryStore,
không dùng DB dev. Lần đầu có thể phải tải binary MongoDB. Không chạy cleanup trên DB dev.
Package còn có start/start:debug/format/test:watch/test:cov/test:debug/docker:up/docker:down/deploy.
Build:web/build:all tham chiếu FE/FE-hoiquy3d; thư mục này không có trong workspace lúc rà soát,
không khẳng định build frontend chạy được.

### 11.3 Migration anonymous, chỉ chạy tay

```sh
npm run migrate-anonymous -- admin@example.com
npm run migrate-anonymous -- admin@example.com --apply
```

`scripts/migrate-anonymous.mjs` đọc .env qua Node CLI, URI ưu tiên như backend.
Không --apply: chỉ đếm. Có --apply: chuyển ownerId='anonymous_user' trong datasets/experiments/trainingRuns
sang admin active theo email; tăng syncVersion và updatedAt. Không chuyển hash/account, không gán record thiếu ownerId,
không tự chạy startup. Chủ động xác nhận đúng DB trước khi chạy.

### 11.4 Code tồn tại nhưng không phải API chính

- src/auth: AuthController.session/guest/register/login/logout; AuthService.register/login/guest/resolve/issue/logout;
  passwordKey/hashToken và SessionMiddleware.use thuộc hệ auth cũ, không đăng ký.
- database/backend: package Mongoose 8/TypeScript 5 starter với Dataset/Experiment/TrainingRun/Lesson,
  config kết nối DB và check-database. Không controller/HTTP server. Scripts riêng build/db:check/db:check:dev.
  Không lấy schema cũ ở đây làm contract của API src đang chạy.
- Docker/deploy là vận hành, không tự tạo route ứng dụng.

## 12. Phạm vi kiểm chứng

Đã đọc AppModule, controller App/Login/Users/Datasets/Experiments/TrainingRuns/Sync,
DTO/schema/service, auth/role guard, middleware/session/upload/CSV helper, package scripts và database/backend.
Bảng loại AuthModule không import; có **31 method+path**, không đếm OPTIONS tự động.

Đây là tác vụ tài liệu; không sửa logic backend/DB. Lượt sửa backend trước đã chạy build/lint,
33 unit test và 20 e2e test qua. Không coi đó là lần test mới của tài liệu.
Handbook được đối chiếu route và JSON ví dụ bằng script; tên hàm HTTP khớp controller source.
