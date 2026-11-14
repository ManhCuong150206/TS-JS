# API Handbook — Hồi quy 3D

> Đối chiếu source ngày 14/11/2026. Nội dung dùng cho tiểu luận: [Báo cáo API](BAO-CAO-API-TIEU-LUAN.md). Kết quả kiểm tra: [Ghi chú kiểm chứng](KIEM-CHUNG-BAO-CAO-API.md).

## 1. Kết nối và xác thực

- Backend trực tiếp: `http://localhost:3000/api/v1`. Path bên dưới viết sau tiền tố này.
- Browser gửi `credentials: 'include'`. Body JSON gửi `Content-Type: application/json`.
- POST/PATCH/PUT/DELETE cần `X-Requested-With: XMLHttpRequest`, gồm login/register/upload.
- Multipart dùng trường `file`; trình duyệt tự đặt Content-Type/boundary. Download đọc Blob, không đọc JSON.
- Cookie `hq3d.sid`, HttpOnly, SameSite=Lax, maxAge 7 ngày, Secure trong production hoặc COOKIE_SECURE=true. Session lưu collection `sessions`; test dùng MemoryStore.
- CORS mặc định cho localhost:4200 và localhost:5173; Origin ngoài allowlist trả 403.
- Public: GET `/`, GET `/health`, POST `/auth/register`, POST `/auth/login`. Route khác cần user active và phiên hợp lệ.
- ownerId lấy từ session. `x-user-id` hay Bearer userId không cấp quyền. User chỉ truy cập dữ liệu mình; admin bỏ lọc owner trên API tài nguyên tương ứng.
- Không có route quản trị danh sách/sửa quyền/xóa user khác. Mã `src/auth` và guard role không dùng đã được xóa. `database/backend` không phải REST server.
- Không có API train/predict/start/stop; huấn luyện hiện chạy trong Web Worker ở trình duyệt.

## 2. Toàn bộ 27 endpoint đang đăng ký

| HTTP | Path | Đầu vào chính | Thành công |
| --- | --- | --- | --- |
| GET | `/` | — | 200 text |
| GET | `/health` | — | 200 status, service, version, timestamp |
| POST | `/auth/register` | email, password, displayName | 201 public user, chưa đăng nhập |
| POST | `/auth/login` | email, password | 200 public user + cookie |
| POST | `/auth/logout` | Cookie | 200 success=true |
| GET | `/auth/me` | Cookie | 200 public user |
| GET | `/users/me` | Cookie | 200 public user |
| POST | `/users/me` | displayName | 200 public user |
| POST | `/users/me/password` | currentPassword, newPassword | 200 public user |
| DELETE | `/users/me` | password | 200 success=true |
| POST | `/datasets/upload` | Multipart: file, name tùy chọn | 201 dataset |
| POST | `/datasets` | name, sourceType, metadata | 201 dataset |
| GET | `/datasets` | page, limit | 200 Page |
| GET | `/datasets/:id` | _id/clientId | 200 dataset |
| GET | `/datasets/:id/download` | _id/clientId | 200 tệp đính kèm |
| DELETE | `/datasets/:id` | _id/clientId | 200 success, message |
| POST | `/experiments` | datasetId, name, algorithm, targetColumn, featureColumns | 201 experiment |
| POST | `/experiments/bulk` | Mảng tối đa 100 mục | 200 success, count, items |
| GET | `/experiments` | page, limit | 200 Page |
| GET | `/experiments/:id` | _id/clientId | 200 experiment |
| PATCH | `/experiments/:id` | Trường cập nhật, không thay dataset | 200 experiment |
| DELETE | `/experiments/:id` | _id/clientId | 200 success, message |
| POST | `/training-runs` | experimentId, algorithmType, configSnapshot, kết quả | 201 trainingRun |
| GET | `/training-runs` | experimentId tùy chọn, page, limit | 200 Page |
| GET | `/training-runs/:id` | _id/clientId | 200 trainingRun |
| POST | `/sync/batch` | Đối tượng operations | 201 success, syncedAt, results |
| GET | `/sync/changes` | since tùy chọn | 200 serverTime, since, changes |

## 3. Hợp đồng dữ liệu

- Public user: _id, email, displayName, role, status, createdAt, updatedAt; không passwordHash/sessionVersion.
- Email trim/chữ thường; mật khẩu 8–72 ký tự và tối đa 72 byte UTF-8; displayName 1–120 ký tự sau trim.
- Đăng ký bỏ role/ownerId, tạo role user. Đăng ký không tạo phiên, phải login riêng. Login/register giới hạn 5 yêu cầu/60 giây theo throttler.
- Đổi mật khẩu giữ phiên hiện tại và vô hiệu hóa phiên cũ. Tự xóa tài khoản cần mật khẩu, xóa mềm ba nhóm tài nguyên rồi xóa user; chặn xóa admin active cuối cùng.
- Auth/users có ValidationPipe cục bộ; các nhóm khác chưa có DTO validation thống nhất toàn cục. Không giả định mọi input sai đều trả 400.
- Page: `{items,total,page,limit,totalPages}`. Mặc định 1/20, limit tối đa 100, số nguyên dương; total=0 thì totalPages=0.
- Dataset/run sort createdAt giảm dần; experiment sort updatedAt giảm dần. Experiment có thể populate datasetId; chi tiết run có thể populate experimentId.
- clientId duy nhất theo collection; bulk id là alias clientId. Route tài nguyên nhận _id/clientId. Date trả ISO string, clientCreatedAt là số phía client.
- Dataset sourceType: upload/sample/generated. Tạo metadata không tạo tệp vật lý. Upload mặc định 10 MiB, cấu hình MAX_DATASET_FILE_SIZE; thư mục DATASET_STORAGE_DIR, mặc định data/uploads. MongoDB giữ metadata.
- Algorithm: linear solver ordinary-least-squares/gradient-descent; polynomial degree nguyên 1–10; ridge/lasso lambda hữu hạn không âm; neural-network hiddenLayers là mảng số nguyên dương. Frontend hiện có bốn thuật toán hồi quy, chưa có UI neural-network.
- Create experiment đơn cần dataset hợp lệ, targetColumn không rỗng, featureColumns không rỗng. Bulk cho phép không có dataset riêng.
- Synthetic: kind linear/curved/correlated/sparse, version 1; sampleCount nguyên 2–1.000.000; featureCount nguyên 1–1.000; noise 0–50; seed số nguyên an toàn; trainRatio 0,5–0,95.
- Snapshot có thể có w, b, train/test, csvData. Kết quả do client tính, backend chưa tính lại để xác minh metrics.

## 4. Bulk: luồng frontend hiện tại

ExperimentsStore lưu IndexedDB trước. Khi người dùng bấm đồng bộ, FE gọi POST `/experiments/bulk`; không tự đồng bộ khi mạng vừa trở lại. Luồng FE này yêu cầu đăng nhập để lưu lâu dài.

- Mỗi bản lưu FE tối đa 8 MiB; lô tối đa 100 mục và body 10 MiB.
- Body là mảng, mỗi mục có id/clientId, name, algorithm, cấu hình/kết quả, expectedVersion, lastMutationId.
- expectedVersion=0 để tạo mới; cập nhật dùng phiên bản server đã xác nhận. expectedVersion cần đi cùng lastMutationId hợp lệ.
- Server đối chiếu phiên bản trong cùng thao tác DB trên từng bản ghi. Retry cùng mutationId/expectedVersion được nhận diện nếu bản ghi vẫn ở phiên bản vừa áp dụng.
- Thành công: `{success:true,count,items:[{id,syncVersion}]}`.
- Xung đột: HTTP 409, `{success:false,count,items,conflicts:[{id,syncVersion}],errors,message}`. Phải giữ xác nhận items kể cả khi HTTP không phải 2xx.
- Validation lỗi từng mục khi ghi có thể trả 400, lỗi máy chủ khi ghi có thể trả 500 kèm kết quả từng phần; lỗi trước ghi có thể dùng cấu trúc Nest thông thường.
- GET `/experiments/:id` lấy bản server khi xung đột. FE cho phép nhận bản server hoặc giữ local thành bản sao.
- FE hiện chỉ đánh dấu xóa local, sync bỏ qua mục deletedAt; chưa gửi thao tác xóa lên server.

## 5. Sync tổng quát: API riêng ở backend

Frontend hiện không dùng nhóm này cho luồng lưu experiment.

- POST `/sync/batch` nhận `{operations:[...]}`; mỗi op có operationId, idempotencyKey, entityType (experiment/dataset/trainingRun), entityClientId, action (create/update/delete), payload, clientVersion; clientUpdatedAt tùy chọn.
- results có status applied/duplicate/conflict/error. HTTP 201 không đồng nghĩa mọi mục thành công; đọc success/results.
- idempotencyKey được băm cùng userId trước khi ghi syncOperations. Khóa đã ghi trả duplicate khi gửi lại; thao tác sửa cần khóa mới.
- Không transaction toàn lô; kiểm tra phiên bản chưa đồng nhất giữa các loại dữ liệu. Update trainingRun và các nhánh delete chưa có đối chiếu phiên bản như update experiment/dataset.
- GET `/sync/changes?since=<ISO>` trả `{serverTime,since,changes:{experiments,datasets,trainingRuns}}`; bỏ since lấy từ epoch, ngày không hợp lệ trả 400. Lọc updatedAt >= since, gồm deletedAt; chưa phân trang và không phải event log đầy đủ.

## 6. Triển khai và giới hạn

- Nginx hiện chỉ chuyển tiếp POST auth/login, auth/register, auth/logout, sync/batch và GET auth/me, sync/changes. Các API khác dưới /api/v1/ trả 404 qua gateway.
- FE dùng experiments/bulk và experiments/:id, nên Nginx hiện lệch với luồng FE. Cần thống nhất trước nghiệm thu HTTPS; lần cập nhật này chỉ sửa tài liệu.
- Health không kiểm tra DB/storage. Xóa mềm dataset không xóa ngay tệp vật lý.
- Lỗi: 400 dữ liệu sai ở nhánh có kiểm tra; 401 phiên/credentials; 403 Origin/header; 404 ngoài phạm vi; 409 email trùng/phiên bản bulk; 413 dung lượng; 429 auth rate limit; 500 ngoại lệ máy chủ.
- Cấu trúc lỗi chưa thống nhất. Xem báo cáo tiểu luận để biết ví dụ request/response, sơ đồ, chức năng từng module và căn cứ nguồn.
- SPEC và README lịch sử có thể chưa theo kịp source. AppModule/controller đang nạp là căn cứ xác định route; không suy ra endpoint từ mã auth cũ hoặc model starter.
