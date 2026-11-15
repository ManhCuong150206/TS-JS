# Sắp xếp lại src ngày 2026-11-15

## Trước khi sửa

- Nhánh `restructure-src` bắt đầu từ `5138d860d774b89a5220dbdca5068a12c3e5ccb8`.
- Dùng thư mục `docs/` đã có ở gốc repo. Tạo báo cáo trong `docs/changes/`.
- `src/` có **61 file** (51 TypeScript và 10 README). Sáu module và các file cần chuyển đều có đúng tên trong bảng yêu cầu.
- Khác cấu trúc dự kiến, `test/` đã tồn tại với ba file bên dưới. Hai thư mục `test/unit/` và `test/e2e/` chưa có.
- Worktree đã có thay đổi ở `src.rar` và ba file HTML chưa được Git theo dõi trong `docs/`.

### Cây thư mục

```text
src/
  app.controller.spec.ts
  app.controller.ts
  app.module.ts
  app.service.ts
  common/
    auth.guard.ts
    configure-app.ts
    csv-validator.spec.ts
    csv-validator.ts
    database.config.ts
    ownership.ts
    pagination.ts
    README.md
    session.config.spec.ts
    session.config.ts
  datasets/
    datasets.controller.ts
    datasets.module.ts
    datasets.service.ts
    dto/
      create-dataset.dto.ts
    README.md
    schemas/
      dataset.schema.ts
    upload.config.spec.ts
    upload.config.ts
  experiments/
    dto/
      create-experiment.dto.ts
      README.md
    experiments.controller.spec.ts
    experiments.controller.ts
    experiments.module.ts
    experiments.service.spec.ts
    experiments.service.ts
    README.md
    saved-snapshot.ts
    schemas/
      experiment.schema.ts
      README.md
    synthetic-config.validation.ts
  login/
    audit.schema.ts
    audit.service.ts
    auth.dto.ts
    login.controller.ts
    login.module.ts
    login.service.ts
    README.md
    user.schema.ts
  main.ts
  README.md
  sync/
    dto/
      sync.dto.ts
    README.md
    schemas/
      sync-operation.schema.ts
    sync.controller.ts
    sync.module.ts
    sync.service.ts
  training-runs/
    dto/
      create-training-run.dto.ts
    README.md
    schemas/
      training-run.schema.ts
    training-runs.controller.ts
    training-runs.module.ts
    training-runs.service.ts
  users/
    README.md
    users.controller.ts
    users.dto.ts
    users.module.ts
    users.service.ts
test/
  app.e2e-spec.ts
  cleanup-browser-backend.mjs
  run-browser-backend.mjs
```

### Kết quả chạy

| Lệnh | Kết quả |
|---|---|
| `npx.cmd tsc --noEmit` | Exit 0, không có diagnostic |
| `npm.cmd test` | Exit 0, Vitest 4.1.11, 6/6 file và 38/38 test đạt |
| `npm.cmd run build` | Exit 0, `nest build` |

### Danh sách route

Script Node tạm đọc AST TypeScript của các decorator `@Controller`, `@Get`, `@Post`, `@Patch`, `@Put`, `@Delete` và lấy tiền tố global từ `setGlobalPrefix`. Kết quả đã sắp xếp có 27 route.

```text
DELETE /api/v1/datasets/:id
DELETE /api/v1/experiments/:id
DELETE /api/v1/users/me
GET /api/v1
GET /api/v1/auth/me
GET /api/v1/datasets
GET /api/v1/datasets/:id
GET /api/v1/datasets/:id/download
GET /api/v1/experiments
GET /api/v1/experiments/:id
GET /api/v1/health
GET /api/v1/sync/changes
GET /api/v1/training-runs
GET /api/v1/training-runs/:id
GET /api/v1/users/me
PATCH /api/v1/experiments/:id
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/register
POST /api/v1/datasets
POST /api/v1/datasets/upload
POST /api/v1/experiments
POST /api/v1/experiments/bulk
POST /api/v1/sync/batch
POST /api/v1/training-runs
POST /api/v1/users/me
POST /api/v1/users/me/password
```

### File ngoài src cần đối chiếu

| Vị trí | Nội dung cần kiểm tra |
|---|---|
| `test/app.e2e-spec.ts`, `test/run-browser-backend.mjs`, `test/cleanup-browser-backend.mjs` | Import tới mã nguồn và bản build, vị trí file e2e và các script hỗ trợ |
| `package.json`, `vitest.config.ts`, `vitest.config.e2e.ts`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.oxlintrc.json` | Lệnh test/lint, mẫu tìm test, phạm vi kiểm tra kiểu và build |
| `Dockerfile.api`, `Dockerfile.api.dockerignore`, `docker-compose.yml`, `deploy/` | Đường dẫn tới source, bản build và điểm khởi động ứng dụng |
| `README.md`, `BAO-CAO-CAP-NHAT-2026-11-03.md`, `docs/` | Link README và tham chiếu tới file chuyển vị trí |
