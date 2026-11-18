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
- Bổ sung unit tests Jest tách khỏi Vitest, mock Mongoose và không kết nối MongoDB thật.
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

## Trạng thái sau khi triển khai

- Báo cáo baseline được commit riêng trước khi sửa bằng commit `1117bb0` (`docs: record unit and k6 testing baseline`).
- Jest 30 + ts-jest được cài đặt bằng dev dependencies và cấu hình trong `jest.config.cjs`; chỉ quét `test/unit/**/*.spec.ts`. Vitest hiện có và E2E config vẫn giữ riêng.
- Có 15 Jest suites / 64 tests cho datasets, experiments, training-runs, sync, login/users, AuthGuard, AuditService, CSV validator và helpers; Mongoose được mock, không mở kết nối database.
- Coverage hiện tại: Statements 57.81%, Branches 46.65%, Functions 49.30%, Lines 59.69%. Các mục tiêu tham khảo 80/70 chưa đạt; README liệt kê vùng còn thiếu.
- Đã thêm API inventory theo controller/config thật, k6 scenario/read-only endpoints, thresholds, PowerShell runners, báo cáo Markdown/JSON và hướng dẫn tiếng Việt.
- Không sửa `src/`, schema, API hoặc nghiệp vụ backend. Không thực hiện thao tác ghi/xóa DB.

## Kiểm tra sau triển khai

- `npm.cmd test -- --reporter=dot`: PASS, 6 Vitest files / 38 tests.
- `npm.cmd run test:unit -- --runInBand`: PASS, 15 Jest suites / 64 tests.
- `npm.cmd run test:unit:cov -- --runInBand`: PASS; Statements 57.81%, Branches 46.65%, Functions 49.30%, Lines 59.69%.
- `npx.cmd tsc --noEmit`: PASS.
- `npm.cmd run build`: PASS.
- `npm.cmd run lint`: exit code 0; còn một warning backend đã có tại `src/modules/experiments/experiments.service.ts:343` về chuyển `fields.status` sang chuỗi. Không sửa vì ngoài phạm vi.
- `npx.cmd prettier --check ...`: PASS với các file unit/performance/docs đã chọn.
- `git diff --check`: PASS.
- Windows PowerShell parser: 10/10 script trong `test/performance/scripts` parse được; script cần BOM UTF-8 cho Windows PowerShell 5.1.
- `k6 inspect -e PERF_PROFILE=baseline`: xác nhận scenario 1 → 5 → 10 VU và thresholds.
- k6 smoke cuối (localhost, 1 VU, 5 giây): PASS; 50 requests, checks 100%, errors 0%, p95 2.19 ms, p99 2.91 ms. Artifact: `test/performance/reports/20261118-012137-smoke/`.
- `run-all.ps1` (localhost; stage 5 giây; API 5 giây; low load tối đa 5 VU): smoke, baseline, API read-only và load đều PASS. Số đo và giới hạn ở `test/performance/reports/2026-11-18-run-all-summary.md`.
- Tại thời điểm bàn giao ban đầu, stress/spike/soak chưa chạy. Sau đó chạy thêm thăm dò giới hạn: stress tối đa 10 VU trong 7.34 giây, spike tối đa 10 VU trong 27.36 giây và soak 5 VU trong 30.35 giây; ba lần đều PASS threshold với error rate 0%, checks 100%. Kết quả chỉ áp dụng cho GET root/health và không đại diện bài stress/soak đầy đủ.
- Ban đầu chưa có số liệu tài nguyên. Sau đó giám sát lượt soak public 5 VU trong 30 giây (1,490 request, p95 1.98 ms, lỗi 0%). 20 mẫu Windows counter: CPU tổng trung bình 12.53%, max 28.97%, RAM khả dụng thấp nhất 2,889 MB; 12 tiến trình Node tổng working set 302.8 MB, `mongod` 49.7 MB. Giá trị Node là tổng các tiến trình Node trong máy, không tách riêng backend.
- Snapshot MongoDB 9.0.4 sau lượt public: 12 connections, 3 active, 204,829 available, 0 rejected, resident memory 49 MB. Đây không phải phép đo DB dưới tải vì root/health không đọc collection. Không có `mongosh`; dùng driver Mongoose sẵn có và lệnh admin `serverStatus` chỉ đọc.
- Người dùng xác nhận database `hoi-quy-3d` là test cô lập và cho phép tạo/dọn dữ liệu test. Thêm opt-in `run-database.ps1`, giới hạn 1–3 VU và 5–60 giây; yêu cầu `-ConfirmTestDataWrites`, chỉ cho phép localhost.
- k6 DB API smoke (1 VU, 5 giây, monitored): 117 requests, 23 datasets tạo/soft-delete, avg 6.20 ms, p95 7.39 ms, p99 7.72 ms, lỗi 0%, checks 100%; cleanup account PASS. Artifact `test/performance/reports/20261118-020420-database/`.
- k6 DB API concurrency (3 VU, 15 giây, monitored): 1,007 requests, 201 datasets tạo/soft-delete, avg 5.04 ms, p95 7.98 ms, p99 10.10 ms, lỗi 0%, checks 100%; cleanup account PASS. Artifact `test/performance/reports/20261118-020453-database/`. Một lượt 3 VU trước đó cũng PASS và có report riêng.
- Trong lượt concurrency monitored: 8 Windows samples, CPU tổng trung bình 11.82%, đỉnh 20.20%, RAM khả dụng thấp nhất 1,878 MB; Node processes tổng working set 605.4–612.9 MB, `mongod` 59.6–60.2 MB. Node values không tách riêng backend.
- MongoDB `serverStatus` trước/sau lượt concurrency: 15 connections, 3 active ổn định, rejected 0, resident memory 59→60 MB; cumulative opcounters delta insert +203, query +2,616, update +1,208, delete +2, command +12, aggregate +201. Counters là toàn server, có thể gồm monitor và local activity khác; không phải thời gian query.
- Mỗi lượt k6 có một login/logout sample; login 280.39 ms trong concurrency (một mẫu, không đủ kết luận percentile). Registration/bootstrap login và xóa account fixture đo riêng bằng PowerShell. Password/session không được lưu trong report; audit events do backend tạo có thể còn lại.
- Summary k6 lượt đầu ban đầu chứa cookie trong `setup_data`; đã redacted artifact đó và thêm bước redaction tự động trong runner. Quét report artifacts không còn cookie/password.
- Đã xác minh API bằng fixture probe trước khi viết harness: register/login, GET datasets, POST dataset, GET detail, DELETE dataset và DELETE account đều thành công.
- Experiment, training-run, sync, upload/download, profile/password updates vẫn NOT RUN do chưa có fixture/cleanup riêng. Resource samples đã đồng thời với dataset DB workload nhưng chưa đo event-loop, disk I/O hoặc query profiler; không thể kết luận bottleneck từ lượt ngắn này.

## Cách hoàn tác

- Khi phần triển khai được commit, dùng `git revert <implementation-commit>` để đảo ngược; giữ commit báo cáo baseline `1117bb0` làm nhật ký.
- Nếu cần hoàn tác trước commit, rà soát `git status`/`git diff`, khôi phục package scripts/dependencies, xóa `jest.config.cjs` và các file vừa thêm dưới `test/unit`/`test/performance`; giữ lại báo cáo baseline theo nhu cầu repo.
- Bốn lượt database k6 cleanup account qua API và soft-delete dataset fixtures; audit events có thể còn lại. Không cần drop database/collection để hoàn tác.
