# dto

## Mục đích

Định nghĩa dữ liệu đăng ký và đăng nhập.

## Chứa gì

| File | Vai trò |
|---|---|
| [auth.dto.ts](auth.dto.ts) | Định nghĩa `LoginDto`, `RegisterDto` và pipe bỏ trường đặc quyền khi đăng ký |

## Quan hệ

`LoginController` dùng các DTO và pipe khi nhận request đăng ký, đăng nhập.

## Lưu ý khi sửa

Giữ các quy tắc kiểm tra email, độ dài mật khẩu theo byte và lọc trường đặc quyền đồng bộ với luồng đăng ký.
