# dto

## Mục đích

Định nghĩa dữ liệu đầu vào cho các thao tác tài khoản cá nhân.

## Chứa gì

| File | Vai trò |
|---|---|
| [users.dto.ts](users.dto.ts) | Định nghĩa `UpdateProfileDto`, `ChangePasswordDto` và `DeleteAccountDto` |

## Quan hệ

`UsersController` dùng các DTO để nhận yêu cầu sửa hồ sơ, đổi mật khẩu và tự xóa tài khoản.

## Lưu ý khi sửa

Khi sửa trường mật khẩu, đối chiếu kiểm tra độ dài theo byte và yêu cầu xác nhận mật khẩu trong service.
