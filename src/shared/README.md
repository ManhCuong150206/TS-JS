# shared

## Mục đích

Chứa các hàm hỗ trợ được dùng lại trong các module.

## Chứa gì

| File | Vai trò |
|---|---|
| [helpers/](helpers/README.md) | Kiểm tra CSV, quyền sở hữu, phân trang và cấu hình dữ liệu tổng hợp |

## Quan hệ

Các controller và service trong `modules/` nhập helper trực tiếp theo đường dẫn tương đối.

## Lưu ý khi sửa

Import tương đối dùng đuôi `.js` theo cấu hình ESM của dự án.
