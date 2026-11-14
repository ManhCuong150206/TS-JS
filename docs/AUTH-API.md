# API đăng nhập và tài khoản

Base URL local: `http://localhost:3000/api/v1`. Angular: `http://localhost:4200`.
Cookie `hq3d.sid` chứa session ID đã ký; dữ liệu phiên ở MongoDB, không dùng JWT.
Mật khẩu được băm bằng bcrypt với cost 12.
Cookie HttpOnly, SameSite=Lax, thời hạn 7 ngày. FE không đọc cookie và không lưu token.

> Cập nhật sau khi dọn route cũ ngày 14/11/2026. Hợp đồng hiện tại theo LoginController và UsersController.

## Endpoint

`User` = `{ _id, email, displayName, role, status, createdAt, updatedAt }`.
Không có passwordHash/sessionVersion. Ngày là chuỗi ISO.
Tất cả đường dẫn dưới đây được ghép với base URL.

| Method | Đường dẫn          | Body / query                  | Response                                | Quyền        | Lỗi             |
| ------ | ------------------ | ----------------------------- | --------------------------------------- | ------------ | --------------- |
| POST   | /auth/register     | {email,password,displayName}  | 201 User                                | Công khai    | 400,403,409,429 |
| POST   | /auth/login        | {email,password}              | 200 User + Set-Cookie                   | Công khai    | 400,401,403,429 |
| POST   | /auth/logout       | Không                         | 200 {success:true}, xóa cookie          | Đã đăng nhập | 401,403         |
| GET    | /auth/me           | Không                         | 200 User                                | Đã đăng nhập | 401             |
| GET    | /users/me          | Không                         | 200 User                                | Đã đăng nhập | 401             |
| POST   | /users/me          | {displayName}                 | 200 User                                | Chính mình   | 400,401,403     |
| POST   | /users/me/password | {currentPassword,newPassword} | 200 User                                | Chính mình   | 400,401,403     |
| DELETE | /users/me          | {password}                    | 200 {success:true}, xóa cookie          | Chính mình   | 400,401,403     |

- Email trim + lowercase; mật khẩu tối thiểu 8 ký tự, tối đa 72 byte UTF-8; displayName sau trim dài 1–120.
- Register bỏ qua riêng `role` và `ownerId`; các trường lạ khác trả 400. Register **không tự đăng nhập**.
- Login/register giới hạn mỗi endpoint 5 request/phút/IP, tính cả request thành công.
- `role`: `user | admin`; `status`: `active | disabled`. Email không sửa qua API này.
- Đổi mật khẩu giữ session đang gọi và vô hiệu hóa session khác. Controller không công bố API đổi role/status của tài khoản khác.
- Xóa user: khóa và tăng version, xóa mềm datasets/experiments/trainingRuns rồi xóa thật user. Tệp CSV vẫn được giữ trên ổ đĩa nhưng không tải được qua API.
- Admin active cuối cùng không được tự xóa, trả 400. Admin có quyền trên tài nguyên dữ liệu mọi user; không có route quản trị tài khoản khác.
- GET / và GET /health công khai. Mọi API khác cần session; header x-user-id/Bearer không cấp quyền.
- Dữ liệu không thuộc user trả 404. ownerId trong payload bị bỏ qua; cập nhật bằng admin vẫn giữ chủ sở hữu đã lưu.
- Sync/batch giữ response cũ: từng operation bị từ chối nằm trong `results[].status = "error"`, không trả snapshot người khác. HTTP 401 là phiên hết hiệu lực của cả batch. Sync/changes có tombstone `deletedAt` để FE xóa bản sao offline.

Lỗi mặc định Nest có `statusCode`, `message` và có thể thêm `error`; message validation có thể là mảng.
400: dữ liệu sai; 401: cần đăng nhập/sai mật khẩu; 403: không đủ quyền/thiếu CSRF header/origin bị chặn;
404: không tìm thấy/không thuộc mình; 409: email trùng; 429: quá giới hạn.
Sai email hoặc mật khẩu cùng trả `"Email hoặc mật khẩu không đúng"`, kể cả tài khoản disabled.

## Angular

Mọi request tới API cần `withCredentials: true`. Mọi POST/PATCH/PUT/DELETE, kể cả
login/register/logout/upload/sync, cần `X-Requested-With: XMLHttpRequest`.
Header tùy biến khiến trình duyệt preflight; server chỉ cho origin trong CORS allowlist.
Localhost:4200 và localhost:3000 khác origin nhưng cùng site nên SameSite=Lax phù hợp.

Ví dụ interceptor (chỉ là tài liệu, không sửa frontend):

```ts
import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

const API = 'http://localhost:3000/api/v1';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  if (!(req.url === API || req.url.startsWith(API + '/'))) return next(req);
  const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  const secured = req.clone({
    withCredentials: true,
    ...(mutating
      ? { setHeaders: { 'X-Requested-With': 'XMLHttpRequest' } }
      : {}),
  });
  return next(secured).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Tại đây cũng xóa trạng thái user và tạm dừng hàng đợi sync của app.
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
```

Đăng ký interceptor qua `provideHttpClient(withInterceptors([authInterceptor]))`.
Lúc khởi động gọi `GET /auth/me`: 200 khôi phục user; 401 chuyển sang đăng nhập.
Hàng đợi sync offline phải dùng HttpClient có interceptor, dừng retry khi 401 và chỉ tiếp tục
sau khi xác nhận đúng user đăng nhập lại. Phân vùng dữ liệu offline theo userId để không
đẩy hàng đợi của tài khoản cũ sang tài khoản mới.

Khi dùng HttpClient với URL tuyệt đối, cần tự gắn header ghi như ví dụ. FE hiện dùng fetch trong AuthSession và tự gắn header tương ứng.
Không đặt Content-Type thủ công khi upload FormData; browser tự thêm multipart boundary.
Không cần gửi Authorization. FE không tự thêm `Cookie`; browser quản lý.

## Ví dụ request/response

Các request sau chạy được với cookie jar (thay email nếu đã đăng ký). ID/ngày dưới đây minh họa;
response thực tế lấy ID/ngày do MongoDB sinh.

```http
POST /api/v1/auth/register
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{"email":"linh@example.com","password":"example-password-123","displayName":"Linh"}
```

```json
{
  "_id": "690d10000000000000000001",
  "email": "linh@example.com",
  "displayName": "Linh",
  "role": "user",
  "status": "active",
  "createdAt": "2026-11-07T08:00:00.000Z",
  "updatedAt": "2026-11-07T08:00:00.000Z"
}
```

Status 201; chưa có session đăng nhập.

```http
POST /api/v1/auth/login
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{"email":"linh@example.com","password":"example-password-123"}
```

Status 200, body cùng User phía trên. Server gửi
`Set-Cookie: hq3d.sid=<signed-session-id>; Path=/; Expires=<7 ngày>; HttpOnly; SameSite=Lax`
(thêm Secure ở production). Giá trị session thật không đưa vào tài liệu.

```http
GET /api/v1/auth/me
Cookie: hq3d.sid=<cookie đã nhận khi login>
```

Status 200, body cùng User phía trên. Không có cookie hợp lệ: 401,
`{"statusCode":401,"message":"Vui lòng đăng nhập","error":"Unauthorized"}`.

```http
POST /api/v1/auth/logout
X-Requested-With: XMLHttpRequest
Cookie: hq3d.sid=<cookie đã nhận khi login>
```

Status 200, body `{"success":true}`; server xóa session và gửi cookie hết hạn.
Gọi me sau đó trả 401.
