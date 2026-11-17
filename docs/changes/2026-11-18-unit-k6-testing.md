# Báo cáo thay đổi: unit-k6-testing

## Trạng thái trước khi sửa

- Ngày ghi nhận: 2026-11-18.
- Nhánh: `restructure-src`; working tree sạch trước thay đổi.
- Backend NestJS + MongoDB có các module: datasets, experiments, training-runs, sync, login và users; ứng dụng còn có AppController/AppService, config, common guards và shared helpers.
- Runner hiện tại là Vitest 4 (`npm test`), chỉ quét `src/**/*.spec.ts`; E2E được cấu hình riêng trong `vitest.config.e2e.ts`. Có spec cho app, experiments, config/session, config/upload và csv-validator; `test/unit/README.md` tồn tại nhưng chưa có unit specs tại `test/unit`.
- Không có cấu hình hoặc dependency Jest. Không thay runner để tránh làm hỏng workflow và chạy trùng test.
- k6 đã cài: v2.3.0 (Windows amd64).
- Baseline ban đầu chưa chạy unit/coverage/performance trong lượt này. Chưa biết backend/MongoDB đang chạy hay có dữ liệu test an toàn.

## Phạm vi dự kiến

- Tiếp tục khảo sát controller/service/DTO/schema/config và các API thực tế.
- Bổ sung unit tests thuần Vitest, mock dependency và không kết nối MongoDB thật.
- Tạo API inventory và kịch bản k6 an toàn, cấu hình qua biến môi trường; stress/soak chạy riêng và không đưa vào run-all mặc định.
- Viết tài liệu tiếng Việt, ghi rõ endpoint chưa thể kiểm thử và kết quả thực tế.
- Không sửa nghiệp vụ backend, không thêm E2E/integration/security suite, không chạy tải ghi dữ liệu lên môi trường chưa xác nhận an toàn.

## Trạng thái sau khi triển khai

- Chưa triển khai. Sẽ cập nhật sau khi hoàn tất, gồm file đã đổi, lệnh kiểm tra và kết quả thực tế.

## Kiểm tra đã chạy

- Đọc cấu hình Vitest, TypeScript, Nest CLI và AppModule.
- Liệt kê source/test/docs; xác nhận `k6 version` trả về v2.3.0.
- Chưa chạy test/build/coverage hoặc gọi endpoint.

## Cách hoàn tác

- Báo cáo này được commit riêng làm mốc trước khi sửa.
- Có thể hoàn tác commit triển khai sau đó bằng `git revert <commit-id>`; không xóa dữ liệu MongoDB.
- Báo cáo này có thể được giữ lại như nhật ký thay đổi; nếu cần bỏ riêng báo cáo trước khi có commit triển khai, revert commit báo cáo.

## Kết quả khảo sát bổ sung trước triển khai

- Unit baseline chạy bằng `npm.cmd test -- --reporter=dot`: 6 test files PASS, 38 tests PASS, không có FAIL/SKIP.
- API controller tìm thấy: root/health; experiments (create, bulk, list, detail, patch, delete); auth (register, login, logout, me); users (me read/create/password/delete); datasets (upload, create, list, detail, download, delete); training-runs (create, list, detail); sync (batch, changes). Prefix/policy chi tiết cần dựa trên decorators và configureApp khi hoàn tất inventory.
- `k6.exe v2.3.0` có sẵn. Chưa xác minh backend/MongoDB đang chạy; chưa phát sinh HTTP request hay thao tác ghi/xóa dữ liệu.
- Báo cáo này chưa thể commit: thao tác `git add` bị hệ thống từ chối cấp quyền ghi `.git/index` sau khi yêu cầu escalation bị reject. Vì AGENTS.md bắt buộc commit báo cáo trước khi sửa code, không có code/test harness nào được thêm trong lượt này.
