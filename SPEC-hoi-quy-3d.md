# Đặc tả yêu cầu — Hệ thống thực nghiệm và trực quan hóa quá trình học của mô hình hồi quy

- **Trạng thái:** Tài liệu yêu cầu ban đầu, chưa triển khai mã nguồn
- **Đối tượng:** Nhóm 6 thành viên; đồ án học tập, tiểu luận và thuyết trình
- **Ngôn ngữ triển khai đề xuất:** TypeScript thống nhất ở frontend, backend và kiểm thử
- **Cổng truy cập dự kiến:** HTTPS trên cổng 443

## 1. Tóm tắt đề tài

Xây dựng một web app 3D cho phép người dùng nhập dữ liệu hoặc dùng dữ liệu mẫu/tạo dữ liệu tổng hợp, chọn một thuật toán hồi quy, cấu hình và chạy quá trình huấn luyện, rồi quan sát quá trình học qua từng bước. Hệ thống cần giải thích các tham số, dự đoán, sai số và chỉ số đánh giá theo cách trực quan, phục vụ thực nghiệm và trình bày học thuật.

Ứng dụng cần hỗ trợ một số thao tác thiết yếu khi mất mạng. Các thao tác và kết quả được tạo offline phải được lưu hàng đợi cục bộ và đồng bộ lên API/MongoDB khi có mạng. Dữ liệu và kết quả trên máy chủ phải được mô hình hóa bằng schema rõ ràng theo từng trường hợp/loại hồi quy.

## 2. Mục tiêu và tiêu chí thành công

1. Hỗ trợ nhiều loại hồi quy qua một quy trình sử dụng nhất quán.
2. Cho phép thực nghiệm lặp lại với dữ liệu, cấu hình, seed và phiên bản thuật toán được ghi nhận.
3. Giúp người học nhìn thấy dữ liệu, mô hình, dự đoán, sai số và diễn biến huấn luyện; có thể dừng, tiếp tục, chạy từng bước và phát lại.
4. Cho phép chuẩn bị dữ liệu, cấu hình, chạy và xem thực nghiệm cơ bản offline; đồng bộ thay đổi lên MongoDB khi kết nối được khôi phục.
5. Có API được mô tả, xác thực dữ liệu đầu vào và kiểm thử tự động ở nhiều mức.
6. Có thể khởi chạy hệ thống bằng Docker Compose; truy cập qua HTTPS cổng 443 trong môi trường trình diễn/triển khai.
7. Toàn bộ mã ứng dụng và kiểm thử dùng cùng một ngôn ngữ. Đề xuất chuyển sang TypeScript xuyên suốt frontend, backend và tester; chỉ chốt sau khi giảng viên xác nhận TypeScript được chấp nhận thay JavaScript. TypeScript biên dịch thành JavaScript nhưng mã nguồn TypeScript không phải JavaScript thuần.

## 3. Phạm vi

### Trong phạm vi

- Web app responsive có không gian trực quan hóa 3D.
- Nhập tệp dữ liệu có cấu trúc (CSV; có thể mở rộng JSON), xem trước, chọn cột mục tiêu/đặc trưng, kiểm tra và tiền xử lý cơ bản.
- Tạo dữ liệu tổng hợp để chạy thực nghiệm không cần tệp đầu vào; có chế độ sinh dữ liệu có nhiễu và seed để tái lập.
- Nhiều biến thể hồi quy, trước mắt đề xuất: tuyến tính đơn/đa biến, đa thức, Ridge và Lasso. Danh sách cuối cùng cần thống nhất theo phạm vi môn học và thời gian nhóm.
- Cấu hình thuật toán, chạy huấn luyện, theo dõi từng bước, dừng/tiếp tục/chạy từng bước, xem và lưu kết quả.
- Chế độ offline-first cho thao tác cốt lõi; hàng đợi đồng bộ có trạng thái và xử lý xung đột.
- API backend, MongoDB, Docker Compose, HTTPS/SSL cổng 443.
- Kiểm thử đơn vị, tích hợp API/DB, giao diện, offline/sync, bảo mật cơ bản và kiểm tra triển khai.
- Tài liệu kỹ thuật, hướng dẫn chạy, sơ đồ kiến trúc/API/schema, checklist nghiệm thu và nội dung hỗ trợ tiểu luận/thuyết trình.

### Ngoài phạm vi ở giai đoạn đầu

- Dùng chung dữ liệu cộng tác thời gian thực nhiều người.
- Hệ thống phân quyền nhiều cấp, thanh toán, mô hình hồi quy phi tuyến phức tạp hoặc AutoML.
- Đảm bảo kết quả giống hệt giữa mọi trình duyệt/phần cứng khi chạy GPU.
- Cung cấp chứng thư SSL công khai nếu chưa có tên miền/máy chủ; môi trường phát triển có thể dùng chứng thư tự ký.
- Use case diagram là tùy chọn, không phải đầu ra bắt buộc.

## 4. Người dùng và luồng sử dụng chính

Người dùng chính là sinh viên/giảng viên thực hiện hoặc quan sát thí nghiệm. Luồng tiêu chuẩn:

1. Tạo thí nghiệm mới hoặc mở bản nháp gần đây.
2. Chọn nhập CSV, dùng dữ liệu mẫu, hoặc tạo dữ liệu tổng hợp.
3. Xem trước dữ liệu; xác định biến mục tiêu và biến đặc trưng; xử lý giá trị thiếu/không hợp lệ theo lựa chọn.
4. Chọn loại hồi quy và cấu hình thuật toán.
5. Chạy toàn bộ hoặc từng bước; quan sát trực quan và các chỉ số.
6. Dừng/tiếp tục, thay đổi tốc độ phát lại, xem lại lịch sử bước học.
7. Lưu, đổi tên, sao chép cấu hình, so sánh hoặc xuất báo cáo/kết quả.
8. Nếu offline, lưu cục bộ và đồng bộ tự động/thủ công khi online.

## 5. Chức năng chi tiết

### F-01. Quản lý thí nghiệm

- Tạo, đổi tên, mở, sao chép, lưu và xóa thí nghiệm.
- Ghi trạng thái: bản nháp, đang chạy, đã hoàn tất, lỗi, chờ đồng bộ.
- Lưu thời gian tạo/cập nhật, nguồn dữ liệu, cấu hình, seed, phiên bản thuật toán và kết quả.
- Hiển thị trạng thái đồng bộ; không báo “đã lưu trên máy chủ” khi mới lưu cục bộ.

### F-02. Nạp và chuẩn bị dữ liệu

- Nhập CSV; hiển thị tên cột, kiểu suy đoán, số hàng, thống kê cơ bản và một phần dữ liệu.
- Chọn cột mục tiêu (y) và một hoặc nhiều đặc trưng (X); loại cột không dùng.
- Kiểm tra dữ liệu rỗng, giá trị không phải số, dòng trùng, số hàng quá lớn và cấu hình không hợp lệ.
- Cho phép chọn cách xử lý giá trị thiếu: loại dòng hoặc thay thế bằng quy tắc đơn giản; ghi lại lựa chọn.
- Chia tập train/test với tỷ lệ và seed được lưu; hỗ trợ chuẩn hóa khi thuật toán yêu cầu.
- Tệp dữ liệu lớn phải có giới hạn kích thước/hàng cấu hình được; thông báo rõ khi vượt giới hạn.
- Chế độ dữ liệu tổng hợp: chọn số đặc trưng, số mẫu, độ nhiễu, seed và quan hệ hồi quy để sinh dữ liệu.

### F-03. Chọn thuật toán và cấu hình

- Có mô tả ngắn, công thức/ý nghĩa tham số và yêu cầu dữ liệu của mỗi thuật toán.
- Cấu hình chung: learning rate nếu áp dụng, số epoch/iteration, tiêu chí dừng, seed, train/test split và metric.
- Cấu hình đặc thù được kiểm tra theo schema của từng loại thuật toán.
- Đề xuất danh mục ban đầu:
  - Linear Regression: nghiệm đóng hoặc gradient descent (cần ghi rõ lựa chọn).
  - Polynomial Regression: bậc đa thức và biến đổi đặc trưng.
  - Ridge: hệ số regularization λ.
  - Lasso: hệ số λ và phương thức tối ưu phù hợp.
- Mỗi thí nghiệm ghi phiên bản thuật toán/engine để kết quả có thể diễn giải và tái lập.

### F-04. Điều khiển huấn luyện

- Bắt đầu, tạm dừng, tiếp tục, dừng, chạy một bước và chạy lại từ đầu.
- Có thanh tiến độ, epoch/iteration hiện tại, trạng thái và lỗi dễ hiểu.
- Chọn tốc độ phát lại trực quan độc lập với tốc độ tính toán.
- Không làm treo giao diện khi tính toán; khối lượng lớn cần chạy trong Web Worker hoặc cơ chế nền tương ứng.
- Khi tải lại trang, khôi phục bản nháp/kết quả đã lưu cục bộ; việc khôi phục chính xác trạng thái giữa chừng phụ thuộc khả năng lưu checkpoint.

### F-05. Trực quan hóa 3D và giải thích

Ý tưởng trực quan hóa toàn bộ quá trình thuật toán là hợp lý và phù hợp đề tài, nhưng “toàn bộ” cần giới hạn thành các đại lượng cụ thể có thể quan sát và kiểm chứng. Đề xuất các lớp:

- **Không gian dữ liệu:** điểm mẫu, phân biệt train/test, màu sắc biểu thị residual hoặc lớp dữ liệu.
- **Mô hình:** đường hồi quy khi có một đặc trưng; mặt phẳng/hyperplane chỉ trực quan hóa được trực tiếp khi có tối đa hai đặc trưng. Với nhiều đặc trưng, dùng lát cắt/chiếu 2D-3D và ghi rõ phép chiếu.
- **Quá trình học:** đường đi của tham số qua các bước; với hai tham số có thể đặt lên mặt/đường contour của loss; hiển thị loss theo iteration.
- **Kết quả:** giá trị thật/dự đoán, residual, metric và so sánh train/test.
- **Điều khiển:** xoay, zoom, pan, chọn góc nhìn, bật/tắt lớp, phát/tạm dừng và reset camera.
- Có chế độ bảng/biểu đồ 2D thay thế khi thiết bị yếu hoặc hỗ trợ 3D hạn chế; khả năng truy cập không phụ thuộc riêng vào màu sắc.

### F-06. Kết quả, so sánh và xuất

- Hiển thị MSE/RMSE/MAE/R² phù hợp với bài toán và giải thích ngắn ý nghĩa.
- Xem hệ số, intercept, cấu hình, thời gian chạy và thông tin dữ liệu.
- So sánh các thí nghiệm cùng dữ liệu hoặc hiển thị cảnh báo khi cấu hình/dữ liệu khác nhau.
- Xuất kết quả dạng JSON/CSV và báo cáo tóm tắt; xuất hình/ảnh biểu đồ là chức năng ưu tiên sau.
- Kết quả cần chỉ rõ giới hạn dữ liệu, seed, tiền xử lý và phiên bản thuật toán.

### F-07. Offline và đồng bộ

**Thao tác cốt lõi được hỗ trợ offline:**

1. Tạo, đổi tên, mở, chỉnh sửa và xóa mềm bản nháp thí nghiệm.
2. Nhập và xem trước CSV cục bộ; dữ liệu được giữ trên thiết bị cho tới khi đồng bộ.
3. Chọn cột, tiền xử lý cơ bản, tạo dữ liệu tổng hợp.
4. Chọn thuật toán/cấu hình và chạy huấn luyện cục bộ.
5. Xem trực quan, metric, lưu kết quả và mở lại lịch sử đã lưu trên thiết bị.
6. Xuất dữ liệu/kết quả đã lưu cục bộ.

Cơ chế đề xuất: PWA + Service Worker để cache vỏ ứng dụng/tài nguyên; IndexedDB để lưu dataset, thí nghiệm, kết quả và outbox đồng bộ. Không lưu dữ liệu chỉ trong bộ nhớ phiên. Tác vụ huấn luyện chạy cục bộ bằng TypeScript đã biên dịch sang JavaScript; kết quả/metadata được đưa vào hàng đợi đồng bộ.

**Đồng bộ lên MongoDB:**

- Đồng bộ tự động khi online và có nút “Đồng bộ ngay”; hiển thị số mục đang chờ, thành công, lỗi.
- Mỗi bản ghi có UUID do client tạo, `clientUpdatedAt`, `serverUpdatedAt`, `syncStatus`, phiên bản bản ghi và idempotency key.
- API phải chống tạo bản ghi trùng khi gửi lại; ghi nhận lỗi có thể thử lại và lỗi cần người dùng xử lý.
- Quy tắc xung đột giai đoạn đầu: giữ cả hai phiên bản hoặc yêu cầu chọn phiên bản; không âm thầm ghi đè. Có thể dùng last-write-wins cho trường không quan trọng nếu được ghi rõ.
- Dữ liệu lớn: cân nhắc upload dataset riêng/chuẩn hóa sang collection; không nhồi tệp lớn vào một document MongoDB. Giới hạn và chính sách lưu trữ cần xác nhận.
- Cảnh báo rõ người dùng nếu xóa dữ liệu cục bộ trước khi đồng bộ hoặc nếu trình duyệt xóa dữ liệu website.

### F-08. API và trạng thái lỗi

- API REST phiên bản hóa, ví dụ `/api/v1`.
- Endpoint dự kiến: health, experiments CRUD, datasets CRUD/metadata, training runs, results, sync batch và export.
- Validate request/response theo schema; lỗi thống nhất gồm mã lỗi, thông điệp, trường lỗi và request id.
- Phân trang/lọc danh sách; giới hạn kích thước payload; timeout và retry có backoff cho lỗi mạng tạm thời.
- Swagger/OpenAPI hoặc tài liệu tương đương là đầu ra bắt buộc của nhóm.

## 6. Yêu cầu phi chức năng

- **Tính đúng:** công thức, metric, chia tập và seed được ghi nhận; có dữ liệu mẫu chuẩn đối chiếu.
- **Hiệu năng:** mục tiêu ban đầu đề xuất: thao tác giao diện phản hồi trong 200 ms với dữ liệu demo; khối lượng demo mặc định (ví dụ tối đa 10.000 hàng) không làm treo UI. Nhóm cần đo và điều chỉnh theo thiết bị trình diễn.
- **Tính sẵn sàng:** có thể tiếp tục thao tác cốt lõi khi mất mạng; trạng thái đồng bộ minh bạch.
- **Khả dụng:** hướng dẫn trực quan, thông báo lỗi có hướng xử lý, hỗ trợ màn hình phổ biến.
- **Bảo mật:** HTTPS, kiểm tra đầu vào, giới hạn upload, không ghi dữ liệu nhạy cảm vào log, secrets không commit vào repository, kiểm soát CORS và headers.
- **Khả năng bảo trì:** module tách lớp, schema/API có phiên bản, test chạy tự động, quy ước code và review.
- **Tái lập:** seed, cấu hình, thuật toán, phiên bản và dữ liệu đầu vào được ghi cùng thí nghiệm.

## 7. Công nghệ đề xuất

Chọn stack để giữ TypeScript nhất quán nếu giảng viên chấp thuận:

- **Frontend:** React + Vite (TypeScript), Three.js (3D), thư viện biểu đồ JS/TS, PWA/Service Worker, IndexedDB qua thư viện bọc phù hợp.
- **Backend:** Node.js + NestJS (TypeScript; phù hợp với bộ khung nhóm đang dùng) hoặc Express/Fastify có cấu hình TypeScript, REST API, validation schema.
- **Tính toán:** TypeScript chạy trong browser/Node.js sau khi biên dịch; cần benchmark và xác nhận thư viện hỗ trợ đúng các thuật toán trong phạm vi. Web Worker cho tính toán phía trình duyệt.
- **Cơ sở dữ liệu:** MongoDB; MongoDB schema/validator hoặc Mongoose cho schema ứng dụng.
- **Tester:** Vitest/Jest với TypeScript cho unit/integration; Playwright cho E2E; Supertest hoặc tương đương cho API.
- **Hạ tầng:** Docker, Docker Compose, reverse proxy (Nginx/Caddy/Traefik) kết thúc TLS trên cổng 443; môi trường demo có thể dùng certificate tự ký, môi trường công khai cần chứng thư hợp lệ và domain.
- **CI:** chạy lint, unit/integration/E2E phù hợp và build image khi có nền tảng CI.

### Ghi chú bắt buộc về “EngineNet”

Tài liệu yêu cầu của người học nêu bắt buộc sử dụng **EngineNet**, nhưng tên này chưa đủ để xác định chính xác thư viện/package nào. Tra cứu tên công khai cho thấy có nhiều kết quả không tương ứng một engine JavaScript 3D/ML rõ ràng; vì vậy chưa thể gán EngineNet vào vai trò cụ thể mà không có nguy cơ chọn sai. Nhóm cần đối chiếu đề cương, link tài liệu hoặc tên package chính xác với giảng viên trước khi khóa stack. Trong tài liệu này, EngineNet được đánh dấu là **ràng buộc cần xác nhận**, không thay thế bằng thư viện khác. Nếu EngineNet là engine tính toán, engine 3D hay framework cụ thể, cần xác định adapter/tích hợp và khả năng chạy offline. Việc dùng TypeScript cũng cần được giảng viên chấp thuận riêng nếu yêu cầu môn học ghi rõ JavaScript.

### Ghi chú về số phức và 3D

Phép nhân số phức biểu diễn phép quay 2D rất tự nhiên; số phức thông thường không biểu diễn đầy đủ mọi phép quay 3D. Để giữ đúng ràng buộc “chuyển động sử dụng số phức thay cho lượng giác”, cần làm rõ chuyển động nào được yêu cầu. Đề xuất: dùng phép nhân số phức cho các chuyển động/quay 2D hoặc mặt phẳng số; với camera/đối tượng 3D dùng quaternion hoặc cơ chế của engine, trừ khi đề bài yêu cầu cụ thể một biểu diễn khác. Đây là điểm cần trình bày trung thực trong tiểu luận, tránh tuyên bố mọi phép quay 3D đều dùng số phức thông thường.

## 8. Kiến trúc module và ưu tiên

| Module | Trách nhiệm | Mức ưu tiên | Rủi ro chính |
|---|---|---:|---|
| M1. Data Import & Validation | đọc, xem trước, kiểm tra, chuẩn hóa dữ liệu | P0 | CSV lỗi, dữ liệu lớn |
| M2. Regression Engine | thuật toán, cấu hình, seed, bước học, metric | P0 | sai số toán học, thuật toán khác biệt |
| M3. Visualization | dữ liệu 3D, bề mặt mô hình, loss, điều khiển | P0 | quá tải render, diễn giải sai khi nhiều chiều |
| M4. Experiment State | trạng thái, lịch sử, lưu/copy/xóa, checkpoint | P0 | mất trạng thái hoặc không tái lập |
| M5. Offline Storage & Sync | IndexedDB, outbox, retry, conflict | P0 | trùng/lệch dữ liệu, quota trình duyệt |
| M6. API & Validation | REST, versioning, kiểm tra quyền/trường, lỗi | P0 | dữ liệu không nhất quán, payload lớn |
| M7. Mongo Persistence | schema/collection/index/migration/retention | P0 | schema không khớp loại hồi quy |
| M8. Security & TLS | HTTPS 443, headers, CORS, secrets, upload | P0 | cấu hình cert/proxy sai |
| M9. Test & CI | unit, API, E2E, offline, deploy smoke checks | P0 | thiếu test tích hợp giữa module |
| M10. Export & Reporting | xuất kết quả/ảnh/báo cáo | P1 | định dạng và độ chính xác |
| M11. UX/Accessibility | onboarding, trạng thái, bàn phím, fallback 2D | P1 | app khó demo/sử dụng |

**P0** là điều kiện có bản demo hoàn chỉnh; **P1** hoàn thiện sau luồng cốt lõi. Các module P0 cần có owner, API contract và tiêu chí nghiệm thu ngay từ đầu.

## 9. Thiết kế dữ liệu MongoDB dự kiến

Đây là đề xuất logic để thống nhất trước khi triển khai, không phải schema code.

### `experiments`

- `_id`: ObjectId phía MongoDB; `clientId`: UUID duy nhất phía client.
- `name`, `description`, `status`, `ownerId` (nếu có tài khoản).
- `algorithm`: `type`, `version`, `config` (union có discriminator theo loại hồi quy).
- `datasetRef`, `targetColumn`, `featureColumns`, `preprocessing`, `splitConfig`, `seed`.
- `createdAt`, `updatedAt`, `deletedAt`, `syncVersion`.

### `datasets`

- `clientId`, `name`, `sourceType` (upload/sample/generated), `fileName`, `mimeType`, `sizeBytes`.
- `columns[]`: tên, kiểu, vai trò, thống kê cần thiết.
- `rowCount`, `contentHash`, `storageRef` hoặc dữ liệu nhỏ đã chuẩn hóa.
- Thông tin sinh dữ liệu, cách xử lý missing value, nguồn và timestamps.

### `trainingRuns`

- `clientId`, `experimentRef`, trạng thái, thời gian bắt đầu/kết thúc.
- `algorithmType`, `algorithmVersion`, `configSnapshot`, `datasetHash`, `seed`.
- `metrics`: train/test metrics; `coefficients`, `intercept`.
- `historyRef` hoặc chuỗi điểm loss/tham số đã lấy mẫu; không lưu mọi bước không giới hạn.
- `errorCode`, `errorMessage` đã làm sạch, timestamps.

### `syncOperations` (nếu cần audit riêng)

- `operationId`, `entityType`, `entityClientId`, operation, version, status, attempts, lastError, timestamps.
- Idempotency index duy nhất; index theo `updatedAt`, trạng thái và tham chiếu thường truy vấn.

**Schema theo trường hợp:** `algorithm.type` là discriminator; `config` được validate theo đúng loại. Không dùng một nhóm trường không giới hạn/không kiểm tra cho mọi thuật toán. Dataset lớn lưu ngoài document (hoặc tách chunk/collection theo thiết kế); document MongoDB có giới hạn kích thước. Cần chốt chính sách tài khoản/người sở hữu, retention và xóa dữ liệu trước khi thiết kế schema cuối.

## 10. API dự kiến

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/v1/health` | health check và phiên bản dịch vụ |
| GET/POST | `/api/v1/experiments` | liệt kê/tạo thí nghiệm |
| GET/PATCH/DELETE | `/api/v1/experiments/:id` | xem/cập nhật/xóa mềm |
| POST | `/api/v1/datasets` | tạo metadata hoặc khởi tạo upload |
| GET/DELETE | `/api/v1/datasets/:id` | xem/xóa dataset |
| POST | `/api/v1/training-runs` | ghi nhận hoặc yêu cầu chạy một phiên |
| GET | `/api/v1/training-runs/:id` | xem trạng thái/kết quả |
| POST | `/api/v1/sync/batch` | gửi batch thao tác offline, idempotent |
| GET | `/api/v1/sync/changes?since=...` | lấy thay đổi từ máy chủ |
| GET | `/api/v1/experiments/:id/export` | xuất kết quả/thí nghiệm |

API chính thức cần OpenAPI, quy tắc phân trang, payload limits, mã lỗi, xác thực, CORS và phiên bản hóa. Nếu chạy huấn luyện hoàn toàn ở browser, endpoint training-runs có thể chỉ nhận/lưu kết quả và trạng thái thay vì tính toán ở server; cần chốt cách phân chia này.

## 11. SSL/TLS và Docker

- Ứng dụng được truy cập qua `https://<domain-hoặc-host>/` trên **cổng TCP 443**.
- Reverse proxy nhận HTTPS trên 443 và chuyển tiếp nội bộ đến frontend/API; MongoDB không public ra Internet.
- MongoDB chỉ trong network nội bộ Docker; credentials lấy từ secret/environment không commit.
- Có healthcheck, volume dữ liệu bền vững, cấu hình môi trường development/demo/production và hướng dẫn backup/restore.
- Phát triển local: chứng thư tự ký hoặc dev proxy; trình duyệt có thể hiện cảnh báo. Trình diễn qua domain công khai: dùng certificate được trình duyệt tin cậy và gia hạn tự động.
- PWA/offline cần HTTPS trong môi trường trình duyệt thông thường (localhost là ngoại lệ phát triển); SSL là một phần của yêu cầu offline, không chỉ bảo mật API.
- Bộ dịch vụ Docker Compose dự kiến: `web`/frontend, `api`, `mongo`, `proxy`, tùy chọn `tester` và `mongo-express` chỉ bật trong profile development, không public.
- Tester là service/profile chạy kiểm thử tự động và trả exit code rõ ràng; không nhất thiết phải chạy liên tục như service sản phẩm.

## 12. Kế hoạch kiểm thử và test case

### Unit tests — toán học/engine

1. Linear regression khôi phục hệ số trên dữ liệu tổng hợp không nhiễu.
2. Hệ số và intercept đúng trong sai số cho phép khi có nhiễu cố định/seed.
3. Loss giảm với cấu hình gradient descent ổn định.
4. Learning rate bằng 0, âm, NaN hoặc quá lớn bị từ chối/phát hiện.
5. Mảng rỗng, một mẫu, chiều đặc trưng không khớp, giá trị vô hạn/NaN được xử lý đúng.
6. Polynomial bậc 1 tương đương tuyến tính theo thiết kế biến đổi.
7. Ridge λ=0 tương ứng hành vi không regularize (trong giới hạn implementation).
8. Lasso/Ridge validate λ; test đặc tính shrinkage theo tolerance.
9. MSE/RMSE/MAE/R² kiểm tra bằng bộ giá trị tính tay; R² trường hợp target hằng được định nghĩa rõ.
10. Seed giống nhau tạo cùng dữ liệu/chia tập; seed khác cho phép khác kết quả.
11. Pause/resume/step/stop giữ đúng trạng thái và số bước.

### Unit tests — nạp dữ liệu

12. CSV hợp lệ có header và không header theo quy ước.
13. CSV dấu phẩy trong dấu nháy, newline/encoding và dòng rỗng.
14. Cột mục tiêu thiếu, cột không tồn tại, dữ liệu chữ ở cột số.
15. Missing value từng phương thức; xác nhận không âm thầm thay dữ liệu.
16. Tệp rỗng, hỏng, sai định dạng, quá dung lượng và hàng quá giới hạn.
17. Cột trùng tên, dòng trùng, số âm/giá trị cực lớn.

### API/DB integration

18. CRUD experiment thành công và validation từ chối config không khớp discriminator.
19. Tạo run với dataset không tồn tại trả lỗi đúng.
20. Upload/metadata dataset giới hạn kích thước; không chấp nhận MIME giả mạo chỉ dựa phần mở rộng.
21. Batch sync gửi lại cùng idempotency key không tạo bản sao.
22. Hai cập nhật cùng clientId/version tạo đúng nhánh xung đột.
23. Xóa mềm, truy vấn và index theo trạng thái/thời gian đúng.
24. MongoDB khởi động lại vẫn giữ dữ liệu nhờ volume.
25. API lỗi DB/mất kết nối trả lỗi ổn định, không lộ stack trace/secret.

### E2E và offline

26. Người dùng tạo thí nghiệm bằng dataset tổng hợp, chạy hồi quy và xem kết quả.
27. Người dùng nhập CSV, chọn cột, cấu hình, chạy, lưu và mở lại.
28. Chạy từng bước, pause/resume/stop và reset trực quan.
29. Tắt mạng: mở app đã cache, tạo/sửa/chạy/xem/xuất thí nghiệm offline.
30. Bật mạng lại: outbox sync thành công; reload không gửi bản sao.
31. Mất mạng giữa upload/batch: retry không làm mất hoặc nhân đôi dữ liệu.
32. Cùng chỉnh một thí nghiệm offline trên hai phiên bản: hiển thị conflict và cho quyết định.
33. Xóa local storage/quota hết: cảnh báo dễ hiểu; không báo đã sync.
34. 3D tắt/WebGL không khả dụng: fallback 2D/table vẫn dùng được.
35. Nhiều đặc trưng: UI không giả vờ hiển thị đầy đủ không gian; hiển thị projection/lát cắt có nhãn.

### Bảo mật/triển khai

36. HTTPS mở trên 443; HTTP chuyển hướng HTTPS nếu môi trường cho phép.
37. Chứng thư hợp lệ trong production; cảnh báo self-signed được ghi trong hướng dẫn dev.
38. Security headers/CORS theo allowlist; API không chấp nhận origin tùy ý.
39. Không thể truy cập MongoDB từ mạng công khai; secrets không nằm trong image/repo.
40. Request payload quá lớn, injection, sai kiểu và đường dẫn upload bất thường bị từ chối.
41. Docker Compose build/start/healthcheck/stop và dữ liệu volume qua lần restart.
42. Tester chạy trong container với DB test riêng; không xóa nhầm dữ liệu demo/production.

### Tiêu chí nghiệm thu

- Có thể hoàn thành luồng từ dữ liệu đến kết quả cho ít nhất các loại hồi quy đã chốt.
- Có giải thích trực quan phù hợp số chiều, điều khiển huấn luyện, metric và lịch sử.
- Có thể sử dụng luồng cốt lõi offline rồi đồng bộ idempotent khi online.
- Schema/API được tài liệu hóa và validator từ chối dữ liệu sai.
- Docker Compose khởi chạy được, truy cập qua HTTPS cổng 443 trong môi trường mục tiêu.
- Bộ kiểm thử bao phủ công thức, biên, lỗi dữ liệu, API, sync, UI và cấu hình triển khai.

## 13. Chia việc đề xuất cho 6 thành viên

| Thành viên/nhóm vai trò | Phụ trách chính | Bàn giao |
|---|---|---|
| 1. Điều phối/kiến trúc | yêu cầu, kiến trúc, tích hợp, tài liệu và demo | ADR, API contract, kế hoạch tích hợp |
| 2. Frontend & UX | màn hình thí nghiệm, import, trạng thái, accessibility | luồng UI và component |
| 3. 3D visualization | Three.js/EngineNet sau khi xác nhận, camera, lớp dữ liệu/loss | scene 3D, fallback và hiệu năng |
| 4. Regression engine | thuật toán, metric, seed, Web Worker | engine có API ổn định và unit tests |
| 5. Backend & MongoDB | REST, schema, validation, persistence, sync endpoints | API/OpenAPI, DB schema/index |
| 6. QA/DevOps/offline | PWA/IndexedDB/sync E2E, Docker, TLS, test pipeline | test plan, Compose, hướng dẫn SSL |

Các vai trò có thể luân phiên; người phụ trách module không làm việc tách biệt. Cả nhóm cần review API/schema sớm, ghép vertical slice nhỏ trước khi mở rộng thuật toán.

## 14. Lộ trình đề xuất

1. **Chốt yêu cầu:** xác nhận EngineNet, thuật toán, cách chạy tính toán, quy mô demo và chính sách dữ liệu.
2. **Thiết kế:** sơ đồ module, API contract, discriminator/schema, prototype mặt trực quan, test strategy.
3. **Vertical slice:** tạo dataset mẫu → chạy một thuật toán → xem 3D/metric → lưu API/Mongo → HTTPS 443.
4. **Mở rộng engine và dữ liệu:** thêm các biến thể hồi quy, CSV, validation, preprocessing.
5. **Offline/sync:** IndexedDB/outbox, retry, conflict UX, test mất mạng.
6. **Hoàn thiện:** so sánh/xuất, kiểm thử đầy đủ, hardening Docker/TLS, tài liệu và rehearsal thuyết trình.

## 15. Rủi ro và quyết định cần khóa

- **EngineNet chưa xác định:** cần tên chính xác/link/package và vai trò bắt buộc; đây là blocker của lựa chọn engine 3D/ML.
- **“Toàn bộ quá trình” quá rộng:** giới hạn thành dữ liệu, tham số, loss, dự đoán, residual và metric; projection được gắn nhãn khi nhiều chiều.
- **Số phức trong chuyển động 3D:** cần xác định yêu cầu của giảng viên về áp dụng số phức; quaternion là biểu diễn tiêu chuẩn cho quay 3D tổng quát.
- **Offline và đồng bộ dữ liệu lớn:** cần giới hạn kích thước CSV, retention, quyền riêng tư và chính sách upload.
- **Chạy ở client hay server:** đề xuất chạy demo nhỏ phía browser để offline, backend lưu/đồng bộ; nếu cần kết quả server-side thì thêm job API và xử lý khác biệt trạng thái.
- **SSL 443:** chứng thư production phụ thuộc domain/máy chủ; local self-signed không chứng minh được trust công khai.
- **Phạm vi 6 người:** ưu tiên một vertical slice hoàn chỉnh trước khi hỗ trợ nhiều thuật toán và chức năng phụ.

## 16. Câu hỏi còn mở cho buổi chốt với nhóm/giảng viên

1. EngineNet chính xác là thư viện/engine nào (đường dẫn tài liệu hoặc package) và phải dùng cho phần nào?
2. Giảng viên có chấp thuận dùng TypeScript cho toàn bộ mã nguồn thay JavaScript thuần không?
3. Bắt buộc những loại hồi quy nào, hay nhóm được tự đề xuất danh mục?
4. “Dùng số phức thay lượng giác” áp dụng cho chuyển động/hiển thị 2D, camera 3D, hay phần cụ thể nào của thuật toán?
5. Thí nghiệm có tài khoản người dùng không, dữ liệu CSV có thể nhạy cảm không, và kích thước dữ liệu tối đa là bao nhiêu?
6. Môi trường triển khai/domain/certificate và yêu cầu hỗ trợ trình duyệt là gì?

## 17. Thuật ngữ

- **Thí nghiệm:** một lần cấu hình dữ liệu + thuật toán + kết quả.
- **Run:** một phiên huấn luyện cụ thể.
- **Offline-first:** ứng dụng lưu thao tác cục bộ khi không có mạng và đồng bộ sau.
- **Outbox:** hàng đợi thao tác chưa được máy chủ xác nhận.
- **Idempotency:** gửi lại cùng thao tác không tạo kết quả trùng.
- **Discriminator:** trường phân biệt loại hồi quy để validate cấu hình theo schema tương ứng.
- **TLS/SSL:** mã hóa kết nối HTTPS; SSL là cách gọi phổ biến, TLS là giao thức hiện đại.
