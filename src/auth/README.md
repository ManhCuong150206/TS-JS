# Auth — triển khai xác thực cũ, không được nạp

[Về mục lục backend](../README.md) · [Module đăng nhập đang sử dụng](../login/README.md)

## Trạng thái hiện tại

Thư mục này chứa một triển khai xác thực độc lập dùng token cookie tự quản lý. **AppModule hiện không import AuthModule**, nên các controller/middleware dưới đây không tham gia ứng dụng đang chạy. Khi tích hợp frontend, dùng tài liệu [LoginModule](../login/README.md).

Không nạp đồng thời hai module như một cách bật thêm chức năng: cả hai có controller mang prefix `auth` và trùng route register/login/logout, nhưng dùng model, mật khẩu, cookie và hình dạng user khác nhau. Triển khai này cũng không tự tương thích với AuthGuard hiện tại vốn đọc `req.session`.

## Chức năng có trong mã cũ

| Route khai báo trong controller | Ý nghĩa nếu được tích hợp riêng |
|---|---|
| `GET /auth/session` | Trả `{ user: identity hoặc null }` từ middleware |
| `POST /auth/guest` | Tạo tài khoản Guest ẩn danh và cấp token |
| `POST /auth/register` | Tạo tài khoản rồi cấp token ngay |
| `POST /auth/login` | Kiểm tra thông tin và cấp token |
| `POST /auth/logout` | Xóa phiên token hiện tại, trả `{ "success": true }` |

Đây là danh sách route trong source, **không phải danh sách endpoint khả dụng của server hiện tại**. Nếu đặt trong ứng dụng có prefix chung thì đường dẫn còn thêm `/api/v1`.

## Dữ liệu đầu vào và đầu ra

Đăng ký nhận `email`, `password`, `displayName`; đăng nhập nhận email và password. Email được trim/chuyển chữ thường, kiểm tra bằng biểu thức đơn giản và giới hạn 254 ký tự. Password dài 8–128 ký tự. Display name đăng ký được trim, dài 1–80 ký tự. Controller nhận object thô, service tự lấy trường cần thiết; không dùng DTO validation của LoginModule.

Identity công khai có dạng:

```json
{
  "userId": "<MongoDB ObjectId dạng chuỗi>",
  "email": "reader@example.com",
  "displayName": "Người đọc",
  "isAnonymous": false
}
```

Guest có `displayName: "Guest"`, `isAnonymous: true`, không cần email. Các thao tác cấp phiên trả `{ "user": identity }`.

## Cách lưu và xác thực phiên trong triển khai này

1. Mật khẩu được băm bằng scrypt với salt ngẫu nhiên riêng, lưu hash và salt ẩn mặc định trên model `AuthUser`.
2. Khi cấp phiên, sinh 32 byte ngẫu nhiên thành token hex 64 ký tự. DB chỉ lưu SHA-256 của token trong model `AuthSession` cùng `userId` và `expiresAt`.
3. Cookie tên `regression_sid`, path `/api/v1`, `HttpOnly`, `SameSite=Lax`, `Secure` khi production, thời hạn 7 ngày.
4. Middleware tự đọc cookie, kiểm tra token đúng dạng hex, tra phiên chưa hết hạn và gắn `req.user`, `req.sessionHash`.
5. Khi cấp token mới, xóa token cũ nếu middleware đã nhận ra nó. Logout xóa bản ghi phiên và cookie.

Schema không chỉ định tên collection; Mongoose suy ra từ tên model `AuthUser` và `AuthSession`. Session có TTL index trên `expiresAt`. Các tài khoản này không phải model `User`/collection `users` của module login.

## Giới hạn và kiểm soát có trong mã

- Register/login dùng bộ đếm trong bộ nhớ theo IP, giới hạn mặc định 10 lượt/15 phút; đăng nhập thành công xóa bộ đếm IP.
- Guest dùng khóa riêng `guest:<ip>`, giới hạn 100 lượt/15 phút.
- Middleware kiểm tra Origin ở request không phải GET/HEAD/OPTIONS, đồng thời từ chối `Sec-Fetch-Site: cross-site`.
- Allowlist đọc `CORS_ORIGINS`; mặc định cũ là `localhost:4200`, `localhost:4300`, `127.0.0.1:4300` qua HTTP, khác cấu hình hiện tại ở common.
- Lỗi service: 400 đầu vào sai; 401 đăng nhập sai; 409 email trùng; 429 quá lượt; middleware có thể trả 403.

Triển khai này không có role/status/sessionVersion, audit tài khoản, cơ chế quản lý hồ sơ hay bảo vệ admin cuối của hệ thống hiện tại. Bộ đếm nằm trong tiến trình nên không chia sẻ giữa nhiều instance và mất khi restart.

## Vai trò từng file và hướng đọc tiếp

| File | Vai trò |
|---|---|
| `auth.module.ts` | Định nghĩa hai schema trực tiếp, đăng ký controller/service/middleware toàn route |
| `auth.controller.ts` | Năm handler HTTP của triển khai cũ |
| `auth.service.ts` | scrypt, token, cookie, throttle và SessionMiddleware |

Để hiểu hành vi server đang chạy, đọc [login](../login/README.md), [users](../users/README.md) và [common](../common/README.md). Không dùng cookie `regression_sid` để gọi API yêu cầu phiên `hq3d.sid`.
