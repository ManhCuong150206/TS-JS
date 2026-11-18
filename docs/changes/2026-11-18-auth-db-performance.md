# Báo cáo thay đổi: auth-db-performance

## Trạng thái trước khi sửa

- Ngày ghi nhận: 2026-11-18.
- Branch: `restructure-src`.
- Bộ Jest/k6 trước đó đã triển khai; unit checks/build gần nhất đã PASS (Jest 15 suites/64 tests, Vitest 6 files/38 tests).
- k6 hiện chỉ đo root/health và các GET session nếu người chạy tự cấp cookie. Chưa có lifecycle fixture tự động cho login, truy vấn MongoDB qua API hoặc thao tác ghi/xóa.
- k6 đã chạy localhost với stress/spike/soak thăm dò; CPU/RAM và một snapshot MongoDB đã được ghi nhận. Chưa chạy DB-backed API trong k6.
- Người dùng vừa xác nhận `hoi-quy-3d` là database test cô lập và cho phép tạo/dọn dữ liệu do bài test tạo.
- Backend dùng session cookie; register/login tạo user/session/audit. `DELETE /api/v1/users/me` yêu cầu mật khẩu, xóa user, soft-delete dữ liệu sở hữu và ghi audit event. Dataset metadata có thể được tạo qua API, sau đó đọc và soft-delete theo ID/clientId.
- Chưa có thay đổi code thuộc phần gia hạn này.

## Phạm vi dự kiến

- Thêm k6 workflow opt-in để đăng ký tài khoản tạm duy nhất, đăng nhập, đo auth và gọi API đọc/ghi/xóa dataset metadata với dữ liệu test nhận diện được.
- Cleanup bằng API của ứng dụng trong khối `finally`, chỉ xóa tài khoản test do chính lượt chạy tạo; tài khoản sẽ dọn các document sở hữu. Không dùng lệnh trực tiếp xóa database/collection.
- Ghi nhận rõ audit log có thể còn lại như side-effect theo thiết kế backend; không xóa audit bằng truy vấn trực tiếp.
- Thêm guard xác nhận rõ cho workflow ghi và localhost-only, báo cáo không chứa password/cookie, cập nhật hướng dẫn/lệnh chạy.
- Chạy kịch bản an toàn ở tải thấp trước; nếu setup/cleanup không xác minh được, dừng và không gọi mutation tiếp.
- Không sửa `src/`, API, schema, nghiệp vụ hoặc database config.

## Cách hoàn tác

- Báo cáo này được tạo và commit riêng trước mọi sửa đổi code theo `AGENTS.md`.
- Sau khi triển khai, hoàn tác phần code bằng revert commit triển khai hoặc khôi phục các file kiểm thử được liệt kê ở phần trạng thái sau.
- Test workflow dọn tài khoản và dataset riêng do nó tạo qua API; không cần drop database/collection. Nếu bị ngắt giữa setup và cleanup, dùng báo cáo run để xác định email test (không ghi password) và dọn qua tài khoản/session test hoặc hướng dẫn vận hành, không xóa rộng theo prefix.

## Trạng thái sau khi sửa

- Báo cáo trạng thái trước khi sửa đã được commit riêng bằng `9a4db42` trước khi chỉnh code.
- Thêm `test/performance/scenarios/database.js` và `scripts/run-database.ps1`; mở rộng `scripts/run.ps1` với profile database, fixture kiểm soát và report parser.
- Workflow giới hạn 1–3 VU, 5–60 giây, yêu cầu `-ConfirmTestDataWrites`, Base URL localhost và Mongo connection localhost. Tài khoản được tạo ngẫu nhiên, không ghi password/session; chỉ cleanup tài khoản/fixtures do lượt test tạo qua API.
- Runner lấy Windows CPU/RAM/working set hàng giây trong lúc chạy và MongoDB `serverStatus` trước/sau, lưu `resource-samples.json` và `mongo-snapshots.json`. Các metrics không quy đổi thành query latency; counters là cumulative toàn MongoDB server.
- Cập nhật README, API inventory, tổng hợp performance và báo cáo thay đổi ban đầu. Không sửa `src/`, API, schema, logic backend hoặc database config.
- k6 DB API monitored smoke cuối (1 VU, 5 giây): 117 requests, 23 dataset create/soft-delete, avg 5.91 ms, p95 6.26 ms, p99 7.52 ms, lỗi 0%, checks 100%, cleanup PASS. Artifact `test/performance/reports/20261118-020946-database/`.
- k6 DB API concurrency monitored (3 VU, 15 giây): 1,007 requests, 201 dataset create/soft-delete, avg 5.04 ms, p95 7.98 ms, p99 10.10 ms, lỗi 0%, checks 100%, cleanup PASS. Artifact `test/performance/reports/20261118-020453-database/`.
- Trong concurrency: 8 samples CPU trung bình 11.82%, max 20.20%, RAM khả dụng thấp nhất 1,878 MB; Mongo connections current/active 15/3 trước/sau, rejected 0, resident 59→60 MB. OPCounters delta được ghi trong artifact/tổng hợp, không coi là số truy vấn API chính xác.
- K6 summary từng chứa cookie trong setup data; artifact đầu đã redacted thủ công, runner nay tự redacts trường cookie trước khi ghi summary. Quét artifacts không tìm thấy cookie/password.

## Kiểm tra đã chạy

- Fixture probe: register/login, datasets list/create/detail/delete và account cleanup đều thành công; credentials ngẫu nhiên, không ghi ra log.
- `run-database.ps1` thực chạy các profile 1 VU/5s và 3 VU/15s; tất cả k6 thresholds/checks PASS, cleanup PASS. Lượt cuối sau khi thêm Mongo localhost guard cũng PASS.
- `k6 inspect` profile database: PASS; xác nhận default 1 VU/15s.
- Windows PowerShell parser: 10/10 scripts PASS.
- `npm.cmd run lint`: exit 0; còn warning pre-existing tại `src/modules/experiments/experiments.service.ts:343`.
- `npx.cmd tsc --noEmit`: PASS.
- Prettier check các file unit/performance/docs liên quan: PASS; `git diff --check`: PASS.
- Secret scan các reports: không có session cookie/password/env credential.
- Unit Jest/Vitest và build không chạy lại ở phần gia hạn này; kết quả gần nhất trước đó đã có trong báo cáo `unit-k6-testing` và không có thay đổi `src/`.

## Cách hoàn tác sau sửa

- Chỉ hoàn tác code/harness này bằng cách xóa `test/performance/scenarios/database.js`, `test/performance/scripts/run-database.ps1` và khôi phục `test/performance/scripts/run.ps1`, README/API inventory/report files; không chạm `src/` hoặc database.
- Chạy workflow đã xác nhận cleanup thành công ở mọi lượt; audit events là backend side-effect có thể còn lại. Không drop database/collection.
