# modules

## Mục đích

Chứa các module nghiệp vụ mà AppModule nạp.

## Chứa gì

| File | Vai trò |
|---|---|
| [login/](login/README.md) | Đăng ký, đăng nhập, đăng xuất và audit |
| [users/](users/README.md) | Hồ sơ cá nhân, mật khẩu và xóa tài khoản |
| [datasets/](datasets/README.md) | Metadata, upload và tải CSV |
| [experiments/](experiments/README.md) | Thí nghiệm và lưu lô snapshot |
| [training-runs/](training-runs/README.md) | Kết quả và lịch sử huấn luyện |
| [sync/](sync/README.md) | Ghi theo lô và đọc thay đổi |

## Quan hệ

[AppModule](../app.module.ts) nạp sáu module. Controller nhận HTTP, service xử lý nghiệp vụ và schema mô tả dữ liệu MongoDB.

## Lưu ý khi sửa

Khi đổi một hợp đồng HTTP, đối chiếu controller, DTO và nơi gọi tương ứng.
