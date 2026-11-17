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

- Chưa triển khai; sẽ cập nhật sau khi hoàn tất và xác minh.

## Kiểm tra đã chạy

- Chưa chạy.
