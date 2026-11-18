# Kế hoạch triển khai kiểm thử đơn vị (Unit Test) và kiểm thử hiệu năng với k6 cho Backend

> Thực hiện: Triển khai trực tiếp trong các thư mục riêng biệt dành cho kiểm thử đơn vị và kiểm thử hiệu năng; các công việc thuộc phạm vi repository vẫn được duy trì trên nhánh hiện tại.

**Mục tiêu:** Bổ sung các bài kiểm thử đơn vị có khả năng tái sử dụng và các kịch bản kiểm thử hiệu năng an toàn bằng Grafana k6 cho hệ thống API NestJS/Mongoose hiện tại.

**Kiến trúc:** Duy trì các tệp đặc tả (spec) Vitest hiện có tại `src/**/*.spec.ts`; thiết lập một trình chạy Jest riêng biệt, giới hạn phạm vi trong `test/unit/**/*.spec.ts`. Các tập lệnh, kịch bản, danh mục tài nguyên, nhật ký và tài liệu hướng dẫn cho k6 sẽ được đặt tại `test/performance/`. Đảm bảo hành vi của API và cơ sở dữ liệu không bị thay đổi.

**Công nghệ:** Jest + TypeScript transform, k6 (JavaScript), các tập lệnh tương thích với PowerShell 7, Markdown.

## Các ràng buộc chung

- Các thành phần mã nguồn và kiểm thử nằm trong thư mục `test/`.
- Không thay đổi các tuyến đường (routes), lược đồ (schemas), dịch vụ (services) của backend hoặc dữ liệu trong cơ sở dữ liệu.
- Các bài kiểm thử đơn vị phải sử dụng mock cho Mongoose; không kết nối với cơ sở dữ liệu MongoDB thực tế.
- Không tự ý tạo mới các endpoint hoặc payload; các chi tiết yêu cầu/phản hồi chưa rõ ràng cần được ghi chú lại.
- k6 chỉ được phép chạy trên môi trường `localhost`. Các bài kiểm thử dạng smoke, API hoặc kiểm thử tải (load test) ở chế độ chỉ đọc (read-only) chỉ được thực hiện khi backend phản hồi thành công; các kịch bản ghi/xóa dữ liệu yêu cầu phải có thông tin xác thực an toàn, dữ liệu hợp lệ và cơ chế dọn dẹp dữ liệu sau khi kiểm thử.
- Tập lệnh mặc định `run-all.ps1` không bao gồm các bài kiểm thử cường độ cao (stress test) hoặc kiểm thử bền bỉ (soak test); tuyệt đối không ghi lại thông tin xác thực (credentials) vào nhật ký.

## Các trọng tâm khi đánh giá

1. Cấu hình Jest không được bao gồm các tệp `src/**/*.spec.ts` hoặc các bài kiểm thử E2E; cần kiểm tra kỹ cấu hình trình chạy và số lượng bài kiểm thử.
2. Các yêu cầu về quyền sở hữu và cơ chế bảo vệ phiên làm việc (session guards) phải được phản ánh trong danh mục tài nguyên API; các trường hợp không thể xác thực phải được báo cáo là "không thực thi".
3. Các tập lệnh k6 phải mặc định từ chối các URL không thuộc môi trường cục bộ (non-local URLs) và yêu cầu xác nhận rõ ràng nếu muốn thực hiện kiểm thử với tải trọng cao hơn.
4. Các thao tác ghi dữ liệu không được phép nằm trong các đợt kiểm thử tải mặc định; không được xóa các bản ghi không phải do chính bài kiểm thử đó tạo ra. 5. Kết quả kiểm thử hiệu năng phải phân biệt rõ giữa các số liệu đo lường thực tế và các chỉ số CPU/MongoDB không khả dụng.

## Cấu trúc tệp tin

- `package.json`, `package-lock.json`, `jest.config.*`: tách biệt các tập lệnh (scripts) và phụ thuộc (dependencies) dành cho Jest.
- `test/unit/<module>/*.spec.ts`: kiểm thử đơn vị (unit test) sử dụng mock cho các controller, service và logic dùng chung (shared provider logic).
- `test/unit/README.md`, `test/README.md`: mô tả phạm vi, cấu trúc và các lệnh thực thi.
- `test/performance/docs/API-INVENTORY.md`: liệt kê các route, phương thức xác thực (auth), dữ liệu yêu cầu (payload), các lệnh gọi cơ sở dữ liệu và trạng thái khả dụng để chạy kiểm thử.
- `test/performance/scenarios/*.js`, `config/thresholds.js`: các kịch bản (scenarios) và ngưỡng (thresholds) cho k6.
- `test/performance/scripts/*.ps1`: các tập lệnh bao bọc (wrappers) an toàn để chạy kịch bản và xuất kết quả (artifacts).
- `test/performance/README.md`: hướng dẫn sử dụng trên Windows, các lưu ý về an toàn và phân tích kết quả.
- `test/performance/reports/`: chỉ chứa kết quả thực tế từ các lần chạy; không bao gồm các số liệu giả lập.
- `docs/changes/2026-11-18-unit-k6-testing.md`: ghi lại trạng thái sau khi triển khai, các bước kiểm tra và quy trình hoàn tác (rollback).

## Các nhiệm vụ

### Nhiệm vụ 1 — Bộ kiểm thử đơn vị (Unit test) với Jest

- Thiết lập/cấu hình Jest để hỗ trợ TypeScript với định dạng ESM mà không làm ảnh hưởng đến cơ chế phát hiện kiểm thử của Vitest.
- Bổ sung các bài kiểm thử trong thư mục `test/unit` cho các logic chính trong controller/service: experiments (bao gồm xác thực hàng loạt/xung đột dữ liệu), datasets, training runs, đồng bộ hóa (sync), xác thực/người dùng (auth/users), cùng các thành phần dùng chung (helpers/guard/config) nếu cần thiết.
- Sử dụng mock cho các thao tác Mongoose trong từng service; tránh các tác động phụ (side effects) lên MongoDB hoặc hệ thống tệp tin (filesystem) khi không nằm trong phạm vi kiểm thử.
- Xác minh bộ kiểm thử đơn vị Jest, bộ kiểm thử Vitest hiện có, độ bao phủ mã nguồn (coverage) và quá trình build/kiểm tra kiểu dữ liệu (type checking) của Nest.

### Nhiệm vụ 2 — Liệt kê API (Inventory) và xây dựng khung chạy kiểm thử an toàn cho k6

- Tổng hợp danh sách các route và phương thức HTTP thực tế từ các decorator và `configureApp`; ghi lại các yêu cầu về phiên làm việc (session), ràng buộc đối với body/header, dữ liệu phản hồi (status/body), cũng như các thông tin chưa xác định. - Triển khai các kịch bản API k6 smoke/read-only và các cấu hình baseline/load/stress/spike/soak tham số hóa với ngưỡng và các artifact JSON/Markdown cho mỗi lần chạy.

- Triển khai các wrapper PowerShell với kiểm tra backend/k6, localhost guard, URL/VUs/duration có thể cấu hình và thành phần `run-all` an toàn.

- Không chạy các endpoint gây biến đổi dữ liệu nếu không có tài khoản/bộ dữ liệu kiểm thử an toàn và đường dẫn dọn dẹp đáng tin cậy.

### Nhiệm vụ 3 — Tài liệu và bàn giao

- Hoàn thiện README tiếng Việt cho các bộ kiểm thử đơn vị và hiệu năng cũng như README kiểm thử cấp cao nhất.

- Chạy các xác minh an toàn; ghi lại chính xác các trạng thái KHÔNG CHẠY/BỊ CHẶN/KHÔNG KẾT LUẬN và chỉ báo cáo các điểm nghẽn đã đo được khi có các phép đo thực tế.

- Cập nhật báo cáo thay đổi đã cam kết trước đó với việc triển khai, kiểm tra, hạn chế và hoàn tác.