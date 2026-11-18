# API inventory cho k6

Nguồn xác minh: các controller trong `src/`, `configureApp()` (global prefix `/api/v1`), guard xác thực và DTO/service tương ứng. Không có Swagger/OpenAPI đang được khởi tạo.

| API | Method | Authentication | Database operation | Priority | Test scenario |
|---|---|---|---|---|---|
| `/api/v1/` | GET | Public | Không | Low | Smoke/baseline |
| `/api/v1/health` | GET | Public | Không (không kiểm tra DB) | Critical | Smoke, baseline, load, stress, spike, soak |
| `/api/v1/auth/register` | POST | Public, throttle 5/phút/IP | Create user | High | Không chạy tải mặc định; test riêng với email duy nhất |
| `/api/v1/auth/login` | POST | Public, throttle 5/phút/IP | Read user, session, audit write | Critical | `setup()` một lần, không login mỗi VU |
| `/api/v1/auth/logout` | POST | Session | Session/audit write | Medium | API write tùy chọn |
| `/api/v1/auth/me` | GET | Session | User read qua guard | High | API/baseline/load khi có test account |
| `/api/v1/users/me` | GET | Session | User read qua guard | Medium | API scenario khi có test account |
| `/api/v1/users/me` | POST | Session | User update | Medium | Không chạy mặc định (thay đổi account) |
| `/api/v1/users/me/password` | POST | Session | User/password update | Low | Không tự động chạy |
| `/api/v1/users/me` | DELETE | Session | Soft-delete resources, delete user | Low | Không tự động chạy |
| `/api/v1/datasets/upload` | POST | Session | File storage + dataset create | High | Không chạy mặc định (cần fixture an toàn) |
| `/api/v1/datasets` | POST | Session | Dataset create | High | Write smoke tùy chọn, gắn prefix riêng |
| `/api/v1/datasets` | GET | Session | Dataset read/page/count | High | API/baseline/load khi có test account |
| `/api/v1/datasets/:id` | GET | Session | Dataset read | Medium | Cần ID fixture; chưa tự chạy |
| `/api/v1/datasets/:id/download` | GET | Session | File storage read | Medium | Cần dataset upload fixture; chưa tự chạy |
| `/api/v1/datasets/:id` | DELETE | Session | Dataset soft delete | Medium | Chỉ cleanup record do write smoke tạo |
| `/api/v1/experiments` | POST | Session | Dataset lookup + experiment create | High | Cần dataset fixture; chưa tự chạy |
| `/api/v1/experiments/bulk` | POST | Session | Experiment upsert/concurrency | Critical | Concurrency tùy chọn, prefix bắt buộc |
| `/api/v1/experiments` | GET | Session | Experiment read/page/count/populate | Critical | API/baseline/load khi có test account |
| `/api/v1/experiments/:id` | GET | Session | Experiment read/populate | High | Cần fixture ID; chưa tự chạy |
| `/api/v1/experiments/:id` | PATCH | Session | Experiment update | High | Không chạy mặc định |
| `/api/v1/experiments/:id` | DELETE | Session | Experiment soft delete | Medium | Chỉ cleanup record do test tạo |
| `/api/v1/training-runs` | POST | Session | Experiment lookup + run create | High | Cần experiment fixture; chưa tự chạy |
| `/api/v1/training-runs` | GET | Session | Training run read/page/count | High | API scenario khi có test account |
| `/api/v1/training-runs/:id` | GET | Session | Training run read/populate | Medium | Cần fixture ID; chưa tự chạy |
| `/api/v1/sync/batch` | POST | Session | Multi-collection writes + idempotency | Critical | Concurrency tùy chọn, prefix bắt buộc |
| `/api/v1/sync/changes` | GET | Session | Multi-collection reads | High | API scenario khi có test account |

`GET /health` chỉ chứng minh process HTTP phản hồi; nó không chứng minh MongoDB hoạt động. Các kịch bản authenticated GET mới đi qua MongoDB (guard và collection truy vấn), nên dùng chúng để quan sát gián tiếp độ trễ end-to-end của DB, không diễn giải đó là thời gian query MongoDB thuần.
