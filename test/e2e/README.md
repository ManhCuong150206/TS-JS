# e2e

Dùng cho kiểm thử gọi API thật qua HTTP. Đặt tên `*.e2e-spec.ts` và chạy `npm run test:e2e` từ gốc repo. [Cấu hình Vitest e2e](../../vitest.config.e2e.ts) tìm các spec theo mẫu `test/**/*.e2e-spec.ts`, gồm cả thư mục này.

Bộ e2e cần MongoDB. [Bộ kiểm thử hiện có](../app.e2e-spec.ts) tạo MongoDB tạm bằng `mongodb-memory-server`. Khi `NODE_ENV=test`, [database.config.ts](../../src/config/database.config.ts) yêu cầu URI trỏ tới database `hoi-quy-3d-test`.

Request ghi (`POST`, `PATCH`, `PUT`, `DELETE`) cần header `X-Requested-With: XMLHttpRequest` theo [configure-app.ts](../../src/config/configure-app.ts).
