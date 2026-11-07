# Báo cáo triển khai xác thực

## Phạm vi

Đã thêm session server-side, bcrypt (cost 12), auth guard toàn cục, quyền dữ liệu, CSRF/CORS,
rate limit, hồ sơ cá nhân, quản trị user và audit log.
Không sửa frontend, không thêm Redis/Nginx/Docker service, không chạy migration trên DB dev.

## File thêm/sửa

- Thêm `src/common/database.config.ts`, `configure-app.ts`, `session.config.ts`,
  `ownership.ts`, `roles.guard.ts`, `session.config.spec.ts`; thay `auth.guard.ts`.
- Hoàn thiện các tệp có sẵn `src/login/login.controller.ts`, `login.module.ts`,
  `login.service.ts`; thêm `auth.dto.ts`, `user.schema.ts`, `audit.schema.ts`, `audit.service.ts`.
- Thêm `src/users/users.controller.ts`, `users.module.ts`, `users.service.ts`, `users.dto.ts`.
- Sửa `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`.
- Sửa controller/service của `src/datasets`, `src/experiments`, `src/training-runs`, `src/sync`.
- Sửa `src/experiments/schemas/experiment.schema.ts` để giữ cấu hình rỗng; thêm
  `deletedAt` và giữ cấu hình rỗng ở `src/training-runs/schemas/training-run.schema.ts`.
- Cập nhật `src/experiments/experiments.controller.spec.ts`, thay `test/app.e2e-spec.ts`,
  chỉnh timeout trong `vitest.config.e2e.ts`.
- Thêm `scripts/migrate-anonymous.mjs`, `docs/AUTH-API.md`, báo cáo này.
- Cập nhật `package.json`, `package-lock.json`, `.env.example`.
- Giữ các thay đổi workspace đã có của người dùng; không sửa `tsconfig.json` trong tác vụ này.
  Không sửa các archive `src.rar`/`database.rar` xuất hiện trong workspace.

Bảng endpoint, quyền, request/response và mã lỗi: [AUTH-API.md](AUTH-API.md).

## Biến môi trường

| Biến                            | Ý nghĩa                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| SESSION_SECRET                  | Bí mật ký session cookie; production bắt buộc >=32 ký tự                    |
| ADMIN_EMAIL                     | Email tạo admin đầu tiên, chuẩn hóa trim/lowercase                          |
| ADMIN_PASSWORD                  | Mật khẩu admin đầu tiên, tối thiểu 8 ký tự, tối đa 72 byte UTF-8; không log |
| COOKIE_SECURE                   | true ép Secure; NODE_ENV=production luôn bật Secure                         |
| TRUST_PROXY                     | Chỉ true mới set trust proxy = 1                                            |
| CORS_ORIGINS                    | Mặc định http://localhost:4200,http://localhost:5173; không cho *           |
| MONGODB_URI / connection_string | Giữ thứ tự ưu tiên hiện có; dùng chung helper cho Mongoose và session store |

Tạo secret riêng và cấu hình môi trường khi chạy thật; không dùng chuỗi mẫu trong production.
Nếu không có secret ở dev, sinh ngẫu nhiên trong bộ nhớ, restart sẽ hủy hiệu lực cookie cũ.
Nếu chưa có admin và có đủ hai biến ADMIN_*, tạo admin khi khởi động. Email trùng user hiện có
làm startup báo lỗi, không tự chiếm quyền tài khoản đó. Không thay mật khẩu admin đã tồn tại.

## Migration chạy tay

Kiểm tra URI và email admin đích trong môi trường trước khi chạy.
Script đọc `.env` bằng Node; biến môi trường đã có được ưu tiên.
Mặc định chỉ đếm, thêm --apply mới ghi:

```sh
npm run migrate-anonymous -- admin@example.com
npm run migrate-anonymous -- admin@example.com --apply
```

Admin đích phải tồn tại, role admin và status active. Chỉ đổi ownerId=anonymous_user trong
datasets/experiments/trainingRuns, tăng syncVersion và cập nhật updatedAt.
Chạy lại không chuyển lại dữ liệu đã có chủ. Không tự chạy trong startup/deploy/test.
Chưa chạy script này trên dữ liệu dev.

## Chuyển sang bcrypt

Dùng thư viện bcrypt 6.0.0 đã cài, API bất đồng bộ hash/compare, cost 12 cho đăng ký,
admin khởi tạo và đổi mật khẩu. Hash giả khi không tìm thấy email cũng dùng bcrypt.
Mật khẩu tối thiểu 8 ký tự, tối đa 72 byte UTF-8; vượt giới hạn trả 400 để tránh
bcrypt bỏ qua phần cuối. Quy tắc này áp dụng cả login, đổi/xóa tài khoản và ADMIN_PASSWORD.
Hash Argon2 cũ không tương thích với bcrypt: nếu đã có tài khoản dùng hash cũ, cần đặt lại
mật khẩu bằng quy trình quản trị riêng hoặc tạo lại tài khoản thử nghiệm; tác vụ không sửa DB
hay tự chuyển hash. Dependency argon2 cũ còn trong package.json nhưng code xác thực không dùng.

## Quyết định

- Register không tự đăng nhập; role/ownerId bị bỏ qua trước ValidationPipe riêng, trường lạ khác bị từ chối.
- Session payload nghiệp vụ chỉ gồm userId/sessionVersion; express-session thêm metadata cookie.
- Admin được xem/sửa dữ liệu mọi người nhưng cập nhật không đổi chủ sở hữu.
- Giữ envelope sync cũ; lỗi từng operation không làm lộ snapshot của user khác.
  Idempotency key lưu dạng SHA-256([userId,key]), giữ unique index cũ; key giống nhau giữa hai user không đụng nhau.
  Các log idempotency trước nâng cấp không được tái sử dụng để tránh chia sẻ quyền cũ.
- Payload cũ không bị global whitelist; chỉ lọc trường ghi vào document nhằm chặn ownerId,
  _id, timestamps, deletedAt, syncVersion, toán tử Mongo và đường dẫn file.
- Throttler dùng bộ nhớ, 5 request/phút/IP/endpoint cho login/register, tính cả lần thành công.
- MongoDB standalone: xóa tài khoản theo thứ tự khóa/tăng version → soft-delete → hard-delete.
  Nếu lỗi giữa chừng, user bị khóa và admin có thể gọi xóa lại; không giả định có transaction/replica set.
- Bảo vệ admin cuối cùng được tuần tự hóa trong một tiến trình, gồm cả trường hợp hai admin tự hạ quyền đồng thời.
  Nếu triển khai nhiều tiến trình/replica cần thay bằng khóa hoặc transaction cấp DB. Không thêm service mới.
- User xóa không làm mất tệp CSV vật lý; mọi route tải kiểm tra user/owner/deletedAt.
- E2e tự tạo tiến trình MongoDB tạm với DB hoi-quy-3d-test, bỏ qua .env và dùng MemoryStore.
  Helper URI cũng chặn DB khác khi NODE_ENV=test. Test tự dọn MongoDB/tệp CSV tạm.

## Tài liệu thư viện đã kiểm tra

Phiên bản khóa trong lần cài: express-session 1.19.0, connect-mongo 6.0.0,
bcrypt 6.0.0, @nestjs/throttler 6.7.1, class-validator 0.15.1, class-transformer 0.5.1.
Đã đọc README/type declarations từ đúng package trong node_modules; throttler khai báo peer support Nest 12.
Tham khảo thêm [Express session](https://expressjs.com/en/resources/middleware/session/),
[connect-mongo](https://github.com/jdesboeufs/connect-mongo/blob/master/README.md),
[Nest throttler releases](https://github.com/nestjs/throttler/releases).

## Giới hạn triển khai

Chưa smoke-test HTTPS/production cookie và MongoStore TTL trên môi trường triển khai thực.
Một request đã vượt guard trước lúc user bị khóa có thể đang xử lý; session mới/request tiếp theo bị chặn.
Xóa nhiều collection không atomic trên Mongo standalone; cần replica set/transaction nếu yêu cầu tính nguyên tử.
Không triển khai xác minh email/quên mật khẩu theo phạm vi đã chốt.
Npm install báo 14 cảnh báo dependency (2 low, 7 moderate, 5 high); chưa nâng cấp hàng loạt ngoài phạm vi.

## Kiểm tra

Giai đoạn 1 trước khi thêm users: build/lint thành công; 9 unit test và 7 e2e test qua.
Kết quả sau khi chuyển sang bcrypt:

| Lệnh                                              | Kết quả                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `npm run build`                                   | Thành công, exit 0                                  |
| `npm run lint`                                    | Thành công, không lỗi/cảnh báo, exit 0              |
| `npm test`                                        | 3 file, 12 test qua, exit 0                         |
| `npm run test:e2e`                                | 1 file, 17 test qua, exit 0                         |
| `node --check scripts/migrate-anonymous.mjs`      | Cú pháp hợp lệ                                      |
| `git diff --check -- . ':(exclude)tsconfig.json'` | Không lỗi whitespace trong phần thay đổi của tác vụ |

`git diff --check` toàn workspace còn báo một dấu cách cuối dòng đã có trước tác vụ ở
`tsconfig.json:11`; giữ nguyên thay đổi của người dùng.
Lần test đầu trong sandbox lỗi EPERM khi Vitest đổi tên cache; chạy ngoài sandbox đã thực thi được test.
