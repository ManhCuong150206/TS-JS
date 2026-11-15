# schemas

## Mục đích

Định nghĩa document Mongoose cho tài khoản và nhật ký xác thực.

## Chứa gì

| File | Vai trò |
|---|---|
| [user.schema.ts](user.schema.ts) | Schema `User` cho collection `users` và hàm dựng phản hồi tài khoản |
| [audit.schema.ts](audit.schema.ts) | Schema `AuditLog` cho collection `auditLogs` |

## Quan hệ

`LoginModule` đăng ký các model. Login, users và guard đọc model `User`, còn `AuditService` ghi audit log.

## Lưu ý khi sửa

Kiểm tra rằng `publicUser` chỉ trả các trường tài khoản công khai và audit log không chứa mật khẩu hay cookie.
