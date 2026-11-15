# test

Thư mục dùng để tổ chức các kiểm thử backend. [Unit test](unit/README.md) kiểm tra từng service hoặc helper. [E2E](e2e/README.md) gửi HTTP qua ứng dụng NestJS và kiểm tra các thành phần làm việc cùng nhau với MongoDB.

Chạy các lệnh dưới đây từ gốc repo. [package.json](../package.json)

| Lệnh | Phạm vi hiện tại |
|---|---|
| `npm test` | Chạy một lượt các file `src/**/*.spec.ts` |
| `npm run test:watch` | Theo dõi thay đổi với cấu hình unit của Vitest |
| `npm run test:cov` | Chạy unit test kèm báo cáo độ bao phủ |
| `npm run test:debug` | Chạy Vitest với Node inspector |
| `npm run test:e2e` | Chạy các file `test/**/*.e2e-spec.ts` |

Bộ e2e hiện có nằm tại [app.e2e-spec.ts](app.e2e-spec.ts). Hai script `.mjs` ở thư mục này hỗ trợ chạy và dọn dẹp backend cho browser test.
