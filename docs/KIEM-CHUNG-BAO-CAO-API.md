# Ghi chú kiểm chứng báo cáo API

Ngày rà soát: 14/11/2026. Đây là ghi chú bằng chứng đi kèm [báo cáo API tiểu luận](BAO-CAO-API-TIEU-LUAN.md), không phải tuyên bố toàn bộ hệ thống đã nghiệm thu.

## Kết quả hiện tại sau khi dọn route cũ

Theo yêu cầu xóa route không còn dùng, đã xóa bốn file trong `src/auth/` (controller, service, module, README) và `src/common/roles.guard.ts` không có nơi sử dụng. Các route guest/session và bản đăng nhập token cũ không còn nằm trong source hoặc bản build mới. `LoginModule` với cookie `hq3d.sid` là luồng xác thực đang dùng. Số endpoint hoạt động vẫn là **27**, vì AuthModule cũ vốn không được AppModule đăng ký.

Đã sửa test hồ sơ/mật khẩu sang POST, bỏ hai kịch bản quản trị không còn hợp đồng API, chuyển kiểm thử audit sang luồng tự xóa tài khoản, giữ kiểm thử bảo vệ admin cuối và thêm kiểm thử route cũ trả 404 cho cả user/admin. Đồng thời cập nhật mục lục và tài liệu xác thực/backend/frontend để không trỏ tới file đã xóa.

| Lệnh kiểm tra sau khi sửa | Kết quả quan sát |
| --- | --- |
| `npm.cmd run build` | Thành công, exit 0; Nest xóa thư mục output cũ trước build |
| `npm.cmd test` | 6 file, **38/38 ca đạt**, exit 0 |
| `npm.cmd run test:e2e` | 1 file, **21/21 ca đạt**, exit 0; khoảng 54,50 giây |
| `npm.cmd run lint` | Exit 0; còn 1 cảnh báo no-base-to-string ở experiments.service.ts, ngoài phần sửa |
| `git diff --check` | Không có lỗi whitespace |

Không thay đổi dữ liệu MongoDB ứng dụng, cấu hình Nginx hoặc hành vi huấn luyện/giao diện. Chưa chạy kiểm thử Docker/HTTPS và trình duyệt. Cấu hình Nginx lệch với đường bulk của FE vẫn là giới hạn đã nêu trong báo cáo.

**Các mục 1–4 bên dưới ghi lại lần biên soạn tài liệu trước khi dọn code**, bao gồm kết quả 15/22 và các dòng test cũ. Chúng được giữ làm lịch sử, không thay thế kết quả hiện tại phía trên.

## 1. Phạm vi thay đổi

- Tạo `docs/BAO-CAO-API-TIEU-LUAN.md`: bản thảo học thuật có mục đích, kiến trúc, cấu trúc mã nguồn, 27 endpoint, quyền truy cập, dữ liệu, ví dụ, sơ đồ và giới hạn.
- Viết lại `docs/API-HANDBOOK.md` theo hợp đồng hiện tại, bỏ danh mục admin không có trong controller, sửa phương thức cập nhật tài khoản từ PATCH sang POST, làm rõ bulk và sync tổng quát.
- Tạo ghi chú kiểm chứng này và bổ sung liên kết tài liệu ở README gốc.
- Không sửa backend, frontend, Nginx hay kiểm thử trong đợt biên soạn.

## 2. Đối chiếu mã nguồn

Đã khảo sát cấu trúc dự án, module đang được nạp, toàn bộ bảy controller hoạt động, Service/DTO/schema nghiệp vụ, session/guard/quyền sở hữu, mã frontend liên quan đến xác thực/lưu/đồng bộ/worker, cấu hình Nginx và kịch bản API E2E.

| Nhóm | Số endpoint |
| --- | --- |
| Hệ thống | 2 |
| Xác thực | 4 |
| Tài khoản cá nhân | 4 |
| Bộ dữ liệu | 6 |
| Thí nghiệm | 6 |
| Lần huấn luyện | 3 |
| Đồng bộ tổng quát | 2 |
| Tổng | 27 |

Phát hiện cần lưu ý: frontend gọi `/experiments/bulk` và lấy `/experiments/:id` khi xung đột, trong khi Nginx chỉ mở nhóm auth và sync. Nhóm users hiện không có route admin. SPEC, README và một số tài liệu cũ chưa theo kịp source; chúng không được dùng thay thế controller làm căn cứ xác định endpoint.

## 3. Kiểm thử tích hợp đã chạy

Lệnh chạy từ thư mục gốc:

```powershell
npm.cmd run test:e2e
```

Kết quả: **22 ca, 15 đạt, 7 thất bại**, thời lượng Vitest khoảng 67,79 giây; exit code 1. Bộ test tự tạo MongoDB tạm `hoi-quy-3d-test` và thư mục upload tạm, không dùng dữ liệu ứng dụng trong `.env`.

Các lỗi sau đều là phản hồi 404 tại điểm assertion, không phải kết luận các luồng phía sau assertion đã được kiểm thử:

| Ca kiểm thử hiện có | Điểm thất bại trong test/app.e2e-spec.ts | Hiện trạng đối chiếu |
| --- | --- | --- |
| accepts 72 UTF-8 bytes and rejects passwords bcrypt would truncate | Dòng 240, PATCH /users/me/password, kỳ vọng 400 | Controller hiện dùng POST |
| edits own profile, validates fields, and protects admin endpoints | Dòng 499, PATCH /users/me, kỳ vọng 200 | Controller hiện dùng POST |
| changes password, keeps this session, revokes another session and old password | Dòng 552, PATCH /users/me/password, kỳ vọng 401 | Controller hiện dùng POST |
| admin role/status changes revoke sessions; admin deletion revokes and soft deletes data | Dòng 579, PATCH /users/:id, kỳ vọng 200 | Không có route admin này |
| protects last active admin through self and admin routes | Dòng 658, DELETE /users/:id, kỳ vọng 400 | Không có route admin này; phần tự xóa có API riêng |
| serializes simultaneous admin demotions so one active admin remains | Dòng 678, PATCH /users/:id, kỳ vọng 200 | Không có route admin này |
| writes audit events without passwords, hashes or session identifiers | Dòng 714, PATCH /users/me/password, kỳ vọng 200 | Controller hiện dùng POST |

Mười lăm ca còn lại đạt trong lần chạy này, bao gồm các kịch bản đăng nhập/phiên cơ bản, quyền sở hữu tài nguyên, CSV và bulk theo nội dung bộ test. Không diễn giải con số này thành tỷ lệ bao phủ toàn bộ API: chưa đo coverage và bộ test còn có hợp đồng cũ.

## 4. Giới hạn xác minh

Chưa chạy lại bộ test sau khi sửa hợp đồng test vì lần này không sửa code/test. Chưa gọi thử riêng các API cập nhật tài khoản bằng POST, chưa chạy Docker/HTTPS, chưa kiểm thử giao diện trình duyệt. Không có số đo hiệu năng để đưa vào báo cáo.

Tài liệu Markdown đã được kiểm tra danh mục route, khối JSON minh họa và liên kết nội bộ. Hai sơ đồ được cung cấp bằng Mermaid; chưa xuất/render thành ảnh hoặc kiểm tra bố cục Word/PDF. Khi đưa vào tiểu luận, cần dựng hình từ Mermaid và điều chỉnh số bảng/hình theo mẫu của trường.
