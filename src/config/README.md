# config

## Mục đích

Tập trung cấu hình HTTP, MongoDB, phiên đăng nhập và upload của backend.

## Chứa gì

| File | Vai trò |
|---|---|
| [configure-app.ts](configure-app.ts) | Đăng ký tiền tố API, CORS, kiểm tra header ghi, session và giới hạn JSON |
| [database.config.ts](database.config.ts) | Chọn URI MongoDB và kiểm tra tên cơ sở dữ liệu test |
| [session.config.ts](session.config.ts) | Cấu hình cookie, session store và thao tác lưu/hủy phiên |
| [session.config.spec.ts](session.config.spec.ts) | Kiểm tra cấu hình phiên và URI MongoDB cho test |
| [upload.config.ts](upload.config.ts) | Cấu hình upload CSV và giới hạn kích thước tệp |
| [upload.config.spec.ts](upload.config.spec.ts) | Kiểm tra giới hạn upload và tệp CSV |

## Quan hệ

`main.ts` và bộ e2e gọi `configureApp`. `AppModule` lấy URI qua `mongoUri`, còn `DatasetsModule` đăng ký cấu hình upload.

## Lưu ý khi sửa

Khi chạy với `NODE_ENV=test`, URI MongoDB phải trỏ tới `hoi-quy-3d-test`. Đối chiếu cấu hình phiên và các ca HTTP liên quan khi thay đổi biến môi trường.
