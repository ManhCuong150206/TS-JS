# Common — cấu hình HTTP, phiên, quyền và tiện ích chung

[Về mục lục backend](../README.md)

## Vai trò

Thư mục này không khai báo một NestJS module hay endpoint riêng. Nó tập hợp các quy tắc được nhiều module dùng: prefix API, CORS, chống request ghi thiếu header, session, xác thực, quyền sở hữu, phân trang và phân tích CSV. Hiểu các quy tắc này giúp giải thích vì sao một API trả 401/403/404 dù body đúng.

## Từ request đến nghiệp vụ

`configureApp` đặt prefix `/api/v1`, cấu hình proxy, kiểm tra Origin, bật CORS, yêu cầu header cho thao tác ghi, cài session middleware và cấu hình JSON tối đa `10mb`. Sau đó AuthGuard toàn cục do LoginModule đăng ký kiểm tra phiên trước khi controller thực hiện nghiệp vụ (trừ route `Public`).

Các POST/PATCH/PUT/DELETE đều cần `X-Requested-With: XMLHttpRequest`, kể cả đăng ký/đăng nhập. Origin có mặt nhưng không nằm trong allowlist sẽ trả 403. Request không có Origin vẫn qua bước kiểm tra Origin; yêu cầu header ghi vẫn áp dụng.

## Biến cấu hình

| Biến | Giá trị/hành vi |
|---|---|
| `MONGODB_URI` | URI MongoDB ưu tiên; dùng cả cho model và session store |
| `connection_string` | Dự phòng nếu không có `MONGODB_URI`; thiếu cả hai thì lỗi khởi động |
| `NODE_ENV` | `production` bật cookie Secure và kiểm tra secret; `test` dùng MemoryStore và hạn chế tên DB |
| `SESSION_SECRET` | Ký cookie; production yêu cầu ít nhất 32 ký tự; dev thiếu thì tự sinh, restart làm phiên cũ mất hiệu lực |
| `COOKIE_SECURE` | Chuỗi `true` bật Secure ngay cả ngoài production |
| `TRUST_PROXY` | Chuỗi `true` đặt Express trust proxy = 1 |
| `CORS_ORIGINS` | Danh sách origin cách nhau bằng dấu phẩy, trim từng mục; mặc định `http://localhost:4200,http://localhost:5173`; không cho `*` |

Ở chế độ test, URI phải có pathname `/hoi-quy-3d-test`; URI khác bị từ chối để tránh chạy nhầm dữ liệu dev. AppModule còn bỏ đọc `.env` khi `NODE_ENV=test`.

Không cần token Authorization để gọi API phiên hiện tại. Cookie `hq3d.sid` có `HttpOnly`, `SameSite=Lax`, path `/`, maxAge 7 ngày; Mongo store dùng collection `sessions` với TTL 7 ngày. Store không lưu phiên chưa khởi tạo (`saveUninitialized: false`) và không tự resave phiên không đổi. HTTPS cần thiết khi cookie Secure bật; với reverse proxy phải cấu hình phù hợp để Express nhận biết kết nối.

## AuthGuard và CurrentUser

AuthGuard bỏ qua handler/class có metadata `Public`. Các route còn lại cần `req.session.userId` hợp lệ, tài khoản tồn tại/active và `sessionVersion` khớp. Nếu không, guard hủy session, xóa cookie và trả 401 `Vui lòng đăng nhập`.

Khi hợp lệ, guard gắn `req.user = { userId, role, account }`. Decorator `CurrentUser` đưa đối tượng này vào tham số controller. Nó không đọc user ID tùy ý từ header/body.

Quyền truy cập tài nguyên được kiểm tra bằng bộ lọc owner/admin ở Service. Guard role cũ không được dùng đã được xóa.

## Quyền sở hữu và trường được phép ghi

| Hàm | Hành vi |
|---|---|
| `ownerFilter(user)` | User thường: `{ ownerId: user.userId }`; admin: `{}` |
| `idFilter(id)` | Chuỗi ObjectId hợp lệ: tìm `_id` hoặc `clientId`; chuỗi khác: tìm `clientId`; thiếu/rỗng: 404 |
| `assertOwner(record, user)` | Thiếu record hoặc sai owner với user thường: 404; admin được qua |
| `dataFields(data, kind)` | Chỉ lấy khóa cấp cao nhất trong allowlist của dataset/experiment/trainingRun |

404 cho dữ liệu người khác giúp không xác nhận sự tồn tại của bản ghi. `dataFields` loại `_id`, owner, timestamps, `deletedAt`, `syncVersion`, đường dẫn storage và khóa top-level không thuộc hợp đồng. Nó là bộ lọc trường, **không phải validator toàn bộ object lồng nhau**. Các trường Mixed vẫn cần kiểm tra riêng khi nghiệp vụ yêu cầu.

Allowlist dataset gồm tên/nguồn, thông tin tệp, cột, preview, cấu hình sinh. Allowlist experiment gồm cấu hình thí nghiệm và snapshot kết quả frontend. Allowlist run gồm tham chiếu experiment, trạng thái/thuật toán, snapshot, metrics, model, history, lỗi và mốc thời gian. Các service tự gán ID/owner/version sau bước lọc.

## Phân trang

`pagination(page, limit)` nhận chuỗi số hoặc số nguyên dương; thiếu thì dùng page 1/limit 20. Không nhận 0, số âm, số thập phân, chuỗi rỗng; limit tối đa 100. Cũng kiểm tra offset `(page - 1) * limit` còn trong miền số nguyên an toàn. Sai đầu vào trả 400, không âm thầm cắt về mặc định.

Các service list thường trả `{ items, total, page, limit, totalPages }`; khi total = 0 thì totalPages = 0. Phân trang không tự cung cấp tính nhất quán khi dữ liệu đang được ghi đồng thời.

## CsvValidator: kết quả và quy tắc

`CsvValidator.validate(Buffer hoặc string, { maxRows? })` trả:

| Trường | Nội dung |
|---|---|
| `isValid`, `errors` | Kết quả hợp lệ và danh sách lỗi |
| `columns` | Thống kê/suy luận cho từng cột |
| `rowCount` | Số dòng dữ liệu sau bỏ dòng hoàn toàn trống, không tính header |
| `previewRows` | Tối đa 20 dòng xem trước, chuyển số/boolean và ô thiếu về kiểu tương ứng |
| `sha256` | SHA-256 của bytes đầu vào, trước chuẩn hóa xuống dòng |

Validator decode UTF-8 nghiêm ngặt, chặn dữ liệu nhị phân/ký tự điều khiển, dùng dấu phẩy làm delimiter. Parser hỗ trợ nháy kép, escape `""`, xuống dòng trong ô, chuẩn hóa CRLF/CR về LF; trim giá trị ô. Nháy không đóng, nháy giữa trường hoặc ký tự sau nháy đóng đều lỗi. Dấu chấm phẩy/tab không phải delimiter được hỗ trợ.

CSV cần header không trống/trùng, ít nhất 2 cột và 1 dòng dữ liệu, mỗi dòng cùng số cột. Giới hạn mặc định 50.000 dòng, có thể đổi qua tham số `maxRows` của hàm; upload hiện gọi mặc định này.

Ô trống hoặc chuỗi chính xác `null`, `undefined`, `NaN` tính là thiếu. Trong các ô không thiếu, nếu ít nhất 80% là số thì kiểu cột là number; tiếp theo xét boolean rồi date với ngưỡng tương tự; còn lại là string. Cột không có dữ liệu là unknown. Boolean nhận true/false không phân biệt hoa thường; ngày cần có tiền tố dạng YYYY-MM-DD và parse được. Số phải hữu hạn.

`count` là số ô không thiếu, `missingCount` là số ô thiếu. Min/max được tính từ giá trị số; mean chỉ gán khi cột được suy luận number, làm tròn 4 chữ số thập phân. Suy luận kiểu không biến mọi giá trị trong cột thành số và không kiểm tra cột mục tiêu/đặc trưng của mô hình.

Ví dụ `x,y` cùng các dòng `1,3` và `2,5` tạo rowCount 2, hai cột number, mean lần lượt 1.5 và 4, preview gồm hai object số. CSV chứa text vẫn có thể hợp lệ về cấu trúc.

## Bản đồ file và kiểm tra

| File | Trách nhiệm |
|---|---|
| `configure-app.ts` | Thiết lập HTTP chung, CORS, header ghi, session, JSON limit |
| `database.config.ts` | Chọn URI, bảo vệ DB test |
| `session.config.ts` | Cookie/store, lưu/hủy phiên |
| `auth.guard.ts` | Xác thực toàn cục, Public, CurrentUser, RequestUser |
| `ownership.ts` | Owner, ID và allowlist payload |
| `pagination.ts` | Kiểm tra tham số phân trang |
| `csv-validator.ts` | Parse CSV và tạo metadata |

Chạy từ gốc: `npm test -- src/common/session.config.spec.ts src/common/csv-validator.spec.ts`. Các ca HTTP về CORS/header/phiên/quyền/phân trang nằm trong bộ `npm run test:e2e`. Khi API trả 403, kiểm tra Origin và header trước khi kiểm tra logic controller; khi 401, kiểm tra cookie và phiên.
