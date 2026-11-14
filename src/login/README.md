# Login — đăng ký, đăng nhập và phiên người dùng

[Về mục lục backend](../README.md) · [Quản lý tài khoản](../users/README.md) · [Cấu hình phiên](../common/README.md)

## Module làm gì?

`LoginModule` là module xác thực **đang được AppModule nạp**. Nó tạo tài khoản, kiểm tra mật khẩu, tạo/hủy phiên đăng nhập và cung cấp thông tin người dùng hiện tại. Tên thư mục là `login`, nhưng đường dẫn HTTP là `/api/v1/auth`.

Module không sử dụng JWT. Trình duyệt giữ cookie `hq3d.sid`; server giữ dữ liệu phiên và tra lại tài khoản ở mỗi request cần đăng nhập. Thư mục `src/auth` là một triển khai cũ, không phải API đang chạy.

## API

| Method và đường dẫn | Đầu vào | Kết quả thành công | Cần đăng nhập |
|---|---|---|---|
| `POST /api/v1/auth/register` | `email`, `password`, `displayName` | HTTP 201, thông tin tài khoản mới | Không |
| `POST /api/v1/auth/login` | `email`, `password` | HTTP 200, thông tin tài khoản và cookie phiên | Không |
| `GET /api/v1/auth/me` | Cookie phiên | HTTP 200, thông tin tài khoản hiện tại | Có |
| `POST /api/v1/auth/logout` | Cookie phiên | HTTP 200, `{ "success": true }`, xóa cookie | Có |

Đăng ký **không tự đăng nhập**. Sau khi tạo tài khoản, cần gọi `login`. Không có endpoint `guest` hoặc `session` trong module đang chạy.

Mọi POST cần header `X-Requested-With: XMLHttpRequest`. Với JSON, thêm `Content-Type: application/json`. Khi dùng `fetch`, đặt `credentials: 'include'` để nhận và gửi cookie. Origin của giao diện phải nằm trong `CORS_ORIGINS`.

## Quy tắc dữ liệu

| Trường | Quy tắc |
|---|---|
| `email` | Email hợp lệ, tối đa 254 ký tự; loại khoảng trắng hai đầu và chuyển chữ thường |
| `password` | Từ 8 đến 72 ký tự, đồng thời không vượt 72 byte UTF-8; không tự trim |
| `displayName` | Chỉ dùng khi đăng ký; trim rồi phải còn 1–120 ký tự |

Giới hạn byte khiến mật khẩu có tiếng Việt/emoji có thể đạt giới hạn trước 72 ký tự. Mật khẩu lưu bằng bcrypt với cost 12, không lưu bản rõ. Khi đăng ký, `role` và `ownerId` do client gửi bị bỏ qua; trường lạ khác bị trả 400. Tài khoản đăng ký luôn có role `user`.

## Ví dụ sử dụng

Ví dụ dưới đây chạy ở giao diện có origin được phép; thay địa chỉ API nếu cần:

```js
const base = 'http://localhost:3000/api/v1';
const headers = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};
await fetch(`${base}/auth/register`, {
  method: 'POST', credentials: 'include', headers,
  body: JSON.stringify({
    email: 'reader@example.com',
    password: 'DemoPassword123!',
    displayName: 'Người đọc',
  }),
});
const response = await fetch(`${base}/auth/login`, {
  method: 'POST', credentials: 'include', headers,
  body: JSON.stringify({ email: 'reader@example.com', password: 'DemoPassword123!' }),
});
if (!response.ok) throw new Error(await response.text());
const account = await response.json();
```

Đối tượng trả về trực tiếp có `_id`, `email`, `displayName`, `role`, `status`, `createdAt`, `updatedAt`; không có lớp bọc `{ user: ... }`, không trả `passwordHash` hoặc `sessionVersion`.

## Luồng xử lý và vòng đời phiên

1. Đăng ký: chuẩn hóa/validate DTO → băm mật khẩu → ghi collection `users` → ghi audit `register` → trả tài khoản công khai.
2. Đăng nhập: tìm email → so sánh bcrypt → yêu cầu trạng thái `active`. Email không tồn tại vẫn chạy bcrypt với hash giả; lỗi trả về không phân biệt sai email, sai mật khẩu hoặc tài khoản bị khóa.
3. Đăng nhập thành công: tạo lại session ID, lưu `userId` và `sessionVersion`, ghi audit `login.success`, trả cookie.
4. Request tiếp theo: AuthGuard so sánh phiên với tài khoản hiện tại. Tài khoản bị xóa/khóa hoặc phiên bản không khớp sẽ bị hủy phiên và trả 401.
5. Đăng xuất: hủy session trong store, xóa cookie, ghi audit `logout`.

Cookie có thời hạn cấu hình 7 ngày, `HttpOnly`, `SameSite=Lax`, path `/`. `Secure` bật ở production hoặc khi `COOKIE_SECURE=true`. Store bình thường là collection `sessions` trong MongoDB; chế độ test dùng MemoryStore. Chi tiết biến môi trường ở [common](../common/README.md).

## Dữ liệu và các thành phần

| Thành phần | Trách nhiệm |
|---|---|
| `login.controller.ts` | Bốn endpoint auth, validation, lưu/hủy session |
| `login.service.ts` | Tạo tài khoản, bcrypt, kiểm tra đăng nhập, khởi tạo admin |
| `auth.dto.ts` | Quy tắc email/mật khẩu/tên và bỏ trường đặc quyền khi đăng ký |
| `user.schema.ts` | Collection `users`: email unique, hash ẩn mặc định, role `user/admin`, status `active/disabled`, `sessionVersion` mặc định 0, timestamps |
| `audit.service.ts`, `audit.schema.ts` | Collection `auditLogs`: `userId`, `action`, `targetId`, `ip`, `at`; không ghi request body hay cookie |
| `login.module.ts` | Đăng ký model, AuthGuard toàn cục và giới hạn tần suất |

Module là global, xuất LoginService, AuditService và các model để module khác dùng. AuthGuard toàn cục bảo vệ các route trừ route gắn `Public`.

## Khởi tạo admin và lỗi thường gặp

Khi khởi động, nếu đã có tài khoản role `admin` thì không tạo thêm. Nếu chưa có, có thể đặt đồng thời `ADMIN_EMAIL` và `ADMIN_PASSWORD` để tạo `Administrator`. Nếu cả hai không được đặt, bước này bị bỏ qua. Email không hợp lệ, mật khẩu không đạt yêu cầu hoặc email đã được tài khoản khác sử dụng sẽ làm khởi động thất bại; server không chiếm lại tài khoản đó.

| Mã | Trường hợp |
|---|---|
| 400 | DTO sai, mật khẩu quá số byte, trường không được phép |
| 401 | Sai thông tin đăng nhập, phiên thiếu/hết hiệu lực, tài khoản không active |
| 403 | Thiếu header bắt buộc hoặc Origin không được phép |
| 409 | Email đăng ký đã tồn tại |
| 429 | Vượt giới hạn 5 request/phút theo IP trên các route register/login |

Các sự kiện đăng nhập thất bại được ghi với action `login.failure`. Không có API khôi phục mật khẩu hoặc xác minh email trong module này.

## Kiểm tra

Chạy lệnh từ thư mục gốc: `npm run test:e2e` để kiểm tra auth/phiên/quyền trong bộ E2E, hoặc `npm test` cho unit test. Bộ E2E hiện còn có ca kiểm thử API admin không xuất hiện trong controller hiện tại; cần phân biệt lỗi do hợp đồng test cũ với lỗi của bốn endpoint nêu trên.
