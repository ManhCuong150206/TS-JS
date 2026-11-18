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
# API inventory (verified from source)

The application installs the global prefix `/api/v1` in `src/config/configure-app.ts`. Authentication is a server-side session cookie (`hq3d.sid`), not JWT. `AuthGuard` is registered globally by `LoginModule`; only routes marked `@Public()` bypass it. Requests with a browser `Origin` outside `CORS_ORIGINS` are rejected. Every `POST`, `PATCH`, `PUT`, and `DELETE` also requires `X-Requested-With: XMLHttpRequest`.

HTTP defaults below follow NestJS controller decorators. The exact serialized body still depends on returned Mongoose records and runtime data; the inventory does not claim a fixed schema where the source does not define one. No Swagger/OpenAPI controller decorators were found.

| API                                                | Method | Authentication     | Database / side effect                                                     | Priority | Request evidence and response                                                                   | Performance scenario                                                              |
| -------------------------------------------------- | ------ | ------------------ | -------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/api/v1`                                          | GET    | Public             | None                                                                       | Low      | Returns `Hello World!` (200).                                                                   | Smoke, baseline, load                                                             |
| `/api/v1/health`                                   | GET    | Public             | None                                                                       | High     | JSON `{ status, service, version, timestamp }` (200).                                           | Smoke, baseline, load                                                             |
| `/api/v1/auth/register`                            | POST   | Public + throttler | Creates user and audit entry                                               | High     | `RegisterDto`: email, password, displayName; default 201. Password is hashed.                   | One PowerShell fixture setup request per run; not part of k6 timed traffic.       |
| `/api/v1/auth/login`                               | POST   | Public + throttler | Reads user; writes session and audit entry                                 | High     | `LoginDto`: email/password; returns `publicUser`; 200. Sets session cookie.                     | k6 database profile: one login sample per run; not a stable percentile/load test. |
| `/api/v1/auth/logout`                              | POST   | Required           | Destroys session and writes audit entry                                    | Medium   | No body DTO; returns `{ success: true }`; explicitly 200.                                       | k6 database profile teardown: one request per run.                                |
| `/api/v1/auth/me`                                  | GET    | Session            | None beyond AuthGuard user lookup                                          | Medium   | Returns `publicUser(account)`; 200.                                                             | Not separately exercised; `GET /users/me` verifies session identity.              |
| `/api/v1/datasets/upload`                          | POST   | Session            | Writes CSV file and dataset document                                       | High     | Multipart field `file` plus `name`; default 201.                                                | NOT RUN: filesystem and DB writes; test-owned file/data cleanup not established.  |
| `/api/v1/datasets`                                 | POST   | Session            | Creates dataset document                                                   | High     | `CreateDatasetDto`; default 201.                                                                | k6 database profile creates metadata-only fixtures with unique clientIds.         |
| `/api/v1/datasets?page=&limit=`                    | GET    | Session            | Mongoose find/count; default page 1, limit 20, max 100                     | High     | Returns `{ items, total, page, limit, totalPages }`; 200.                                       | k6 database profile checks paginated collection query.                            |
| `/api/v1/datasets/:id`                             | GET    | Session            | Owner-filtered Mongoose lookup                                             | High     | `:id` can be Mongo ObjectId or clientId per `idFilter`; 200 or 404.                             | k6 database profile reads each dataset it created.                                |
| `/api/v1/datasets/:id/download`                    | GET    | Session            | Owner-filtered lookup and local file read                                  | Medium   | File download; 200 or 404 if unavailable.                                                       | Optional with `K6_DATASET_ID`; may depend on local upload storage.                |
| `/api/v1/datasets/:id`                             | DELETE | Session            | Soft-deletes dataset document                                              | Medium   | No DTO; default 200.                                                                            | k6 database profile soft-deletes only its uniquely created dataset fixtures.      |
| `/api/v1/experiments`                              | POST   | Session            | Reads dataset, creates experiment                                          | High     | `CreateExperimentDto`; default 201. Requires existing owned dataset.                            | NOT RUN: depends on test dataset and creates a document.                          |
| `/api/v1/experiments/bulk`                         | POST   | Session            | Reads/writes experiments and optional dataset refs                         | High     | JSON array of up to 100 sync items; explicitly 200.                                             | NOT RUN: mutating upsert; safe isolation/cleanup not configured.                  |
| `/api/v1/experiments?page=&limit=`                 | GET    | Session            | Mongoose find/populate/count; default page 1, limit 20, max 100            | High     | Returns `{ items, total, page, limit, totalPages }`; 200.                                       | Optional authenticated API run.                                                   |
| `/api/v1/experiments/:id`                          | GET    | Session            | Owner-filtered lookup/populate                                             | High     | ObjectId or clientId; 200 or 404.                                                               | Optional with `K6_EXPERIMENT_ID`.                                                 |
| `/api/v1/experiments/:id`                          | PATCH  | Session            | Reads and updates owned experiment; increments syncVersion                 | High     | `UpdateExperimentDto`; 200.                                                                     | NOT RUN: mutates data and has no test-owned fixture/cleanup.                      |
| `/api/v1/experiments/:id`                          | DELETE | Session            | Soft-deletes owned experiment; increments syncVersion                      | Medium   | No DTO; default 200.                                                                            | NOT RUN: destructive mutation.                                                    |
| `/api/v1/training-runs`                            | POST   | Session            | Reads owned experiment and creates run                                     | High     | `CreateTrainingRunDto`; default 201.                                                            | NOT RUN: creates data and requires existing experiment.                           |
| `/api/v1/training-runs?experimentId=&page=&limit=` | GET    | Session            | Optional experiment lookup + find/count; default page 1, limit 20, max 100 | High     | Returns `{ items, total, page, limit, totalPages }`; 200.                                       | Optional authenticated API run.                                                   |
| `/api/v1/training-runs/:id`                        | GET    | Session            | Owner-filtered lookup/populate                                             | Medium   | ObjectId or clientId; 200 or 404.                                                               | Optional with `K6_TRAINING_RUN_ID`.                                               |
| `/api/v1/sync/batch`                               | POST   | Session            | Applies changes, saves idempotency/audit operation records                 | High     | `SyncBatchRequestDto.operations`; default 201.                                                  | NOT RUN: creates/updates/deletes domain data and audit rows.                      |
| `/api/v1/sync/changes?since=`                      | GET    | Session            | Reads experiments, datasets and training runs                              | High     | ISO date string; omitted defaults to epoch; returns serverTime/since/changes; invalid date 400. | Optional authenticated API run (last-hour query).                                 |
| `/api/v1/users/me`                                 | GET    | Session            | AuthGuard account lookup                                                   | Medium   | Returns `publicUser(account)`; 200.                                                             | k6 database profile checks the temporary account session.                         |
| `/api/v1/users/me`                                 | POST   | Session            | Updates profile                                                            | Low      | `UpdateProfileDto.displayName`; explicitly 200.                                                 | NOT RUN: mutates account profile.                                                 |
| `/api/v1/users/me/password`                        | POST   | Session            | Verifies and changes password, increments sessionVersion, audit write      | High     | `ChangePasswordDto`; explicitly 200.                                                            | NOT RUN: changes credentials/session; requires isolated account.                  |
| `/api/v1/users/me`                                 | DELETE | Session            | Disables/deletes account, soft-deletes owned records, audit write          | High     | `DeleteAccountDto.password`; default 200.                                                       | PowerShell wrapper cleans up only its temporary account; not timed by k6.         |

## What the k6 harness can run safely

- Smoke and load profiles always exercise only `GET /api/v1` and `GET /api/v1/health`.
- With a pre-provisioned session cookie, API profile also exercises authenticated read routes: `auth/me`, `users/me`, datasets/experiments/training-runs list, and sync changes.
- The opt-in database profile creates a temporary account, measures one login in k6, exercises `users/me` and dataset list/create/detail/delete through k6, logs out, and deletes only that temporary account through the API. Use `run-database.ps1 -ConfirmTestDataWrites` with a confirmed test database.
- Detail/download routes are included only when the corresponding ID environment variable is supplied.
- The database profile covers the auth/session lifecycle and dataset metadata API. Experiment, training-run, sync, file upload/download, profile update and password-change routes remain NOT RUN because they need their own fixture/cleanup plan. Auth audit events are retained according to backend behavior.

The tests measure HTTP latency, status, and response shape. They cannot attribute elapsed time precisely to MongoDB. Use MongoDB profiler/monitoring and `explain('executionStats')` separately when investigating a measured slow route.
