# Unit testing

Unit test của backend dùng Vitest và hiện được đặt gần source tại `src/**/*.spec.ts`; `vitest.config.ts` đã chỉ định đúng pattern này. Vì vậy không di chuyển hoặc nhân bản test sang đây để tránh chạy trùng.

Chạy bằng `npm test`, hoặc coverage bằng `npm run test:cov`.
﻿# Unit testing

Unit test xác minh logic của service, controller và helper mà không khởi động HTTP server hay kết nối MongoDB. Các truy vấn Mongoose được mock theo đúng phương thức mà service dùng (`exec`, `populate`, `sort`, `skip`, `limit`); các nhánh mật khẩu dùng bcrypt thật với hash cost thấp để kiểm tra so sánh password.

Jest được dùng vì đây là runner yêu cầu cho bộ unit test này. Repo giữ nguyên các spec Vitest ở `src/**/*.spec.ts`; bộ Jest riêng nằm tại `test/unit/` và chạy tách biệt để không quét trùng spec hoặc biến unit test thành E2E.

## Cấu trúc và phạm vi hiện có

- `shared/`: CSV validator, pagination, owner scoping, allowlist dữ liệu và synthetic config.
- `modules/datasets/`: tạo metadata, phân trang, tìm theo owner, xóa mềm và controller delegation.
- `modules/experiments/`: create/validation, phân trang/populate, cập nhật không cho đổi dataset, bulk duplicate-id guard và controller delegation.
- `modules/training-runs/`: tạo, kiểm tra experiment, phân trang/filter và controller delegation.
- `modules/sync/`: batch validation, idempotency replay, dataset create và controller delegation.
- `modules/login/`: audit field allowlist, register/duplicate email và active/inactive authentication.
- `modules/users/`: profile/session version, password change, delete-account cascade, last-admin protection và controller response.
- `common/`: AuthGuard public bypass, active session match và stale/disabled session rejection.

Chưa được cover đầy đủ: upload/download CSV qua filesystem, mọi nhánh sync cho từng entity/action, toàn bộ lỗi Mongoose/validation và mọi controller action, đặc biệt là các handler của `LoginController` (import phụ thuộc `@nestjs/throttler` gây ESM cycle trong runner hiện tại). Các mức coverage thực tế phải được lấy từ lệnh coverage bên dưới.

## Chạy

Từ thư mục repo:

```powershell
npm.cmd run test:unit
npm.cmd run test:unit -- --runInBand
npm.cmd run test:unit:cov
```

Jest chỉ tìm `test/unit/**/*.spec.ts`. `npm.cmd test` tiếp tục chạy spec Vitest trong `src/`; E2E vẫn riêng bằng `npm.cmd run test:e2e`.

## Coverage và giới hạn

Coverage đo statements, branches, functions và lines của source được chọn trong cấu hình Jest. Mocks xác minh đầu vào/đầu ra và truy vấn được gọi; chúng không chứng minh MongoDB thật, session store hoặc filesystem hoạt động. Test controller gọi trực tiếp handler nên không xác minh HTTP status thực tế; status được quy định bởi decorator Nest và cần kiểm tra trong API inventory.

## Coverage tham chiếu

Lần chạy hiện tại (`npm.cmd run test:unit:cov -- --runInBand`): 15 suites, 64 tests PASS. Coverage toàn bộ các file `src/**/*.ts` được chọn là Statements 57.81%, Branches 46.65%, Functions 49.30%, Lines 59.69%. Đây thấp hơn mục tiêu tham khảo ban đầu; các phần còn thiếu tập trung ở `SyncService`, `ExperimentsService` (bulk branches), `DatasetsService` (upload/file storage), `LoginController`, AppController, cấu hình session/app và một số nhánh provider/config. Báo cáo HTML/LCOV/JSON được ghi tại `coverage/jest-unit/`; các chỉ số sẽ thay đổi khi bổ sung test.
