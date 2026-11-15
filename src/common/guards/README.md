# guards

## Mục đích

Chứa guard xác thực và các decorator lấy thông tin phiên ở controller.

## Chứa gì

| File | Vai trò |
|---|---|
| [auth.guard.ts](auth.guard.ts) | Kiểm tra phiên, tài khoản và phiên bản phiên, cung cấp `Public`, `CurrentUser` và `RequestUser` |

## Quan hệ

`LoginModule` đăng ký `AuthGuard` toàn cục. Guard dùng schema `User` từ module login và thao tác hủy phiên từ `config/`.

## Lưu ý khi sửa

Khi thay đổi xác thực, kiểm tra cả endpoint công khai lẫn endpoint yêu cầu cookie `hq3d.sid`.
